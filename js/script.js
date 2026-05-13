/**
 * CMSC471 Final Project — interactive visualizations
 *
 * Entry: DOMContentLoaded → initNeighborViz, initTempoViz, initEnergyBrush, initMoodHeatmap
 * Data: CSVs under data/processed/ and data/raw/ (see README.md)
 * Requires: D3 v7, Plotly 2.x, page served over http(s)
 */

// --- Shared helpers (used by energy brush KDE) ---

/** Escape text for safe HTML insertion in tooltips and neighbor list rows. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Epanechnikov kernel for popularity KDE in the energy brush chart. */
function kernelEpanechnikov(bandwidth) {
  return (v) => {
    const u = v / bandwidth;
    return Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / bandwidth : 0;
  };
}

/** Kernel density estimate of popularity at each tick on the x-axis. */
function popularityDensity(values, xTicks, bandwidth) {
  const kernel = kernelEpanechnikov(bandwidth);
  const n = values.length;
  return xTicks.map((x) => ({
    x,
    density: d3.sum(values, (v) => kernel(x - v)) / n,
  }));
}

// --- 3D neighbor explorer (#mini-viz-neighbor) — Plotly scatter3d ---

/**
 * Capstone viz: merge English catalogs, search by title/artist, show 20 nearest
 * tracks by Euclidean distance in (energy, valence, normalized tempo).
 */
