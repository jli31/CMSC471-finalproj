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
