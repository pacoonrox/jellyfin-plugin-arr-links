using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.ArrLinks.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public string RadarrUrl { get; set; } = string.Empty;

    public string SonarrUrl { get; set; } = string.Empty;

    public bool MovieRatingsEnabled { get; set; } = true;

    public bool SeriesGraphEnabled { get; set; } = true;
}

