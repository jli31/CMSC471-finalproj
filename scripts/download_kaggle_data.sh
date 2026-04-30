#!/usr/bin/env bash
set -euo pipefail

# Run from repo root for predictable relative paths.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$REPO_ROOT/data/raw"

mkdir -p "$RAW_DIR"

if ! command -v kaggle >/dev/null 2>&1; then
  echo "Error: kaggle CLI not found. Install with: pip install kaggle"
  exit 1
fi

DATASETS=(
  "rohiteng/spotify-music-analytics-dataset-20152025"
  "gauthamvijayaraj/spotify-tracks-dataset-updated-every-week"
  "maharshipandya/-spotify-tracks-dataset"
  "tomigelo/spotify-audio-features"
)

for slug in "${DATASETS[@]}"; do
  name="${slug##*/}"
  zip_path="$RAW_DIR/$name.zip"
  out_dir="$RAW_DIR/$name"

  echo "Downloading $slug ..."
  kaggle datasets download -d "$slug" -p "$RAW_DIR"

  echo "Extracting $zip_path -> $out_dir ..."
  mkdir -p "$out_dir"
  unzip -o "$zip_path" -d "$out_dir" >/dev/null
done

echo "Done. Files are in $RAW_DIR"
