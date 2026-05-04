# Data directory

## Layout

- **`raw/`** — Unmodified Kaggle CSV snapshots (committed so the team shares identical inputs).
- **`processed/`** — Analysis-ready tables used by the app and by `scripts/merge_genre.py`.

Processed outputs for this project are **committed** so graders and teammates can run the page without regenerating files. If you replace raw sources, re-run any merge or cleaning steps and keep filenames in sync with `js/script.js` (`DATA_MAIN`).

## Kaggle sources

1. https://www.kaggle.com/datasets/rohiteng/spotify-music-analytics-dataset-20152025  
2. https://www.kaggle.com/datasets/gauthamvijayaraj/spotify-tracks-dataset-updated-every-week  
3. https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset  
4. https://www.kaggle.com/datasets/tomigelo/spotify-audio-features  

## Main file consumed by the UI

- `processed/analysis_ready_popular_tracks_2015_2025_genre.csv` — see root **README.md** for columns and how `genre` was joined.

No Kaggle API token is required to view or run the project if you use the committed `data/` tree.
