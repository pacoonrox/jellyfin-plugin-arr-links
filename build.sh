#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$ROOT/src/Jellyfin.Plugin.ArrLinks/Jellyfin.Plugin.ArrLinks.csproj"
OUT="$ROOT/artifacts/plugin"
ZIP="$ROOT/artifacts/Jellyfin.Plugin.ArrLinks.zip"

rm -rf "$ROOT/artifacts"
mkdir -p "$OUT"

dotnet publish "$PROJECT" -c Release -o "$OUT"
(
  cd "$OUT"
  zip -r "$ZIP" .
)

echo "$ZIP"

