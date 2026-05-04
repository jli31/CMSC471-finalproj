# The Sound of Spotify, 2015–2025

**Course:** CMSC471 · Interactive explanation  
**Authors:** Jiho Lee, John Li, Ed Yun, Andrew Zhang

Single-page web story about how **popular tracks on Spotify (2015–2025)** look in audio-feature space over time—and what happens when you change the **years** and **segment** (genre when known, otherwise language). Everything on the page shares **one filter state** so the demo stays one coherent question instead of mixing unrelated subsets.

---

## Overview

We combine several public Kaggle Spotify exports into one **analysis-ready CSV** of hit-tier tracks with **year, popularity, tempo, danceability, energy, valence**, and related fields, plus a merged **genre** column for filtering.

The live piece is plain **HTML + CSS + D3 v7** (no bundler). It walks a reader from a **decade hook chart** through a **linked dashboard** (timeline with brush, mood–energy scatter, top-quartile feature strip), an **era + mood distribution** view, **tempo vs popularity** exploration with a track lookup, **myth-check** mini charts, and a **generated readout** that summarizes the *current* slice in plain language.

**Main intellectual takeaway:** the data keep pushing back on silver-bullet stories. Averages drift, but **popularity stays spread out** across mood, energy, and tempo; the visualization is built to make that **heterogeneity** visible rather than hiding it behind one headline chart.

---

## Problem and design response

- **Problem:** It is easy to tell a tidy decade story about “how music changed,” but those stories often **flip when the window or scene changes**, and disconnected static charts rarely ask the **same** question on the **same** songs twice.

- **Response:** **One lens** (year range + segment) drives **every** chart, including myth checks and the closing recap. The design is the argument: trend → profile → spread in time → quick falsifiers → readout—so a demo can show a claim being **checked** under one consistent subset, including when the answer is “messy / no single predictor.”

---

## How to run locally

The app loads CSV with `fetch` via a **relative path**. Use a small local server from the project root (not `file://`, which browsers often block for data files).

```bash
cd CMSC471-finalproj
python3 -m http.server 8000
```

Then open **http://localhost:8000/** in a browser.

No API keys, no Kaggle CLI, and no build step are required if you use the committed `data/` tree as-is.

---

## Repository layout

| Path | Role |
|------|------|
| `index.html` | Page structure, narrative copy, section anchors |
| `css/styles.css` | Layout, theme, chart containers, myth/capstone panels |
| `js/script.js` | D3 charts, filter state, brush, takeaways, capstone text |
| `data/raw/` | Committed snapshots of Kaggle CSVs (team baseline) |
| `data/processed/` | Merged / filtered CSVs consumed by the app |
| `scripts/merge_genre.py` | Joins `track_genre` from `dataset.csv` into the popular-tracks table |

The browser loads **`data/processed/analysis_ready_popular_tracks_2015_2025_genre.csv`** as the main dataset (`DATA_MAIN` in `js/script.js`). Other files under `data/processed/` are alternate or auxiliary slices the team used while iterating.

---

## Data sources and pipeline

### Raw sources (Kaggle)

Snapshots live under `data/raw/` (exact folder names vary by download). Primary references:

1. [Spotify Music Analytics Dataset 2015–2025](https://www.kaggle.com/datasets/rohiteng/spotify-music-analytics-dataset-20152025)  
2. [Spotify tracks dataset (updated)](https://www.kaggle.com/datasets/gauthamvijayaraj/spotify-tracks-dataset-updated-every-week)  
3. [Spotify tracks dataset](https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset)  
4. [Spotify audio features](https://www.kaggle.com/datasets/tomigelo/spotify-audio-features)  

More detail: `data/README.md`.

### Processed artifact (main)

- **`analysis_ready_popular_tracks_2015_2025_genre.csv`** — rows keyed by `track_id`, with audio features, `year`, `popularity`, `language`, `duration_ms`, and **`genre`** (from `dataset.csv` where available).

### How `genre` was added

```bash
python3 scripts/merge_genre.py
```

The script reads `data/processed/analysis_ready_popular_tracks_2015_2025.csv` and `data/raw/dataset.csv`, maps `track_id` → `track_genre`, and writes `analysis_ready_popular_tracks_2015_2025_genre.csv` with an extra `genre` column. Tracks without a genre label still appear; the UI can treat unknown genres as part of “all” or language-based buckets depending on the row.

Earlier table-building steps (filtering to 2015–2025, popularity thresholds, deduplication) were done in the team’s notebook / spreadsheet workflow; the committed processed CSV is the **handoff artifact** that the front end trusts.

---

## Implementation process (chronological)

1. **Scoping** — Chose a bounded story (Spotify audio features + time + popularity) and local CSVs only, to avoid auth and API drift during the course timeline.

2. **Data alignment** — Standardized on one “popular tracks” table per year range, then **merged genre** from a second raw file so the UI could offer a meaningful segment filter beyond language alone.

3. **Hook + spine** — Built the opening multi-line chart (danceability, energy, valence by year) and wired a single **global filter** (year min/max, segment) so later sections would not contradict each other.

4. **Dashboard** — Added a **brushable** feature timeline, **energy–valence** scatter (size = popularity), and a **top 25% vs rest** median comparison strip—each re-querying the same filtered rows.

5. **Era layer** — Valence timeline with light era bands for context, plus a **focus-year histogram** to compare a single year’s mood spread against the filtered baseline.

6. **Myth checks + tempo explorer** — Small charts and copy for “fast = popular?”, “happier over time?”, “dance × energy cluster?”, “shorter songs?”—implemented as **sanity checks**, not causal models. Tempo section adds **nearest-track** lookup and an external **YouTube** link for listening.

7. **Capstone readout** — Auto-generated summary + metric cards from the **same** `filtered()` dataset so the closing text always matches what the reader just saw.

8. **Narrative + rubric pass** — Tightened prose for a **live audience** (story over documentation), added an explicit **problem / design** strip on the page, and aligned language with the **non–single-predictor** takeaway.

---

## Peer feedback (early)

Classmates nudged us toward **time-based interaction** (sliders / linked views), **clear definitions** for opaque metrics like energy, and **more deliberate chart types** instead of default scatter-only exploration. That fed directly into the decoder-ring section, brush timeline, and myth cards.

---

## Limitations

- **Spotify features** are coarse summaries of audio; they are not lyrics, culture, or marketing.
- **Popularity** is Spotify’s own 0–100 blend (recency and relative performance), not raw stream counts.
- **Genre** coverage is incomplete; many rows rely on **language** or “all” for fair comparisons.
- We report **associations and distributions**, not causation. When effects are small or slice-dependent, that is part of the result.

---

## License

See `LICENSE` in the repository root.
