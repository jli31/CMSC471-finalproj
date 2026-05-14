# The Sound of Popularity: Decoding Spotify Hits

**CMSC471 Final Project** · Jiho Lee, John Li, Ed Yun, Andrew Zhang

An interactive narrative website that asks whether Spotify audio features—tempo, energy, and valence—can explain what makes a song popular. The story walks viewers through one hypothesis at a time, shows where each idea breaks down, and ends with a 3D “sonic neighborhood” explorer for discovering similar tracks.

---

## Live demo

**[https://jli31.github.io/CMSC471-finalproj/](https://jli31.github.io/CMSC471-finalproj/)**

Hosted on GitHub Pages from the `main` branch. No install or local server needed to view the project.

**Code repository:** [https://github.com/jli31/CMSC471-finalproj](https://github.com/jli31/CMSC471-finalproj)


---

## Quick start (local development)

From the project root:

```bash
python3 -m http.server
```

Open `http://localhost:8000` in a browser. The page loads CSVs from `data/processed/` via D3 and Plotly; a local server is required when developing locally (opening `index.html` directly may block file requests).

**Stack:** HTML, CSS, D3 v7, Plotly 3D · no build step.

---

## Story flow (final site)

| Section | Question | Interaction |
|--------|----------|-------------|
| **Tempo** | Are faster songs more popular? | Track explorer (vertical BPM slider + nearest track) **or** tempo vs. popularity scatter |
| **Energy** | Does intensity predict hits? | Brush energy histogram → popularity density (KDE) |
| **Valence / mood** | Do sunnier songs win? | Valence × energy heatmap (color = median popularity) |
| **What it all means** | — | Narrative bridge: no single formula for popularity |
| **3D neighbors** | What sounds like my song? | Search + Plotly scatter3d (energy, valence, tempo) with 20 nearest neighbors |

Insight blurbs between sections summarize what each viz does *not* show, so the argument builds toward the capstone explorer rather than treating charts as isolated widgets.

---

## Repository layout

Source files include brief section comments tying HTML regions to `js/script.js` init functions (`initTempoViz`, `initEnergyBrush`, `initMoodHeatmap`, `initNeighborViz`).

```
CMSC471-finalproj/
├── index.html          # Page structure, copy, and viz containers
├── css/styles.css      # Shared layout and component styles
├── js/script.js        # initTempoViz, initEnergyBrush, initMoodHeatmap, initNeighborViz
├── data/
│   ├── raw/            # Committed Kaggle snapshots (see data/README.md)
│   ├── processed/      # Analysis-ready CSVs used by the site
│   ├── eda-summary.md  # Filtering rationale and row counts
│   └── README.md
└── README.md
```

**Key processed files**

- `analysis_ready_popular_artists_tracks_2015_2025.csv` — tempo track explorer (artist-focused slice)
- `analysis_ready_popular_tracks_2015_2025.csv` — tempo scatter, energy brush, mood heatmap (popularity ≥ 45, 2015–2025)
- Merged English catalog for 3D neighbors: `spotify_tracks.csv` + popular processed CSVs (deduped by `track_id`)

---

## Data setup

This repo uses local Kaggle datasets committed under `data/raw/` so all teammates share the same files. **No Kaggle CLI or API token is required**—clone/pull and use the snapshots as-is.

Sources (see [data/README.md](data/README.md)):

- [Spotify Music Analytics 2015–2025](https://www.kaggle.com/datasets/rohiteng/spotify-music-analytics-dataset-20152025)
- [Spotify Tracks (weekly update)](https://www.kaggle.com/datasets/gauthamvijayaraj/spotify-tracks-dataset-updated-every-week)
- [Spotify Tracks](https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset)
- [Spotify Audio Features](https://www.kaggle.com/datasets/tomigelo/spotify-audio-features)

**Curation (team-wide):** After EDA ([data/eda-summary.md](data/eda-summary.md)), we standardized on `spotify_tracks.csv` where possible, dropped incomplete rows, deduplicated by `track_id`, and filtered to **popularity ≥ 45** for a “recognizable hit” slice (~top decile). The 2015–2025 window subset powers most milestone/final charts.

---

## Process documentation

### Phase 1 — Proposal & research (early semester)

- **Goal:** Pick a dataset and a coherent “hits vs. audio features” angle with peer-reviewable mini-viz plans.
- **Activities:** Literature/dataset survey, sketching story order, defining popularity and feature disclaimers, drafting milestone scope.
- **Outcome:** Approved proposal framing tempo, energy, and mood as separate tests—not one regression “formula.”

**Peer feedback we incorporated**

- Classmates encouraged **time sliders** and clear explanations of opaque metrics (energy, valence)—we kept the narrative disclaimers and interactive brushing/sliders rather than a single static dashboard.
- Map/genre ideas were considered; we narrowed to a **feature-first story** that could ship reliably with our merged CSVs.

### Phase 2 — Data & milestone

- **Goal:** Reproducible processed tables and a first pass at interactive sections.
- **Activities:** EDA across raw files, building `analysis_ready_*` CSVs, milestone HTML/D3 prototypes (tempo explorer, early neighbor concept), Git workflow on shared `data/raw/`.
- **Outcome:** Working local server demo, processed data documented in `data/eda-summary.md`, core narrative spine in place.

### Phase 3 — Final refinement (post-milestone)

- **Goal:** One cohesive scrollytelling page, polished interactions, and a capstone 3D viz.
- **Activities:**
  - Reset/simplified UI after milestone feedback (leaner sections, clearer tempo view toggle).
  - Tempo: dual view (explorer + scatter), energy: linked brush + KDE, mood: heatmap iterations (tier bars / slider / heatmap) → final valence×energy heatmap.
  - Neighbor viz: merged English catalog, title dedupe, subsampled background points, search dropdown, neighbor list + YouTube links.
  - Copy pass: insight sections, “What it all means,” closing statement; shared CSS (`viz-chart`, disclaimers, big-picture / closing blocks).
  - README and in-page AI disclosure; code cleanup (shared helpers, single `DOMContentLoaded` entry).

### Phase 4 — Review & submission

- Cross-browser smoke test (`python3 -m http.server`), README/process documentation, contribution statement, final git tag on `main`.

---

## Team contributions

We split ownership by **phase and specialty**, with regular syncs so no section was single-author in practice. Everyone reviewed data filters, copy, and UI; everyone tested the local build before submission. Below is an honest split of **lead responsibilities**—each member also contributed across proposal writing, EDA, styling, debugging, and documentation.

| Member | Lead areas | Also contributed |
|--------|------------|------------------|
| **Andrew Zhang** | **Proposal & early research** — dataset comparison, motivating questions, milestone scope, initial story outline | Data file inventory, peer-feedback integration, README review, viz copy edits |
| **John Li** | **Primary mini-viz implementation & page cohesion** — tempo explorer/scatter, energy brush, mood heatmap, shared `script.js` structure, `index.html` narrative flow, CSS unification | Neighbor search UX review, data path wiring, disclaimer/status copy, final cleanup pass |
| **Ed Yun** | **3D neighbor visualization & genre viz (capstone)** — Plotly scatter3d, merge/dedupe logic, distance metric (energy + valence + normalized tempo), search UI, neighbor list | Energy/mood testing, axis/zoom behavior, mobile layout checks, README technical sections |
| **Jiho Lee** | **Visualization refinement & design polish** — interaction tweaks, heatmap/color scales, tempo toggle visibility, spacing/typography, insight & closing sections readability | Proposal diagrams/notes, EDA validation, cross-viz consistency, milestone → final regression testing |

**Equal contribution in practice:** Andrew anchored *why* we built this; John anchored *how the chapters connect*; Ed anchored the *final exploratory payoff*; Jiho anchored *whether it reads and feels right*. All four participated in data decisions, Git commits, milestone demo prep, and the post-milestone refactor.

---

## Tools & acknowledgments

- **D3.js** — 2D charts (scatter, brush, KDE, heatmap)
- **Plotly.js** — 3D neighbor scatter
- **Cursor, Google Gemini, ChatGPT** — drafting/debugging assistance (see footer on the live page); all code and claims were reviewed and edited by the team.

---

## License

See [LICENSE](LICENSE).
