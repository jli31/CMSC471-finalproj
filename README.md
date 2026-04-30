# CMSC471-finalproj

## Data Setup

This repo uses local Kaggle datasets for Spotify analytics. We commit `data/raw/` snapshots so collaborators all use the same files.

1. Install Kaggle CLI and configure your API token (`~/.kaggle/kaggle.json`).
2. From the repo root, run:

```bash
bash scripts/download_kaggle_data.sh
```

The script downloads and extracts:

- `rohiteng/spotify-music-analytics-dataset-20152025`
- `gauthamvijayaraj/spotify-tracks-dataset-updated-every-week`
- `maharshipandya/-spotify-tracks-dataset`
- `tomigelo/spotify-audio-features`