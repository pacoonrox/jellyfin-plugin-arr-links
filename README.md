# Jellyfin Arr Links

Small Jellyfin plugin that adds right-click media actions for external media tools:

- Open movies in Radarr
- Open series, seasons, and episodes in Sonarr
- Open shows in Series Graph
- Open movie ratings on IMDb, with TMDb fallback

The plugin uses the File Transformation plugin to inject a tiny Jellyfin Web patch at runtime. It does not modify Jellyfin Web files on disk.

## Requirements

- Jellyfin 12
- File Transformation plugin installed and enabled
- Radarr/Sonarr base URLs configured in this plugin

Install File Transformation from:

```text
https://www.iamparadox.dev/jellyfin/plugins/manifest.json
```

## Install

### Plugin catalog

1. Install File Transformation first.
2. Add this repository to Jellyfin:

```text
https://raw.githubusercontent.com/pacoonrox/jellyfin-plugin-arr-links/master/repository.json
```

3. Install **Arr Links** from the plugin catalog.
4. Restart Jellyfin.
5. Open `Dashboard -> Plugins -> Arr Links`.
6. Set your Radarr and Sonarr base URLs.
7. Restart Jellyfin once more so the web transform is active.

### Manual install

1. Download the release zip.
2. Extract it to Jellyfin's plugin folder.
3. Restart Jellyfin.
4. Open `Dashboard -> Plugins -> Arr Links`.
5. Set your Radarr and Sonarr base URLs.
6. Restart Jellyfin once more so the web transform is active.

## Build

```bash
dotnet restore
dotnet publish src/Jellyfin.Plugin.ArrLinks/Jellyfin.Plugin.ArrLinks.csproj -c Release -o artifacts/plugin
```

Or:

```bash
./build.sh
```
