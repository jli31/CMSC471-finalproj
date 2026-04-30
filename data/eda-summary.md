# EDA Summary for Spotify Project

## Source files reviewed
- `data/raw/SpotifyAudioFeaturesApril2019.csv`
- `data/raw/SpotifyAudioFeaturesNov2018.csv`
- `data/raw/dataset.csv`
- `data/raw/spotify_2015_2025_85k.csv`
- `data/raw/spotify_tracks.csv`

## Recommendation
Use `spotify_tracks.csv` as the primary analysis source because it includes popularity, year, and core audio features needed for your mini visualizations and final view in one table.

## Curated outputs generated
- `data/processed/analysis_ready_popular_tracks_2015_2025.csv` (4152 rows, popularity >= 45, year 2015-2025, complete feature rows)
- `data/processed/analysis_ready_popular_tracks_all_years.csv` (6234 rows, popularity >= 45, complete feature rows)

## Filtering logic
- Dropped rows with missing values in core fields (tempo, danceability, energy, valence, acousticness, liveness, speechiness, instrumentalness, popularity, year).
- Deduplicated by `track_id` to avoid repeated tracks.
- Applied popularity threshold `>= 45` (top ~10% of this file).
- Created project-window subset for 2015-2025.

## Why this threshold
- `popularity >= 45` keeps a strong sample size while focusing on more recognizable songs.
- It balances quality and coverage for interactive visuals.

## Quick stats
- Clean unique-track base: 62239
- Popular (>=45) all years: 6234
- Popular (>=45) years 2015-2025: 4152
- Year range in curated set: 2015 to 2024