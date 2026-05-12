document.addEventListener("DOMContentLoaded", () => {
  const NEIGHBOR_DATA = "data/processed/analysis_ready_popular_tracks_2015_2025.csv";
  const TEMPO_MIN = 60;
  const TEMPO_RANGE = 220 - TEMPO_MIN;

  const searchInput = document.getElementById("nbr-search");
  const dropdown = document.getElementById("nbr-dropdown");
  const selectedInfo = document.getElementById("nbr-selected-info");
  const plotEl = document.getElementById("nbr-plot");
  const listEl = document.getElementById("nbr-list");

  if (!searchInput || !dropdown || !plotEl || !listEl) return;

  let tracks = [];
  let plotReady = false;
  let dropdownMatches = [];

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nearest(target, n = 20) {
    const nt = (target.tempo - TEMPO_MIN) / TEMPO_RANGE;
    return tracks
      .filter((d) => d.trackId !== target.trackId)
      .map((d) => ({
        ...d,
        dist: Math.hypot(
          d.energy - target.energy,
          d.valence - target.valence,
          (d.tempo - TEMPO_MIN) / TEMPO_RANGE - nt
        ),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, n);
  }

  function renderPlot(sel) {
    if (typeof Plotly === "undefined") return;

    const nbrs = sel ? nearest(sel) : [];
    const nbrIds = new Set(nbrs.map((d) => d.trackId));
    const bg = tracks.filter((d) => d.trackId !== sel?.trackId && !nbrIds.has(d.trackId));

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
        marker: { size: 2.5, color: "rgba(148,163,184,0.22)" },
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
      xaxis: { ...ax, title: "Energy" },
      yaxis: { ...ax, title: "Valence (mood)" },
      zaxis: { ...ax, title: "Tempo (BPM)" },
    };

    // Zoom to the neighborhood when a track is selected
    if (sel && nbrs.length) {
      const pts = [sel, ...nbrs];
      const pad = 0.07;
      const padT = 12;
      scene.xaxis.range = [
        Math.max(0, Math.min(...pts.map((d) => d.energy)) - pad),
        Math.min(1, Math.max(...pts.map((d) => d.energy)) + pad),
      ];
      scene.yaxis.range = [
        Math.max(0, Math.min(...pts.map((d) => d.valence)) - pad),
        Math.min(1, Math.max(...pts.map((d) => d.valence)) + pad),
      ];
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

  function showDropdown(q) {
    if (!q.trim()) {
      dropdown.hidden = true;
      return;
    }
    const ql = q.toLowerCase();
    dropdownMatches = tracks
      .filter(
        (d) =>
          d.title.toLowerCase().includes(ql) || d.artist.toLowerCase().includes(ql)
      )
      .slice(0, 12);
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
      selectedInfo.textContent = `Showing 20 tracks nearest to "${track.title}" in energy × mood × tempo.`;
    }
    renderPlot(track);
  }

  searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim()) {
      selectedTrack = null;
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

  d3.csv(NEIGHBOR_DATA)
    .then((rows) => {
      tracks = rows
        .map((row) => {
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
            artist: row.artist_name || "Unknown",
            energy,
            valence,
            tempo,
            popularity: Number.isFinite(popularity) ? Math.round(popularity) : 0,
            year: Number.isFinite(year) ? year : "N/A",
          };
        })
        .filter(Boolean);

      if (tracks.length) {
        renderPlot(null);
      }
    })
    .catch(() => {
      plotEl.textContent =
        "Could not load data. Serve the page over http(s) (e.g. python -m http.server).";
    });
});

document.addEventListener("DOMContentLoaded", () => {
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
    !fillTrack
  ) {
    return;
  }

  const dataPath = "data/processed/analysis_ready_popular_artists_tracks_2015_2025.csv";
  let songs = [];
  let selectedSong = null;
  let isDataLoaded = false;
  let suppressInputSync = false;

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
    const fillHeight = 10 + ratio * 212;
    fillTrack.style.height = `${fillHeight}px`;
  }

  function updateSongPanel(song, selectedTempo) {
    songTitle.textContent = song.title;
    songArtist.textContent = `Artist: ${song.artist}`;
    songMetrics.textContent = `Selected tempo: ${selectedTempo} BPM | Song tempo: ${Math.round(song.tempo)} BPM | Popularity: ${song.popularity} | Year: ${song.year}`;
    youtubeLink.href = buildYouTubeSearchUrl(song);
    youtubeLink.classList.remove("disabled");
    audioNote.textContent = "Click Open on YouTube to hear this track.";

    const minBubble = 10;
    const maxBubble = 126;
    const minPopularity = 45;
    const maxPopularity = 100;
    const clampedPopularity = Math.max(minPopularity, Math.min(maxPopularity, song.popularity));
    const scaled = (clampedPopularity - minPopularity) / (maxPopularity - minPopularity);
    const bubbleSize = minBubble + scaled * (maxBubble - minBubble);
    popularityBubble.style.width = `${bubbleSize}px`;
    popularityBubble.style.height = `${bubbleSize}px`;
    popularityLabel.textContent = `Popularity bubble: ${song.popularity}/100`;
  }

  function refreshSelection() {
    if (!isDataLoaded || songs.length === 0) {
      return;
    }
    const selectedTempo = Number(slider.value);
    if (!suppressInputSync) {
      tempoInput.value = String(selectedTempo);
    }
    selectedSong = getNearestSong(selectedTempo);
    updateThumbSize(selectedTempo);
    updateSongPanel(selectedSong, selectedTempo);
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
});
