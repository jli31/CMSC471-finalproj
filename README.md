# CMSC471-finalproj

## Data Setup

This repo uses local Kaggle datasets for Spotify analytics. We commit `data/raw/` snapshots so collaborators all use the same files.

No Kaggle CLI setup or API token is required.
Just pull the repository and use files in `data/raw/`.

Committed datasets in `data/raw/`:

- `rohiteng/spotify-music-analytics-dataset-20152025`
- `gauthamvijayaraj/spotify-tracks-dataset-updated-every-week`
- `maharshipandya/-spotify-tracks-dataset`
- `tomigelo/spotify-audio-features`


Recs from classmates:
SquirrelMap: there's a lot of quantitative data metrics that can measure factors like mood in music over time. observing over time with a slider is a great and intuitive idea! if the team considers looking at global music, they could make use of a map structure!

MusicGenre: Dataset seems very rich for plotting different metrics, and I like the idea of creating a map that displays the development of genres with an interactive slider/dropdown. Creating the context for the visualization for generated metrics like energy might be difficult, and will probably require explanations for viewers. 

BasketballEvol: I like the idea of looking through how music has changed over time, but I encourage the group to explore the types of visualizations they want to use further


Concrete concept you can build
1) “The Sound of Spotify, 2015–2025” (main narrative)
Visual A: Timeline + area/line chart of average audio features by year (danceability, energy, valence, acousticness, etc.)
Visual B: Genre/artist scatterplot (e.g., energy vs valence, color by genre, size by popularity)
Visual C: Popularity threshold panel (simple model-like explainer: what feature ranges appear in top songs)
Interaction linkage: brushing/selecting a year or genre in one chart filters/highlights all others
2) “What changed during specific eras?”
Add annotation bands for years/events (e.g., pandemic era, TikTok boom)
Reader can scrub through years and see feature distributions morph in real time
3) “Myth-checker” mini panels
Short claim cards with tiny interactive plots:

“Are faster songs more popular?”
“Do happier songs trend up?”
“Did songs get shorter over time?”
This keeps text minimal and visual-first, like the MBTA example’s layered exploration style (MBTA Viz).

Why this satisfies the assignment well
Complex idea explained: popularity is multi-factor, shifts over time, genre-dependent
Interactive diagrams + annotations: exactly what they asked
Low-risk implementation: all data local CSV, no API auth issues
Strong storytelling arc: intro claim → evidence panels → interactive deep dive → conclusion
Suggested page structure
Section 1: 1-screen hook chart + one sentence takeaway
Section 2: linked exploratory dashboard (2–3 coordinated visuals)
Section 3: annotated “what changed over time”
Section 4: myth-check cards + final summary
If you want, next step
I can sketch a specific MVP build plan (what to finish in 3 days): exact 3 charts, what columns to use, and which D3 interactions to implement first.




Recommended flow
Mini Viz 1: Tempo vs Popularity
One question: “Are faster songs more popular?”
Simple scatter or binned line
1 sentence takeaway beside it
Mini Viz 2: Mood Shift Over Time
Line chart for valence (and maybe energy) by year
Annotate 1–2 notable periods
Mini Viz 3: Danceability + Energy space
Small 2D density/hex/scatter
Highlight where top-popularity tracks cluster
Mini Viz 4: Duration trend
Track length vs year (or histogram by era)
Quick myth-buster takeaway
Final Main Visualization (capstone)
Large linked view combining:
year slider
genre filter
scatter (energy x valence, size=popularity)
side panel with summary stats
Narrative prompt: “Given an era + genre, what audio profile predicts higher popularity?”
Why this is strong
Each mini chart is cognitively light.
Final chart feels earned (reader already learned axes/features).
Minimal text needed; annotations do the teaching.