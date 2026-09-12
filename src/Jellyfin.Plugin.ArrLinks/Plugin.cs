using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using Jellyfin.Plugin.ArrLinks.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArrLinks;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static readonly Guid PluginId = Guid.Parse("9a926658-1d7d-4ee8-ae14-180528ea01ad");
    private static readonly Guid TransformId = Guid.Parse("37ef1f0d-f1e5-49c6-8a85-a679f0ef8ad9");

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override Guid Id => PluginId;

    public override string Name => "Arr Links";

    public override string Description => "Adds Radarr, Sonarr, Series Graph, and IMDb actions to Jellyfin Web media context menus.";

    public override string ConfigurationFileName => "Jellyfin.Plugin.ArrLinks.xml";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = Name,
            DisplayName = "Arr Links",
            EmbeddedResourcePath = GetType().Namespace + ".Web.configPage.html",
            EnableInMainMenu = false
        };
    }

    public static string TransformWebFile(object request)
    {
        string contents = GetTransformContents(request);
        if (contents.Contains("jellyfin-arr-links-plugin", StringComparison.Ordinal))
        {
            return contents;
        }

        string script = ReadEmbeddedResource("Jellyfin.Plugin.ArrLinks.Web.arrLinks.js")
            .Replace("__PLUGIN_ID__", PluginId.ToString("D"), StringComparison.Ordinal);
        if (contents.Contains("</body>", StringComparison.OrdinalIgnoreCase))
        {
            string tag = "<script id=\"jellyfin-arr-links-plugin\">" + script + "</script>";
            int bodyIndex = contents.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            return contents.Insert(bodyIndex, tag);
        }

        return contents + Environment.NewLine + "/*! jellyfin-arr-links-plugin */" + Environment.NewLine + script;
    }

    private static string GetTransformContents(object request)
    {
        MethodInfo? valueMethod = request.GetType()
            .GetMethods()
            .FirstOrDefault(method =>
                method.Name == "Value"
                && method.IsGenericMethodDefinition
                && method.GetParameters().Length == 1);

        if (valueMethod is not null)
        {
            object? value = valueMethod.MakeGenericMethod(typeof(string)).Invoke(request, new object[] { "contents" });
            return value as string ?? string.Empty;
        }

        using JsonDocument document = JsonSerializer.SerializeToDocument(request);
        if (document.RootElement.TryGetProperty("contents", out JsonElement contentsElement))
        {
            return contentsElement.GetString() ?? string.Empty;
        }

        return string.Empty;
    }

    private static string ReadEmbeddedResource(string resourceName)
    {
        Assembly assembly = typeof(Plugin).Assembly;
        using Stream? stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
        {
            return string.Empty;
        }

        using StreamReader reader = new(stream);
        return reader.ReadToEnd();
    }

    internal static bool RegisterFileTransformation(ILogger logger)
    {
        try
        {
            Assembly? fileTransformationAssembly = AssemblyLoadContext.All
                .SelectMany(context => context.Assemblies)
                .FirstOrDefault(assembly => assembly.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);

            Type? pluginInterfaceType = fileTransformationAssembly?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            if (pluginInterfaceType is null)
            {
                logger.LogWarning("[Arr Links] File Transformation plugin interface was not found; web injection was not registered.");
                return false;
            }

            if (pluginInterfaceType.GetMethod("RegisterTransformation") is not { } registerMethod)
            {
                logger.LogWarning("[Arr Links] File Transformation registration method was not found; web injection was not registered.");
                return false;
            }

            Type? jObjectType = AssemblyLoadContext.All
                .SelectMany(context => context.Assemblies)
                .Select(assembly => assembly.GetType("Newtonsoft.Json.Linq.JObject"))
                .FirstOrDefault(type => type is not null);

            MethodInfo? parseMethod = jObjectType?.GetMethod("Parse", BindingFlags.Public | BindingFlags.Static, new[] { typeof(string) });
            if (parseMethod is null)
            {
                logger.LogWarning("[Arr Links] Newtonsoft JObject parser was not found; web injection was not registered.");
                return false;
            }

            string payloadJson = JsonSerializer.Serialize(new
            {
                id = TransformId.ToString("D"),
                fileNamePattern = "(index\\.html|main\\.jellyfin\\.bundle\\.js)$",
                callbackAssembly = typeof(Plugin).Assembly.FullName,
                callbackClass = typeof(Plugin).FullName,
                callbackMethod = nameof(TransformWebFile)
            });
            object? payload = parseMethod.Invoke(null, new object[] { payloadJson });
            if (payload is null)
            {
                logger.LogWarning("[Arr Links] File Transformation payload could not be created; web injection was not registered.");
                return false;
            }

            registerMethod.Invoke(null, new[] { payload });
            logger.LogInformation("[Arr Links] Registered Jellyfin Web transformations with File Transformation plugin.");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Arr Links] Failed to register File Transformation web injection.");
            return false;
        }
    }
}
