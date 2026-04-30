# Data Directory

This project stores local datasets in:

- `data/raw/` for unmodified source data
- `data/processed/` for transformed data artifacts

Raw dataset snapshots are committed for team consistency.
Generated/processed outputs remain gitignored.

## Kaggle Sources

1. https://www.kaggle.com/datasets/rohiteng/spotify-music-analytics-dataset-20152025
2. https://www.kaggle.com/datasets/gauthamvijayaraj/spotify-tracks-dataset-updated-every-week
3. https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset
4. https://www.kaggle.com/datasets/tomigelo/spotify-audio-features

## Download

Run:

```bash
bash scripts/download_kaggle_data.sh
```

This downloads zip files into `data/raw/` and extracts each dataset into its own subfolder.
