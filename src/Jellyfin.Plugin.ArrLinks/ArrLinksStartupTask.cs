using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.ArrLinks;

public class ArrLinksStartupTask : IScheduledTask
{
    private readonly ILogger<ArrLinksStartupTask> _logger;

    public ArrLinksStartupTask(ILogger<ArrLinksStartupTask> logger)
    {
        _logger = logger;
    }

    public string Name => "Arr Links Startup";

    public string Key => "ArrLinksStartup";

    public string Description => "Registers Arr Links web client actions.";

    public string Category => "Application";

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        progress.Report(0);
        Plugin.RegisterFileTransformation(_logger);
        progress.Report(100);
        return Task.CompletedTask;
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo
        {
            Type = TaskTriggerInfoType.StartupTrigger
        };
    }
}
