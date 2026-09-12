using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using Jellyfin.Plugin.ArrLinks.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.ArrLinks;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static readonly Guid PluginId = Guid.Parse("9a926658-1d7d-4ee8-ae14-180528ea01ad");
    private static readonly Guid TransformId = Guid.Parse("37ef1f0d-f1e5-49c6-8a85-a679f0ef8ad9");

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        RegisterFileTransformation();
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

    public static string TransformIndexHtml(object request)
    {
        string contents = GetTransformContents(request);
        if (contents.Contains("jellyfin-arr-links-plugin", StringComparison.Ordinal))
        {
            return contents;
        }

        string script = ReadEmbeddedResource("Jellyfin.Plugin.ArrLinks.Web.arrLinks.js")
            .Replace("__PLUGIN_ID__", PluginId.ToString("D"), StringComparison.Ordinal);
        string tag = "<script id=\"jellyfin-arr-links-plugin\">" + script + "</script>";

        int bodyIndex = contents.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (bodyIndex >= 0)
        {
            return contents.Insert(bodyIndex, tag);
        }

        return contents + tag;
    }

    private static string GetTransformContents(object request)
    {
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

    private void RegisterFileTransformation()
    {
        Assembly? fileTransformationAssembly = AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(assembly => assembly.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);

        Type? pluginInterfaceType = fileTransformationAssembly?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
        if (pluginInterfaceType is null)
        {
            return;
        }

        object payload = new
        {
            id = TransformId,
            fileNamePattern = "index\\.html$",
            callbackAssembly = typeof(Plugin).Assembly.FullName,
            callbackClass = typeof(Plugin).FullName,
            callbackMethod = nameof(TransformIndexHtml)
        };

        pluginInterfaceType.GetMethod("RegisterTransformation")?.Invoke(null, new[] { payload });
    }
}