function initNeighborViz() {
  const NEIGHBOR_LANGUAGE = "English";
  const NEIGHBOR_SOURCES = [
    { path: "data/raw/spotify_tracks.csv", englishOnly: true },
    {
      path: "data/processed/analysis_ready_popular_tracks_all_years.csv",
      englishOnly: true,
    },
    {
      path: "data/processed/analysis_ready_popular_tracks_2015_2025.csv",
      englishOnly: true,
    },
    {
      path: "data/processed/analysis_ready_popular_artists_tracks_2015_2025.csv",
      englishOnly: false,
    },
  ];
  const TEMPO_MIN = 60;
  const TEMPO_RANGE = 220 - TEMPO_MIN; // scale tempo to ~0–1 so it matches energy/valence axes
  const BG_PLOT_MAX = 15000; // subsample background points for Plotly performance

  const searchInput = document.getElementById("nbr-search");
  const dropdown = document.getElementById("nbr-dropdown");
  const selectedInfo = document.getElementById("nbr-selected-info");
  const plotEl = document.getElementById("nbr-plot");
  const listEl = document.getElementById("nbr-list");

  if (!searchInput || !dropdown || !plotEl || !listEl) return;

  let tracks = [];
  let plotReady = false;
  let dropdownMatches = [];

  function parseNeighborRow(row, { englishOnly }) {
    if (englishOnly && Object.prototype.hasOwnProperty.call(row, "language")) {
      const language = String(row.language || "").trim();
      if (language !== NEIGHBOR_LANGUAGE) return null;
    }

    const energy = Number(row.energy);
    const valence = Number(row.valence);
    const tempo = Number(row.tempo);
    const popularity = Number(row.popularity);
    const year = Number(row.year);
    if (
      !row.track_id ||
      !Number.isFinite(energy) ||
      !Number.isFinite(valence) ||
      !Number.isFinite(tempo)
    ) {
      return null;
    }

    return {
      trackId: row.track_id,
      title: row.track_name || "Unknown",
      artist: row.artist_name || row.artists || "Unknown",
      energy,
      valence,
      tempo,
      popularity: Number.isFinite(popularity) ? Math.round(popularity) : 0,
      year: Number.isFinite(year) ? year : "N/A",
    };
  }

  function dedupeByTrackId(list) {
    const map = new Map();
    for (const t of list) {
      const prev = map.get(t.trackId);
      if (!prev || t.popularity > prev.popularity) map.set(t.trackId, t);
    }
    return Array.from(map.values());
  }

  function backgroundForPlot(sel, nbrIds) {
    const pool = tracks.filter((d) => d.trackId !== sel?.trackId && !nbrIds.has(d.trackId));
    if (pool.length <= BG_PLOT_MAX) return pool;
    const step = Math.ceil(pool.length / BG_PLOT_MAX);
    return pool.filter((_, i) => i % step === 0);
  }

  function titleKey(d) {
    return String(d.title || "")
      .trim()
      .toLowerCase();
  }

  /** Rank by 3D distance; skip duplicate titles so neighbors are distinct songs. */
  function nearest(target, n = 20) {
    const nt = (target.tempo - TEMPO_MIN) / TEMPO_RANGE;
    const seenTitles = new Set([titleKey(target)]);
    const ranked = tracks
      .filter((d) => d.trackId !== target.trackId)
      .map((d) => ({
        ...d,
        dist: Math.hypot(
          d.energy - target.energy,
          d.valence - target.valence,
          (d.tempo - TEMPO_MIN) / TEMPO_RANGE - nt
        ),
      }))
      .sort((a, b) => a.dist - b.dist);

    const out = [];
    for (const d of ranked) {
      const key = titleKey(d);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      out.push(d);
      if (out.length >= n) break;
    }
    return out;
  }

  function renderPlot(sel) {
    if (typeof Plotly === "undefined") return;

    const nbrs = sel ? nearest(sel) : [];
    const nbrIds = new Set(nbrs.map((d) => d.trackId));
    const bg = backgroundForPlot(sel, nbrIds);

    const tip = (d) =>
      `${esc(d.title)}<br>${esc(d.artist)}<br>Pop ${d.popularity} · ${d.year}`;

    const traces = [
      {
        type: "scatter3d",
        mode: "markers",
        name: "All tracks",
        x: bg.map((d) => d.energy),
        y: bg.map((d) => d.valence),
        z: bg.map((d) => d.tempo),
        text: bg.map(tip),
        hovertemplate: "%{text}<extra></extra>",
        marker: { size: bg.length > 8000 ? 1.5 : 2.5, color: "rgba(148,163,184,0.18)" },
      },
    ];

    if (nbrs.length) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Nearby",
        x: nbrs.map((d) => d.energy),
        y: nbrs.map((d) => d.valence),
        z: nbrs.map((d) => d.tempo),
        text: nbrs.map((d) => `${tip(d)}<br><em>dist ${d.dist.toFixed(3)}</em>`),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          size: 6,
          color: "#f472b6",
          opacity: 0.9,
          line: { color: "rgba(255,255,255,0.4)", width: 0.5 },
        },
      });
    }

    if (sel) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: sel.title,
        x: [sel.energy],
        y: [sel.valence],
        z: [sel.tempo],
        text: [
          `<b>${esc(sel.title)}</b><br>${esc(sel.artist)}<br>Pop ${sel.popularity} · ${sel.year}`,
        ],
        hovertemplate: "%{text}<extra></extra>",
        marker: { size: 13, color: "#fde047", opacity: 1, line: { color: "#fff", width: 1.5 } },
      });
    }

    const ax = {
      gridcolor: "rgba(255,255,255,0.09)",
      zerolinecolor: "rgba(255,255,255,0.14)",
      tickfont: { color: "#c4b5fd", size: 9, family: "Outfit, Segoe UI, sans-serif" },
      titlefont: { color: "#c4b5fd", size: 11, family: "Outfit, Segoe UI, sans-serif" },
    };

    const scene = {
      bgcolor: "rgba(15,23,42,0.55)",
      xaxis: { ...ax, title: "Energy", range: [0, 1], autorange: false },
      yaxis: { ...ax, title: "Valence (mood)", range: [0, 1], autorange: false },
      zaxis: { ...ax, title: "Tempo (BPM)" },
    };

    // Zoom tempo when a track is selected; energy and valence stay on 0–1
    if (sel && nbrs.length) {
      const pts = [sel, ...nbrs];
      const padT = 12;
      scene.zaxis.range = [
        Math.max(60, Math.min(...pts.map((d) => d.tempo)) - padT),
        Math.min(220, Math.max(...pts.map((d) => d.tempo)) + padT),
      ];
    }

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      scene,
      margin: { l: 0, r: 0, t: 10, b: 0 },
      showlegend: false,
      font: { family: "Outfit, Segoe UI, Arial, sans-serif", color: "#e9d5ff" },
    };

    if (plotReady) {
      Plotly.react(plotEl, traces, layout);
    } else {
      Plotly.newPlot(plotEl, traces, layout, { responsive: true, displayModeBar: false });
      plotReady = true;
    }

    renderList(sel, nbrs);
  }

  function renderList(sel, nbrs) {
    if (!sel) {
      listEl.innerHTML = '<p class="nbr-hint">Search for a track above to see its neighbors.</p>';
      return;
    }
    if (!nbrs.length) {
      listEl.innerHTML = '<p class="nbr-hint">No neighbors found in the dataset.</p>';
      return;
    }
    const rows = nbrs
      .map((d, i) => {
        const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          d.title + " " + d.artist
        )}`;
        return `<div class="nbr-row">
          <span class="nbr-rank">${i + 1}</span>
          <div class="nbr-info">
            <strong>${esc(d.title)}</strong>
            <span>${esc(d.artist)} · ${d.year}</span>
          </div>
          <div class="nbr-badges">
            <span>Pop ${d.popularity}</span>
            <span>${Math.round(d.tempo)} BPM</span>
          </div>
          <a href="${yt}" target="_blank" rel="noopener noreferrer" class="nbr-yt" title="Search on YouTube">▶</a>
        </div>`;
      })
      .join("");
    listEl.innerHTML = `<h4 class="nbr-list-title">20 nearest neighbors</h4>${rows}`;
  }

  function dedupeByTitle(list) {
    const map = new Map();
    for (const t of list) {
      const key = titleKey(t);
      const prev = map.get(key);
      if (!prev || t.popularity > prev.popularity) map.set(key, t);
    }
    return Array.from(map.values());
  }

  function showDropdown(q) {
    if (!q.trim()) {
      dropdown.hidden = true;
      return;
    }
    const ql = q.toLowerCase();
    dropdownMatches = dedupeByTitle(
      tracks.filter(
        (d) =>
          d.title.toLowerCase().includes(ql) || d.artist.toLowerCase().includes(ql)
      )
    ).slice(0, 12);
    if (!dropdownMatches.length) {
      dropdown.hidden = true;
      return;
    }
    dropdown.innerHTML = dropdownMatches
      .map(
        (d, i) =>
          `<div class="nbr-sugg" data-i="${i}" role="listitem" tabindex="-1">
            <span class="nbr-sugg-title">${esc(d.title)}</span>
            <span class="nbr-sugg-meta">${esc(d.artist)} · ${d.year}</span>
          </div>`
      )
      .join("");
    dropdown.hidden = false;
  }

  function pick(track) {
    searchInput.value = `${track.title} — ${track.artist}`;
    dropdown.hidden = true;
    if (selectedInfo) {
      selectedInfo.textContent = `Showing 20 unique titles nearest to "${track.title}" across ${tracks.length.toLocaleString()} merged English tracks.`;
    }
    renderPlot(track);
  }

  searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim()) {
      if (selectedInfo) selectedInfo.textContent = "";
      renderPlot(null);
    }
    showDropdown(searchInput.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dropdown.hidden = true;
  });

  dropdown.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".nbr-sugg");
    if (item) pick(dropdownMatches[Number(item.dataset.i)]);
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
    }
  });

  Promise.all(NEIGHBOR_SOURCES.map((source) => d3.csv(source.path)))
    .then((results) => {
      const parsed = [];
      results.forEach((rows, i) => {
        const source = NEIGHBOR_SOURCES[i];
        for (const row of rows) {
          const track = parseNeighborRow(row, source);
          if (track) parsed.push(track);
        }
      });
      tracks = dedupeByTrackId(parsed);

      if (tracks.length) {
        renderPlot(null);
      } else {
        plotEl.textContent = `No ${NEIGHBOR_LANGUAGE} tracks found in the merged catalogs.`;
      }
    })
    .catch(() => {
      plotEl.textContent =
        "Could not load data. Serve the page over http(s) (e.g. python -m http.server).";
    });
}

// --- Tempo section (#mini-viz-1) — track explorer + scatter toggle ---

/**
 * Two linked views: vertical BPM slider picks nearest track from artist slice;
 * scatter mode plots tempo vs popularity for the broader 2015–2025 hit set.
 */
function initTempoViz() {
  const slider = document.getElementById("tempo-slider");
  const songTitle = document.getElementById("song-title");
  const songArtist = document.getElementById("song-artist");
  const songMetrics = document.getElementById("song-metrics");
  const audioNote = document.getElementById("audio-note");
  const tempoInput = document.getElementById("tempo-input");
  const youtubeLink = document.getElementById("youtube-link");
  const popularityBubble = document.getElementById("popularity-bubble");
  const popularityLabel = document.getElementById("popularity-label");
  const fillTrack = document.getElementById("tempo-fill-track");
  const tempoVizDescription = document.getElementById("tempo-viz-description");
  const tempoViewExplorerBtn = document.getElementById("tempo-view-explorer");
  const tempoViewScatterBtn = document.getElementById("tempo-view-scatter");
  const tempoExplorerPanel = document.getElementById("tempo-view-explorer-panel");
  const tempoScatterPanel = document.getElementById("tempo-view-scatter-panel");
  const tempoScatterChart = document.getElementById("tempo-scatter-chart");
  const tempoScatterStatus = document.getElementById("tempo-scatter-status");

  if (
    !slider ||
    !songTitle ||
    !songArtist ||
    !songMetrics ||
    !audioNote ||
    !tempoInput ||
    !youtubeLink ||
    !popularityBubble ||
    !popularityLabel ||
    !fillTrack ||
    !tempoViewExplorerBtn ||
    !tempoViewScatterBtn ||
    !tempoExplorerPanel ||
    !tempoScatterPanel ||
    !tempoScatterChart
  ) {
    return;
  }

  const dataPath = "data/processed/analysis_ready_popular_artists_tracks_2015_2025.csv";
  const scatterDataPath = "data/processed/analysis_ready_popular_tracks_2015_2025.csv";
  let songs = [];
  let scatterSongs = [];
  let isDataLoaded = false;
  let isScatterDataLoaded = false;
  let suppressInputSync = false;
  let tempoView = "explorer";

  const tempoDescriptions = {
    explorer:
      "Drag the tempo slider to explore tracks across BPM ranges and test whether higher speed consistently aligns with higher popularity.",
    scatter:
      "Each dot is one popular track from 2015–2025 in our dataset. Scan whether faster tempos cluster at higher Spotify popularity—or whether the cloud stays messy.",
  };

  youtubeLink.classList.add("disabled");
  youtubeLink.href = "#";
  songTitle.textContent = "Loading songs...";
  songArtist.textContent = "Preparing dataset for Mini Viz 1.";
  songMetrics.textContent = "Tempo: -- | Popularity: -- | Year: --";
  audioNote.textContent = "YouTube links are generated from song title + artist.";

  function buildYouTubeSearchUrl(song) {
    const query = `${song.title} ${song.artist} official audio`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  function getNearestSong(targetTempo) {
    return songs.reduce((closest, current) => {
      const currentDistance = Math.abs(current.tempo - targetTempo);
      const closestDistance = Math.abs(closest.tempo - targetTempo);
      return currentDistance < closestDistance ? current : closest;
    });
  }

  function updateThumbSize(value) {
    const minTempo = Number(slider.min);
    const maxTempo = Number(slider.max);
    const ratio = (value - minTempo) / (maxTempo - minTempo);
    const fillHeight = 10 + ratio * 320;
    fillTrack.style.height = `${fillHeight}px`;
  }

  function updateSongPanel(song, selectedTempo) {
    songTitle.textContent = song.title;
    songArtist.textContent = `Artist: ${song.artist}`;
    songMetrics.textContent = `Selected tempo: ${selectedTempo} BPM | Song tempo: ${Math.round(song.tempo)} BPM | Popularity: ${song.popularity} | Year: ${song.year}`;
    youtubeLink.href = buildYouTubeSearchUrl(song);
    youtubeLink.classList.remove("disabled");
    audioNote.textContent = "Click Open on YouTube to hear this track.";

    const minBubble = 14;
    const maxBubble = 175;
    const minPopularity = 45;
    const maxPopularity = 100;
    const clampedPopularity = Math.max(minPopularity, Math.min(maxPopularity, song.popularity));
    const scaled = (clampedPopularity - minPopularity) / (maxPopularity - minPopularity);
    const bubbleSize = minBubble + scaled * (maxBubble - minBubble);
    popularityBubble.style.width = `${bubbleSize}px`;
    popularityBubble.style.height = `${bubbleSize}px`;
    popularityLabel.textContent = `Popularity bubble: ${song.popularity}/100`;
  }

  function renderTempoScatter() {
    if (!scatterSongs.length) {
      if (tempoScatterStatus) {
        tempoScatterStatus.textContent = isScatterDataLoaded
          ? "No popular 2015–2025 tracks with tempo and popularity to plot."
          : "Loading chart…";
      }
      return;
    }

    const margin = { top: 16, right: 18, bottom: 48, left: 52 };
    const height = 520;
    const width = Math.max(320, tempoScatterChart.clientWidth || 640);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(tempoScatterChart).selectAll("*").remove();

    const svg = d3
      .select(tempoScatterChart)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xMax = d3.max(scatterSongs, (d) => d.tempo) ?? 200;
    const plotSongs = scatterSongs.filter((d) => d.tempo >= 40);

    const x = d3
      .scaleLinear()
      .domain([40, xMax])
      .nice()
      .range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([45, 100])
      .range([innerH, 0]);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat((d) => Math.round(d)));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 38)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 11)
      .text("Tempo (BPM, from 40)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 11)
      .text("Spotify popularity (45–100)");

    g.selectAll("circle.scatter-dot")
      .data(plotSongs)
      .join("circle")
      .attr("class", "scatter-dot")
      .attr("cx", (d) => x(d.tempo))
      .attr("cy", (d) => y(d.popularity))
      .attr("r", 4.5)
      .attr("fill", "rgba(244, 114, 182, 0.45)")
      .attr("stroke", "rgba(255, 255, 255, 0.12)")
      .attr("stroke-width", 0.5)
      .append("title")
      .text((d) => `${d.title} — ${d.artist}\n${Math.round(d.tempo)} BPM · Pop ${d.popularity}`);

    if (tempoScatterStatus) {
      tempoScatterStatus.textContent = `${plotSongs.length.toLocaleString()} popular tracks (2015–2025, tempo ≥ 40 BPM, popularity ≥ 45).`;
    }
  }

  function setTempoView(view) {
    tempoView = view;
    const explorerActive = view === "explorer";

    tempoViewExplorerBtn.classList.toggle("is-active", explorerActive);
    tempoViewScatterBtn.classList.toggle("is-active", !explorerActive);
    tempoViewExplorerBtn.setAttribute("aria-selected", String(explorerActive));
    tempoViewScatterBtn.setAttribute("aria-selected", String(!explorerActive));

    tempoExplorerPanel.hidden = !explorerActive;
    tempoScatterPanel.hidden = explorerActive;

    if (tempoVizDescription) {
      tempoVizDescription.textContent = tempoDescriptions[view];
    }

    if (!explorerActive) {
      renderTempoScatter();
    }
  }

  tempoViewExplorerBtn.addEventListener("click", () => setTempoView("explorer"));
  tempoViewScatterBtn.addEventListener("click", () => setTempoView("scatter"));

  function refreshSelection() {
    if (!isDataLoaded || songs.length === 0) {
      return;
    }
    const selectedTempo = Number(slider.value);
    if (!suppressInputSync) {
      tempoInput.value = String(selectedTempo);
    }
    updateThumbSize(selectedTempo);
    updateSongPanel(getNearestSong(selectedTempo), selectedTempo);
  }

  slider.addEventListener("input", refreshSelection);
  tempoInput.addEventListener("input", () => {
    const raw = Number(tempoInput.value);
    if (!Number.isFinite(raw)) {
      return;
    }
    const minTempo = Number(slider.min);
    const maxTempo = Number(slider.max);
    const clamped = Math.max(minTempo, Math.min(maxTempo, Math.round(raw)));
    suppressInputSync = true;
    slider.value = String(clamped);
    suppressInputSync = false;
    refreshSelection();
  });

  refreshSelection();

  d3.csv(scatterDataPath)
    .then((rows) => {
      scatterSongs = rows
        .map((row) => {
          const tempo = Number(row.tempo);
          const popularity = Number(row.popularity);
          if (!Number.isFinite(tempo) || !Number.isFinite(popularity) || !row.track_id) {
            return null;
          }
          return {
            trackId: row.track_id,
            title: row.track_name || "Unknown title",
            artist: row.artist_name || "Unknown artist",
            tempo,
            popularity: Math.round(popularity),
          };
        })
        .filter(Boolean);
      isScatterDataLoaded = true;
      if (tempoView === "scatter") {
        renderTempoScatter();
      } else if (tempoScatterStatus) {
        tempoScatterStatus.textContent = `${scatterSongs.length.toLocaleString()} tracks ready—open Tempo vs popularity to view.`;
      }
    })
    .catch(() => {
      isScatterDataLoaded = true;
      if (tempoScatterStatus) {
        tempoScatterStatus.textContent = "Could not load popular 2015–2025 tracks for the scatter plot.";
      }
    });

  d3.csv(dataPath)
    .then((rows) => {
      songs = rows
        .map((row) => {
          const tempo = Number(row.tempo);
          const popularity = Number(row.popularity);
          const year = Number(row.year);
          if (!Number.isFinite(tempo) || !Number.isFinite(popularity) || !row.track_id) {
            return null;
          }
          return {
            trackId: row.track_id,
            title: row.track_name || "Unknown title",
            artist: row.artist_name || "Unknown artist",
            tempo,
            popularity: Math.round(popularity),
            year: Number.isFinite(year) ? year : "N/A",
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.tempo - b.tempo);

      isDataLoaded = songs.length > 0;
      if (!isDataLoaded) {
        songTitle.textContent = "No rows loaded";
        songArtist.textContent = "The curated CSV was found but no valid tracks were parsed.";
        songMetrics.textContent = "Check data values in the CSV.";
        audioNote.textContent = "Tempo slider is disabled until data is available.";
        slider.disabled = true;
        return;
      }

      refreshSelection();
    })
    .catch(() => {
      songTitle.textContent = "Data failed to load";
      songArtist.textContent = "Run with a local server and confirm the CSV path exists.";
      songMetrics.textContent = "Expected file: data/processed/analysis_ready_popular_artists_tracks_2015_2025.csv";
      audioNote.textContent = "Try: python3 -m http.server then open the page from localhost.";
      slider.disabled = true;
    });
}

// --- Energy section (#mini-viz-energy) — brush histogram → popularity KDE ---

/** Linked brush: filter tracks by energy bin, redraw popularity density on the right. */
function initEnergyBrush() {
  const brushChart = document.getElementById("energy-brush-chart");
  const popChart = document.getElementById("energy-pop-chart");
  const statusEl = document.getElementById("energy-brush-status");
  if (!brushChart || !popChart) return;

  const dataPath = "data/processed/analysis_ready_popular_tracks_2015_2025.csv";
  let songs = [];
  let brushX = null;

  function renderPopDensity(subset) {
    const margin = { top: 12, right: 12, bottom: 40, left: 48 };
    const height = 360;
    const width = Math.max(260, popChart.clientWidth || 400);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(popChart).selectAll("*").remove();

    const svg = d3
      .select(popChart)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([45, 100]).range([0, innerW]);

    if (!subset.length) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#94a3b8")
        .attr("font-size", 12)
        .text("No tracks in this brush");
      return;
    }

    const values = subset.map((d) => d.popularity);
    const xTicks = d3.range(45, 100.25, 0.5);
    const bandwidth = 4; // KDE smoothness on popularity axis (45–100)
    const series = popularityDensity(values, xTicks, bandwidth);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(series, (d) => d.density) || 0.01])
      .nice()
      .range([innerH, 0]);

    const area = d3
      .area()
      .curve(d3.curveBasis)
      .x((d) => x(d.x))
      .y0(innerH)
      .y1((d) => y(d.density));

    g.append("path")
      .datum(series)
      .attr("fill", "rgba(244, 114, 182, 0.55)")
      .attr("stroke", "rgba(244, 114, 182, 0.95)")
      .attr("stroke-width", 1.5)
      .attr("d", area);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => d3.format(".2f")(d)));

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 32)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 10)
      .text("Spotify popularity (45–100)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 10)
      .text("Density (area = 100%)");
  }

  function updateStatus(e0, e1, subset) {
    if (!statusEl) return;
    if (!subset.length) {
      statusEl.textContent = `No tracks between energy ${e0.toFixed(2)} and ${e1.toFixed(2)}. Widen the brush.`;
      return;
    }
    const medianPop = d3.median(subset, (d) => d.popularity);
    statusEl.textContent = `${subset.length.toLocaleString()} tracks with energy ${e0.toFixed(2)}–${e1.toFixed(2)} · median popularity ${medianPop?.toFixed(0) ?? "—"}. If energy “explained” hits, this density curve would sharpen as you brush higher—it usually doesn’t.`;
  }

  function applyBrushRange(e0, e1) {
    const lo = Math.max(0, Math.min(e0, e1));
    const hi = Math.min(1, Math.max(e0, e1));
    const subset = songs.filter((d) => d.energy >= lo && d.energy <= hi);
    renderPopDensity(subset);
    updateStatus(lo, hi, subset);
  }

  function brushed(event) {
    if (!brushX) return;
    if (!event.selection) {
      applyBrushRange(0, 1);
      return;
    }
    const [x0, x1] = event.selection.map(brushX.invert);
    applyBrushRange(x0, x1);
  }

  function renderEnergyBrush() {
    const margin = { top: 10, right: 12, bottom: 36, left: 40 };
    const height = 260;
    const width = Math.max(260, brushChart.clientWidth || 400);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(brushChart).selectAll("*").remove();

    const svg = d3
      .select(brushChart)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const energyBins = d3.bin().domain([0, 1]).thresholds(20);
    const binned = energyBins(songs.map((d) => d.energy));

    brushX = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(binned, (d) => d.length) || 1])
      .nice()
      .range([innerH, 0]);

    g.selectAll("rect.energy-bar")
      .data(binned)
      .join("rect")
      .attr("class", "energy-bar")
      .attr("x", (d) => brushX(d.x0) + 1)
      .attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(0, brushX(d.x1) - brushX(d.x0) - 2))
      .attr("height", (d) => innerH - y(d.length))
      .attr("fill", "rgba(56, 189, 248, 0.65)")
      .attr("rx", 2);

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(brushX).ticks(6));

    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on("end", brushed);

    const brushLayer = g.append("g").attr("class", "brush").call(brush);
    brushLayer.call(brush.move, [brushX(0.55), brushX(1)]);

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 28)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 10)
      .text("Energy (0–1) · double-click brush to reset");

    brushLayer.on("dblclick", () => {
      brushLayer.call(brush.move, [brushX(0), brushX(1)]);
      applyBrushRange(0, 1);
    });

    applyBrushRange(0.55, 1);
  }

  d3.csv(dataPath)
    .then((rows) => {
      songs = rows
        .map((row) => {
          const energy = Number(row.energy);
          const popularity = Number(row.popularity);
          if (!Number.isFinite(energy) || !Number.isFinite(popularity) || !row.track_id) {
            return null;
          }
          return { energy, popularity: Math.round(popularity) };
        })
        .filter(Boolean);

      if (!songs.length) {
        if (statusEl) {
          statusEl.textContent = "No popular 2015–2025 tracks with energy and popularity to plot.";
        }
        return;
      }

      renderEnergyBrush();
    })
    .catch(() => {
      if (statusEl) {
        statusEl.textContent = "Could not load popular 2015–2025 tracks for the energy brush chart.";
      }
    });
}

// --- Mood / valence section (#mini-viz-mood) — valence × energy heatmap ---

/**
 * 10×10 bins over valence and energy; cell color = median popularity.
 * Cells with fewer than MIN_CELL_COUNT tracks are hidden to avoid noisy pockets.
 */
function initMoodHeatmap() {
  const chartEl = document.getElementById("mood-heatmap-chart");
  const readoutEl = document.getElementById("mood-heatmap-readout");
  const statusEl = document.getElementById("mood-heatmap-status");
  if (!chartEl) return;

  const dataPath = "data/processed/analysis_ready_popular_tracks_2015_2025.csv";
  const BIN_STEP = 0.1;
  const POP_MIN = 45;
  const POP_MAX = 100;
  const MIN_CELL_COUNT = 8; // omit sparse bins from the heatmap

  function featureBinIndex(value) {
    const idx = Math.floor(value / BIN_STEP);
    return Math.max(0, Math.min(9, idx));
  }

  function binLabel(i) {
    const lo = (i * BIN_STEP).toFixed(1);
    const hi = Math.min(1, (i + 1) * BIN_STEP).toFixed(1);
    return `${lo}–${hi}`;
  }

  function paddedColorExtent(extent) {
    const span = extent[1] - extent[0];
    const pad = Math.max(2.5, span * 0.1);
    return [Math.max(POP_MIN, extent[0] - pad), Math.min(POP_MAX, extent[1] + pad)];
  }

  function buildCells(songs) {
    const buckets = new Map();

    for (const song of songs) {
      const vi = featureBinIndex(song.valence);
      const ei = featureBinIndex(song.energy);
      const key = `${vi},${ei}`;
      if (!buckets.has(key)) {
        buckets.set(key, { vi, ei, pops: [] });
      }
      buckets.get(key).pops.push(song.popularity);
    }

    const cells = [];
    for (let vi = 0; vi < 10; vi += 1) {
      for (let ei = 0; ei < 10; ei += 1) {
        const bucket = buckets.get(`${vi},${ei}`);
        const pops = bucket?.pops ?? [];
        cells.push({
          vi,
          ei,
          count: pops.length,
          median: pops.length ? d3.median(pops) : null,
        });
      }
    }
    return cells;
  }

  function renderHeatmap(songs) {
    const cells = buildCells(songs);
    const ranked = cells.filter((d) => d.median != null && d.count >= MIN_CELL_COUNT);
    const dataExtent = ranked.length ? d3.extent(ranked, (d) => d.median) : [POP_MIN, POP_MAX];
    const popExtent = paddedColorExtent(dataExtent);

    const margin = { top: 16, right: 88, bottom: 52, left: 80 };
    const height = 580;
    const width = Math.max(340, chartEl.clientWidth || 640);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(chartEl).selectAll("*").remove();

    const svg = d3
      .select(chartEl)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(d3.range(10))
      .range([0, innerW])
      .padding(0.04);
    const y = d3
      .scaleBand()
      .domain(d3.range(10))
      .range([innerH, 0])
      .padding(0.04);

    const color = d3
      .scaleSequential()
      .domain([popExtent[0], popExtent[1]])
      .interpolator(d3.interpolateRgbBasis(["#1e1b4b", "#6366f1", "#f472b6", "#fde047"]));

    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "mood-heat-legend")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");
    d3.range(0, 1.01, 0.1).forEach((t) => {
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(popExtent[0] + t * (popExtent[1] - popExtent[0])));
    });

    g.selectAll("rect.heatmap-cell")
      .data(cells)
      .join("rect")
      .attr("class", "heatmap-cell")
      .attr("x", (d) => x(d.vi))
      .attr("y", (d) => y(d.ei))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", (d) => {
        if (d.median == null || d.count < MIN_CELL_COUNT) {
          return "rgba(30, 41, 59, 0.55)";
        }
        return color(d.median);
      })
      .attr("rx", 2)
      .on("mouseenter", function onEnter(_event, d) {
        d3.selectAll(".heatmap-cell").classed("is-active", false);
        d3.select(this).classed("is-active", true);
        if (!readoutEl) return;
        if (!d.count) {
          readoutEl.textContent = `Valence ${binLabel(d.vi)} · Energy ${binLabel(d.ei)} · no tracks in this pocket.`;
          return;
        }
        if (d.count < MIN_CELL_COUNT) {
          readoutEl.textContent = `Valence ${binLabel(d.vi)} · Energy ${binLabel(d.ei)} · only ${d.count} tracks (too few for a stable median).`;
          return;
        }
        readoutEl.textContent = `Valence ${binLabel(d.vi)} · Energy ${binLabel(d.ei)} · median popularity ${Math.round(d.median)} · ${d.count.toLocaleString()} tracks.`;
      })
      .on("mouseleave", () => {
        d3.selectAll(".heatmap-cell").classed("is-active", false);
        if (readoutEl) readoutEl.textContent = "";
      })
      .append("title")
      .text((d) => {
        if (!d.count) {
          return `${binLabel(d.vi)} valence · ${binLabel(d.ei)} energy · no tracks`;
        }
        if (d.median == null || d.count < MIN_CELL_COUNT) {
          return `${binLabel(d.vi)} valence · ${binLabel(d.ei)} energy · ${d.count} tracks`;
        }
        return `${binLabel(d.vi)} valence · ${binLabel(d.ei)} energy · median pop ${Math.round(d.median)} · ${d.count} tracks`;
      });

    g.selectAll("text.heatmap-label")
      .data(cells.filter((d) => d.median != null && d.count >= MIN_CELL_COUNT))
      .join("text")
      .attr("class", "heatmap-label")
      .attr("x", (d) => x(d.vi) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.ei) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d.median >= (popExtent[0] + popExtent[1]) / 2 ? "#0f172a" : "#f8fafc"))
      .attr("font-size", 10)
      .attr("font-weight", 600)
      .attr("pointer-events", "none")
      .text((d) => Math.round(d.median));

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((i) => (Number(i) % 2 === 0 ? binLabel(i) : ""))
          .tickSizeOuter(0)
      );

    g.append("g")
      .attr("class", "axis")
      .call(
        d3
          .axisLeft(y)
          .tickFormat((i) => binLabel(i))
          .tickSizeOuter(0)
      );

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 11)
      .text("Valence / mood (0 = subdued → 1 = sunnier)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 11)
      .text("Energy (0 = calm → 1 = intense)");

    const legendH = innerH;
    const legendW = 12;
    const legendX = innerW + 28;
    const legend = g.append("g").attr("transform", `translate(${legendX},0)`);
    const legendScale = d3
      .scaleLinear()
      .domain([popExtent[0], popExtent[1]])
      .range([legendH, 0]);

    legend
      .append("rect")
      .attr("width", legendW)
      .attr("height", legendH)
      .attr("fill", "url(#mood-heat-legend)")
      .attr("rx", 3);

    legend
      .append("g")
      .attr("transform", `translate(${legendW + 6},0)`)
      .call(d3.axisRight(legendScale).ticks(5).tickFormat(d3.format("d")));

    legend
      .append("text")
      .attr("x", legendW / 2)
      .attr("y", -8)
      .attr("text-anchor", "middle")
      .attr("fill", "#c4b5fd")
      .attr("font-size", 9)
      .text("Median pop");

    if (statusEl) {
      statusEl.textContent = `${songs.length.toLocaleString()} tracks (2015–2025) · color = median popularity · no clear sweep toward sunnier valence.`;
    }
  }

  d3.csv(dataPath)
    .then((rows) => {
      const songs = rows
        .map((row) => {
          const valence = Number(row.valence);
          const energy = Number(row.energy);
          const popularity = Number(row.popularity);
          if (
            !Number.isFinite(valence) ||
            !Number.isFinite(energy) ||
            !Number.isFinite(popularity) ||
            !row.track_id
          ) {
            return null;
          }
          return { valence, energy, popularity: Math.round(popularity) };
        })
        .filter(Boolean);

      if (!songs.length) {
        if (statusEl) {
          statusEl.textContent = "No popular 2015–2025 tracks with valence, energy, and popularity to plot.";
        }
        return;
      }

      renderHeatmap(songs);
    })
    .catch(() => {
      if (statusEl) {
        statusEl.textContent = "Could not load popular 2015–2025 tracks for the mood heatmap.";
      }
    });
}

// --- Bootstrap all visualizations once the DOM is ready ---

document.addEventListener("DOMContentLoaded", () => {
  initNeighborViz();
  initTempoViz();
  initEnergyBrush();
  initMoodHeatmap();
});
