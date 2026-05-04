"""Merge track_genre from dataset.csv into popular tracks by track_id."""
import csv
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
pop_path = BASE / "data" / "processed" / "analysis_ready_popular_tracks_2015_2025.csv"
ds_path = BASE / "data" / "raw" / "dataset.csv"
out_path = BASE / "data" / "processed" / "analysis_ready_popular_tracks_2015_2025_genre.csv"

pop_ids = set()
rows_pop = []
with open(pop_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        pop_ids.add(row["track_id"])
        rows_pop.append(row)

genre_map = {}
with open(ds_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        tid = row.get("track_id", "")
        if tid in pop_ids and tid not in genre_map:
            g = (row.get("track_genre") or "").strip()
            if g:
                genre_map[tid] = g

fieldnames = list(rows_pop[0].keys()) + ["genre"]
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows_pop:
        out = dict(row)
        out["genre"] = genre_map.get(row["track_id"], "")
        writer.writerow(out)

n_genre = sum(1 for row in rows_pop if genre_map.get(row["track_id"]))
print(f"Wrote {out_path} ({len(rows_pop)} rows, {n_genre} with genre)")
