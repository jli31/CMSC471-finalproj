/* global d3 */
const DATA_MAIN = "data/processed/analysis_ready_popular_tracks_2015_2025_genre.csv";

const YEAR_MIN = 2015;
const YEAR_MAX = 2025;

const state = {
  year0: YEAR_MIN,
  year1: YEAR_MAX,
  genre: "all",
  eraYear: 2020,
};

let allTracks = [];
let categoryTopKeys = [];
let colorScale = d3.scaleOrdinal(d3.schemeTableau10);

function chartTooltip() {
  let t = d3.select("#viz-tooltip");
  if (t.empty()) {
    t = d3
      .select("body")
      .append("div")
      .attr("id", "viz-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "rgba(15,23,42,0.92)")
      .style("color", "#f5f3ff")
      .style("padding", "6px 10px")
      .style("border-radius", "8px")
      .style("font-size", "12px")
      .style("border", "1px solid rgba(255,255,255,0.2)")
      .style("opacity", 0)
      .style("z-index", 50);
  }
  return t;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoryOf(d) {
  const g = (d.genre || "").trim();
  if (g) return g;
  return d.language || "Unknown";
}

function filtered() {
  return allTracks.filter((d) => {
    if (d.year < state.year0 || d.year > state.year1) return false;
    if (state.genre !== "all" && categoryOf(d) !== state.genre) return false;
    return true;
  });
}

function parseMainRow(row) {
  const year = Math.round(Number(row.year));
  const tempo = Number(row.tempo);
  const popularity = Number(row.popularity);
  const danceability = Number(row.danceability);
  const energy = Number(row.energy);
  const valence = Number(row.valence);
  const acousticness = Number(row.acousticness);
  const durationMs = Number(row.duration_ms);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(tempo) ||
    !Number.isFinite(popularity) ||
    !row.track_id
  ) {
    return null;
  }
  return {
    trackId: row.track_id,
    title: row.track_name || "Unknown",
    artist: row.artist_name || "Unknown",
    year,
    popularity,
    tempo,
    danceability: Number.isFinite(danceability) ? danceability : null,
    energy: Number.isFinite(energy) ? energy : null,
    valence: Number.isFinite(valence) ? valence : null,
    acousticness: Number.isFinite(acousticness) ? acousticness : null,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    genre: (row.genre || "").trim(),
    language: row.language || "",
  };
}

function aggregateByYear(data) {
  const rolled = d3.rollups(
    data,
    (v) => ({
      n: v.length,
      danceability: d3.mean(v, (d) => d.danceability),
      energy: d3.mean(v, (d) => d.energy),
      valence: d3.mean(v, (d) => d.valence),
      acousticness: d3.mean(v, (d) => d.acousticness),
      tempo: d3.mean(v, (d) => d.tempo),
    }),
    (d) => d.year
  );
  return rolled
    .map(([year, stats]) => ({ year, ...stats }))
    .sort((a, b) => a.year - b.year);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function verdictClass(verdict) {
  return verdict.toLowerCase().replace(/\s+/g, "-");
}

function setResult(id, verdict, detail) {
  setHtml(
    id,
    `<span class="verdict-badge verdict-${verdictClass(verdict)}">${escapeHtml(
      verdict
    )}</span><span>${escapeHtml(detail)}</span>`
  );
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function direction(delta) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return "stayed nearly flat";
  return delta > 0 ? "rose" : "fell";
}

function scoreLabel(value, high, mid, low) {
  if (value >= 0.66) return high;
  if (value >= 0.45) return mid;
  return low;
}

function filteredProfile(data) {
  return {
    danceability: d3.median(data, (d) => d.danceability),
    energy: d3.median(data, (d) => d.energy),
    valence: d3.median(data, (d) => d.valence),
    popularity: d3.median(data, (d) => d.popularity),
  };
}

function profileSentence(data) {
  const p = filteredProfile(data);
  return `The typical track is ${scoreLabel(
    p.danceability,
    "dance-forward",
    "moderately danceable",
    "less danceable"
  )}, ${scoreLabel(p.energy, "high-energy", "medium-energy", "low-energy")}, and ${scoreLabel(
    p.valence,
    "brighter in mood",
    "mixed in mood",
    "more subdued in mood"
  )}.`;
}

function getTopQuartileSplit(data) {
  const popSorted = [...data].sort((a, b) => b.popularity - a.popularity);
  let cut = Math.max(1, Math.floor(popSorted.length * 0.25));
  let topIds = new Set(popSorted.slice(0, cut).map((d) => d.trackId));
  let rest = data.filter((d) => !topIds.has(d.trackId));
  if (rest.length === 0 && cut < popSorted.length) {
    cut = Math.min(popSorted.length - 1, cut + 1);
    topIds = new Set(popSorted.slice(0, cut).map((d) => d.trackId));
    rest = data.filter((d) => !topIds.has(d.trackId));
  }
  return {
    top: data.filter((d) => topIds.has(d.trackId)),
    rest,
  };
}

function tempoPopularityBins(data) {
  const edges = d3.range(70, 191, 10);
  const rolled = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i];
    const x1 = edges[i + 1];
    const slice = data.filter((d) => d.tempo >= x0 && d.tempo < x1);
    if (slice.length) rolled.push({ x0, x1, n: slice.length, meanPop: d3.mean(slice, (d) => d.popularity) });
  }
  return rolled;
}

function featureSeparator(data) {
  const finiteFeatureRows = data.filter((d) =>
    ["danceability", "energy", "valence"].every((key) => Number.isFinite(d[key]))
  );
  if (finiteFeatureRows.length < 8) {
    return {
      strongest: { key: "features", delta: 0 },
      rows: [],
    };
  }
  const { top, rest } = getTopQuartileSplit(finiteFeatureRows);
  const rows = ["danceability", "energy", "valence"].map((key) => {
    const topValue = d3.median(top, (d) => d[key]);
    const restValue = d3.median(rest, (d) => d[key]);
    return {
      key,
      topValue,
      restValue,
      delta: Number.isFinite(topValue) && Number.isFinite(restValue) ? topValue - restValue : 0,
    };
  });
  return {
    strongest: d3.greatest(rows, (d) => Math.abs(d.delta)),
    rows,
  };
}

function renderSelectionStrip() {
  const data = filtered();
  const segment = state.genre === "all" ? "All segments" : state.genre;
  if (data.length === 0) {
    setHtml(
      "selection-strip",
      `<span class="selection-label">Current lens</span><strong>${escapeHtml(
        segment
      )}</strong><span>${state.year0}-${state.year1}</span><span>No matching tracks</span>`
    );
    return;
  }
  const p = filteredProfile(data);
  setHtml(
    "selection-strip",
    `<span class="selection-label">Current lens</span><strong>${escapeHtml(segment)}</strong><span>${
      state.year0
    }-${state.year1}</span><span>${data.length} tracks</span><span>Median profile: dance ${fmt(
      p.danceability
    )}, energy ${fmt(p.energy)}, mood ${fmt(p.valence)}</span>`
  );
}

function renderDashboardTakeaway() {
  const data = filtered();
  if (data.length === 0) {
    setText("dashboard-takeaway", "No tracks match this filter, so the story pauses until the selection widens.");
    setText("dash-timeline-title", "No trend to show yet");
    setText("dash-scatter-title", "No mood-energy pattern yet");
    setText("dash-threshold-title", "No top-song comparison yet");
    return;
  }
  const p = filteredProfile(data);
  const strongest = d3.greatest(
    [
      { key: "danceability", value: p.danceability },
      { key: "energy", value: p.energy },
      { key: "valence", value: p.valence },
    ],
    (d) => d.value
  );
  const segment = state.genre === "all" ? "all segments" : state.genre;
  setText(
    "dashboard-takeaway",
    `${data.length} tracks in ${segment}, ${state.year0}-${state.year1}. ${profileSentence(
      data
    )} Median ${strongest.key} edges highest (${fmt(strongest.value)}), but the scatter is the honest part: popularity still spreads across moods and energies—no single corner “wins” everything.`
  );
  const { strongest: separator } = featureSeparator(data);
  setText("dash-timeline-title", `Feature trends move separately; ${strongest.key} leads the medians`);
  setText("dash-scatter-title", "Popularity spreads across the mood–energy map");
  setText(
    "dash-threshold-title",
    separator.key === "features"
      ? "Need more tracks to compare top songs"
      : `Top songs differ most in ${separator.key}`
  );
}

function renderEraTakeaway() {
  const byYear = aggregateByYear(filtered());
  if (byYear.length < 2) {
    setText("era-takeaway", "Need at least two years in the current filter to compare era movement.");
    return;
  }
  const first = byYear[0];
  const last = byYear[byYear.length - 1];
  const delta = last.valence - first.valence;
  const highest = d3.greatest(byYear, (d) => d.valence);
  const lowest = d3.least(byYear, (d) => d.valence);
  const focus = byYear.find((d) => d.year === state.eraYear);
  const periodMean = d3.mean(byYear, (d) => d.valence);
  const focusText = focus
    ? `${state.eraYear} sits ${focus.valence >= periodMean ? "above" : "below"} the selected-period average.`
    : "Choose a focus year inside the selected range for the histogram comparison.";
  setText(
    "era-takeaway",
    `Mean mood ${direction(delta)} by ${fmt(Math.abs(delta))} from ${first.year} to ${last.year}; highest is ${
      highest.year
    } (${fmt(highest.valence)}), lowest is ${lowest.year} (${fmt(lowest.valence)}). ${focusText}`
  );
}

function renderTempoTakeaway() {
  const bins = tempoPopularityBins(filtered().filter((d) => Number.isFinite(d.tempo)));
  if (bins.length < 2) {
    setResult("tempo-takeaway", "Mixed", "Need more tempo variety in this filter before checking the tempo claim.");
    return;
  }
  const strongest = d3.greatest(bins, (d) => d.meanPop);
  const weakest = d3.least(bins, (d) => d.meanPop);
  const spread = strongest.meanPop - weakest.meanPop;
  const verdict = spread < 4 ? "Mixed" : "Partial";
  setResult(
    "tempo-takeaway",
    verdict,
    `The highest-popularity tempo bin is ${strongest.x0}-${strongest.x1} BPM, but tempo only creates a ${fmt(
      spread,
      1
    )}-point spread across bins.`
  );
}

function renderHypothesisTakeaways() {
  const data = filtered();
  const byYear = aggregateByYear(data);
  if (byYear.length >= 2) {
    const first = byYear[0];
    const last = byYear[byYear.length - 1];
    const delta = last.valence - first.valence;
    const yearDeltas = byYear
      .slice(1)
      .map((d, i) => d.valence - byYear[i].valence)
      .filter((d) => Math.abs(d) >= 0.01);
    const hasReversals = new Set(yearDeltas.map((d) => Math.sign(d))).size > 1;
    const verdict = Math.abs(delta) < 0.02 || hasReversals ? "Mixed" : "Supported";
    setResult(
      "myth-valence-result",
      verdict,
      `Mood ${direction(delta)} by ${fmt(Math.abs(delta))} from ${first.year} to ${last.year}${
        hasReversals ? ", with reversals along the way" : ""
      }.`
    );
  } else {
    setResult("myth-valence-result", "Mixed", "Need at least two years to check a mood trend.");
  }

  const danceEnergy = data.filter((d) => Number.isFinite(d.danceability) && Number.isFinite(d.energy));
  if (danceEnergy.length >= 8) {
    const { top, rest } = getTopQuartileSplit(danceEnergy);
    const danceDelta = d3.median(top, (d) => d.danceability) - d3.median(rest, (d) => d.danceability);
    const energyDelta = d3.median(top, (d) => d.energy) - d3.median(rest, (d) => d.energy);
    const verdict = danceDelta > 0.02 && energyDelta > 0.02 ? "Supported" : "Mixed";
    setResult(
      "myth-dance-energy-result",
      verdict,
      `Top-quartile hits are ${fmt(Math.abs(danceDelta))} ${
        danceDelta >= 0 ? "higher" : "lower"
      } in danceability and ${fmt(Math.abs(energyDelta))} ${energyDelta >= 0 ? "higher" : "lower"} in energy.`
    );
  } else {
    setResult(
      "myth-dance-energy-result",
      "Mixed",
      "Need more tracks to compare top-quartile hits against the rest."
    );
  }

  const durationByYear = d3
    .rollups(
      data.filter((d) => Number.isFinite(d.durationMs)),
      (v) => d3.mean(v, (d) => d.durationMs) / 60000,
      (d) => d.year
    )
    .map(([year, minutes]) => ({ year, minutes }))
    .sort((a, b) => a.year - b.year);
  if (durationByYear.length >= 2) {
    const first = durationByYear[0];
    const last = durationByYear[durationByYear.length - 1];
    const delta = last.minutes - first.minutes;
    const verdict = delta < -0.05 ? "Supported" : Math.abs(delta) <= 0.05 ? "Mixed" : "Not supported";
    setResult(
      "myth-duration-result",
      verdict,
      `Average duration ${direction(delta)} by ${fmt(Math.abs(delta), 2)} minutes from ${first.year} to ${
        last.year
      }.`
    );
  } else {
    setResult("myth-duration-result", "Mixed", "Need at least two years to check duration movement.");
  }
}

function renderNarrativeTakeaways() {
  renderSelectionStrip();
  renderDashboardTakeaway();
  renderEraTakeaway();
  renderTempoTakeaway();
  renderHypothesisTakeaways();
}

function chartSize(container, fallbackW, h) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  const w = Math.max(fallbackW, (el && el.clientWidth) || fallbackW);
  return { width: w, el };
}

function clearAndSvg(container, width, height, margin) {
  const { el } = chartSize(container, width, height);
  if (!el) return null;
  d3.select(el).selectAll("svg").remove();
  const svg = d3
    .select(el)
    .append("svg")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  return { svg, g, width, height };
}

/** Light grid only (no tick text) so we do not stack a second labeled axis on top of the real axes. */
function addGridLines(g, x, y, innerWidth, innerHeight, xTickCount, yTickCount) {
  const gx = d3.axisBottom(x).ticks(xTickCount).tickSize(-innerHeight).tickFormat(() => "");
  const gy = d3.axisLeft(y).ticks(yTickCount).tickSize(-innerWidth).tickFormat(() => "");
  g.append("g")
    .attr("class", "grid-line")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(gx)
    .call((s) => {
      s.select(".domain").remove();
      s.selectAll("text").remove();
    });
  g.append("g")
    .attr("class", "grid-line")
    .call(gy)
    .call((s) => {
      s.select(".domain").remove();
      s.selectAll("text").remove();
    });
}

function addPointAnnotation(g, x, y, d, key, label, width, dx = 8, dy = -10) {
  const px = x(d.year);
  const py = y(d[key]);
  const labelX = Math.max(4, Math.min(width - 120, px + dx));
  g.append("circle").attr("class", "chart-marker").attr("cx", px).attr("cy", py).attr("r", 4.5).attr("fill", "#fef3c7");
  g.append("text")
    .attr("class", "chart-annotation")
    .attr("x", labelX)
    .attr("y", Math.max(12, py + dy))
    .text(label);
}

function renderHook() {
  const margin = { top: 16, right: 24, bottom: 52, left: 52 };
  const height = 200;
  const { width, el } = chartSize("#hook-chart", 640, height);
  if (!el || allTracks.length === 0) return;
  const byYear = aggregateByYear(allTracks);
  const takeaway = document.getElementById("hook-takeaway");
  if (byYear.length === 0) {
    if (takeaway) takeaway.textContent = "No data for hook chart.";
    return;
  }
  const last = byYear[byYear.length - 1];
  const first = byYear[0];
  const dv = (last.valence ?? 0) - (first.valence ?? 0);
  if (takeaway) {
    takeaway.textContent = `From ${first.year} to ${last.year}, average mood among these hits ${
      dv >= 0 ? "rose" : "fell"
    } by about ${Math.abs(dv).toFixed(
      2
    )} on Spotify's 0-1 scale. Treat that as a loose weather report, not a rule: individual songs still sit all over the map, and the rest of the page asks whether simple stories (tempo, mood, length) hold once you change the lens.`;
  }

  const keys = ["danceability", "energy", "valence"];
  const x = d3
    .scaleLinear()
    .domain(d3.extent(byYear, (d) => d.year))
    .range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).nice().range([height, 0]);

  const hookG = clearAndSvg("#hook-chart", width, height, margin);
  if (!hookG || !hookG.g) return;
  const { g } = hookG;
  addGridLines(g, x, y, width, height, 8, 5);

  const color = d3.scaleOrdinal().domain(keys).range(["#38bdf8", "#f472b6", "#fde047"]);
  keys.forEach((key) => {
    const gen = d3
      .line()
      .curve(d3.curveMonotoneX)
      .x((d) => x(d.year))
      .y((d) => y(d[key]));
    g.append("path")
      .datum(byYear)
      .attr("fill", "none")
      .attr("stroke", color(key))
      .attr("stroke-width", 2.2)
      .attr("d", gen);
  });

  addPointAnnotation(g, x, y, first, "valence", `mood ${first.year}: ${fmt(first.valence)}`, width, 8, -12);
  addPointAnnotation(g, x, y, last, "valence", `mood ${last.year}: ${fmt(last.valence)}`, width, -118, 18);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Release year");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Mean Spotify feature score (0 = low, 1 = high)");

  const leg = g.append("g").attr("class", "legend").attr("transform", `translate(${width - 160}, 4)`);
  keys.forEach((key, i) => {
    const row = leg.append("g").attr("transform", `translate(0, ${i * 16})`);
    row.append("circle").attr("r", 4).attr("fill", color(key));
    row.append("text").attr("x", 10).attr("y", 4).text(key);
  });
}

function renderTimelineWithBrush() {
  const margin = { top: 12, right: 20, bottom: 56, left: 52 };
  const height = 240;
  const { width, el } = chartSize("#dash-timeline", 500, height);
  if (!el) return;
  const data = filtered();
  const byYear = aggregateByYear(data);
  const { g, svg } = clearAndSvg("#dash-timeline", width, height, margin);
  if (!g) return;
  if (byYear.length === 0) {
    g.append("text").attr("fill", "#e9d5ff").attr("y", height / 2).text("No tracks in this filter.");
    return;
  }
  const keys = ["danceability", "energy", "valence", "acousticness"];
  const x = d3.scaleLinear().domain([YEAR_MIN - 0.5, YEAR_MAX + 0.5]).range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).nice().range([height, 0]);
  addGridLines(g, x, y, width, height, 10, 5);

  const color = d3.scaleOrdinal().domain(keys).range(["#38bdf8", "#f472b6", "#fde047", "#a78bfa"]);
  keys.forEach((key) => {
    const gen = d3
      .line()
      .curve(d3.curveMonotoneX)
      .x((d) => x(d.year))
      .y((d) => y(d[key]));
    g.append("path")
      .datum(byYear)
      .attr("fill", "none")
      .attr("stroke", color(key))
      .attr("stroke-width", 2)
      .attr("d", gen);
  });

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 44)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Release year");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Mean feature score in filter (0–1)");

  const leg = g.append("g").attr("class", "legend").attr("transform", `translate(4, -4)`);
  keys.forEach((key, i) => {
    const row = leg.append("g").attr("transform", `translate(${i * 118}, 0)`);
    row.append("circle").attr("r", 3.5).attr("fill", color(key));
    row.append("text").attr("x", 8).attr("y", 3.5).text(key);
  });

  const brush = d3
    .brushX()
    .extent([
      [0, 2],
      [width, height - 2],
    ])
    .on("end", (event) => {
      if (!event.selection) return;
      const [px0, px1] = event.selection;
      let y0 = Math.round(x.invert(px0));
      let y1 = Math.round(x.invert(px1));
      y0 = Math.max(YEAR_MIN, Math.min(YEAR_MAX, y0));
      y1 = Math.max(YEAR_MIN, Math.min(YEAR_MAX, y1));
      if (y0 > y1) [y0, y1] = [y1, y0];
      state.year0 = y0;
      state.year1 = y1;
      syncYearInputs();
      renderAll();
    });

  g.append("g").attr("class", "timeline-brush").call(brush);
  svg.on("dblclick", () => {
    state.year0 = YEAR_MIN;
    state.year1 = YEAR_MAX;
    syncYearInputs();
    renderAll();
  });
}

function segmentKey(d) {
  return categoryTopKeys.includes(categoryOf(d)) ? categoryOf(d) : "Other";
}

function renderScatter(container, wMin, h, showLegend) {
  const margin = { top: 10, right: showLegend ? 120 : 16, bottom: 44, left: 48 };
  const { width, el } = chartSize(container, wMin, h);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.energy) && Number.isFinite(d.valence));
  const { g } = clearAndSvg(container, width, h, margin);
  if (!g) return;
  if (data.length === 0) {
    g.append("text").attr("fill", "#e9d5ff").attr("y", h / 2).text("No tracks to plot.");
    return;
  }
  const x = d3.scaleLinear().domain([0, 1]).nice().range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).nice().range([h, 0]);
  const r = d3.scaleSqrt().domain(d3.extent(data, (d) => d.popularity)).range([2.5, 14]);

  addGridLines(g, x, y, width, h, 6, 6);

  const tip = chartTooltip();

  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.energy))
    .attr("cy", (d) => y(d.valence))
    .attr("r", (d) => r(d.popularity))
    .attr("fill", (d) => colorScale(segmentKey(d)))
    .attr("opacity", 0.45)
    .attr("stroke", "rgba(0,0,0,0.25)")
    .on("mousemove", (event, d) => {
      tip.style("opacity", 1).html(
        `<strong>${d.title}</strong><br/>${d.artist}<br/>Pop ${d.popularity} · ${d.year}<br/>Seg: ${categoryOf(d)}`
      );
      tip.style("left", `${event.clientX + 12}px`).style("top", `${event.clientY + 12}px`);
    })
    .on("mouseleave", () => tip.style("opacity", 0));

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(6));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
  g.append("text").attr("class", "axis").attr("x", width / 2).attr("y", h + 36).attr("text-anchor", "middle").attr("fill", "#c4b5fd").text("Energy");
  g.append("text")
    .attr("class", "axis")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -36)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .text("Valence");

  if (showLegend) {
    const cats = [...categoryTopKeys, "Other"];
    const leg = g.append("g").attr("class", "legend").attr("transform", `translate(${width + 8}, 20)`);
    cats.forEach((c, i) => {
      const row = leg.append("g").attr("transform", `translate(0, ${i * 16})`);
      row.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", colorScale(c));
      row.append("text").attr("x", 14).attr("y", 9).text(c.length > 18 ? `${c.slice(0, 16)}…` : c);
    });
  }
}

function renderThreshold() {
  const margin = { top: 8, right: 16, bottom: 40, left: 92 };
  const height = 220;
  const { width, el } = chartSize("#dash-threshold", 320, height);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.danceability));
  const { g } = clearAndSvg("#dash-threshold", width, height, margin);
  if (!g) return;
  if (data.length < 8) {
    g.append("text").attr("fill", "#e9d5ff").attr("y", height / 2).text("Need more tracks.");
    return;
  }
  const { top, rest } = getTopQuartileSplit(data);
  const feats = ["danceability", "energy", "valence"];
  const rows = feats.map((f) => {
    return {
      feat: f,
      mTop: d3.median(top, (d) => d[f]),
      mRest: rest.length ? d3.median(rest, (d) => d[f]) : null,
    };
  });
  const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
  const y = d3.scaleBand().domain(feats).range([0, height]).padding(0.35);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Median feature score (0–1)");
  rows.forEach((row) => {
    const yy = y(row.feat);
    const h = y.bandwidth();
    g.append("rect")
      .attr("x", 0)
      .attr("y", yy + h * 0.15)
      .attr("width", x(row.mRest ?? 0))
      .attr("height", h * 0.35)
      .attr("rx", 3)
      .attr("fill", "rgba(148,163,184,0.55)");
    g.append("rect")
      .attr("x", 0)
      .attr("y", yy + h * 0.52)
      .attr("width", x(row.mTop))
      .attr("height", h * 0.35)
      .attr("rx", 3)
      .attr("fill", "#f472b6");
    g.append("text")
      .attr("x", -8)
      .attr("y", yy + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#e9d5ff")
      .attr("font-size", 11)
      .text(row.feat);
  });
  const key = g.append("g").attr("transform", `translate(4, -2)`);
  key.append("rect").attr("width", 10).attr("height", 8).attr("fill", "rgba(148,163,184,0.55)");
  key.append("text").attr("x", 14).attr("y", 8).attr("fill", "#c4b5fd").attr("font-size", 10).text("Median · rest");
  key.append("rect").attr("x", 120).attr("width", 10).attr("height", 8).attr("fill", "#f472b6");
  key.append("text").attr("x", 134).attr("y", 8).attr("fill", "#c4b5fd").attr("font-size", 10).text("Median · top 25% pop");
}

const ERA_BANDS = [
  { y0: 2020, y1: 2021.5, label: "Pandemic peak" },
  { y0: 2019, y1: 2024, label: "Short-video era" },
];

function renderEraTimeline() {
  const margin = { top: 22, right: 16, bottom: 48, left: 52 };
  const height = 200;
  const { width, el } = chartSize("#era-timeline", 700, height);
  if (!el) return;
  const data = filtered();
  const byYear = aggregateByYear(data);
  const { g } = clearAndSvg("#era-timeline", width, height, margin);
  if (!g) return;
  if (byYear.length === 0) {
    g.append("text").attr("fill", "#e9d5ff").attr("y", height / 2).text("No data.");
    return;
  }
  const x = d3.scaleLinear().domain([YEAR_MIN - 0.5, YEAR_MAX + 0.5]).range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).nice().range([height, 0]);

  ERA_BANDS.forEach((band, i) => {
    g.append("rect")
      .attr("x", x(band.y0))
      .attr("width", Math.max(0, x(band.y1) - x(band.y0)))
      .attr("y", 0)
      .attr("height", height)
      .attr("fill", i === 0 ? "rgba(244,114,182,0.12)" : "rgba(56,189,248,0.08)");
    g.append("text")
      .attr("class", "era-band-label")
      .attr("x", x(band.y0) + 4)
      .attr("y", 14 + i * 12)
      .text(band.label);
  });

  const line = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.year))
    .y((d) => y(d.valence));
  g.append("path").datum(byYear).attr("fill", "none").attr("stroke", "#fde047").attr("stroke-width", 2.5).attr("d", line);

  const highest = d3.greatest(byYear, (d) => d.valence);
  const lowest = d3.least(byYear, (d) => d.valence);
  if (highest) addPointAnnotation(g, x, y, highest, "valence", `highest mood: ${highest.year}`, width, 8, -12);
  if (lowest && lowest.year !== highest.year) {
    addPointAnnotation(g, x, y, lowest, "valence", `lowest mood: ${lowest.year}`, width, 8, 18);
  }

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
  g.append("text")
    .attr("x", 4)
    .attr("y", -6)
    .attr("fill", "#fde68a")
    .attr("font-size", 11)
    .text("Mean valence by year (shaded eras are illustrative)");
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 38)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Release year");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Mean valence (0–1)");
}

function renderEraHist() {
  const margin = { top: 10, right: 12, bottom: 48, left: 52 };
  const height = 200;
  const { width, el } = chartSize("#era-hist", 520, height);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.valence));
  const { g } = clearAndSvg("#era-hist", width, height, margin);
  if (!g) return;
  if (data.length === 0) return;
  const binGen = d3.bin().domain([0, 1]).thresholds(18);
  const bins = binGen(data.map((d) => d.valence));
  const yearData = data.filter((d) => d.year === state.eraYear);
  const binsY = yearData.length ? binGen(yearData.map((d) => d.valence)) : [];

  const x = d3
    .scaleLinear()
    .domain([0, 1])
    .range([0, width]);
  const maxC = d3.max(bins, (b) => b.length) || 1;
  const maxY = binsY.length ? d3.max(binsY, (b) => b.length) || 1 : 0;
  const y = d3
    .scaleLinear()
    .domain([0, Math.max(maxC, maxY, 1)])
    .nice()
    .range([height, 0]);

  g.selectAll("rect.bg")
    .data(bins)
    .join("rect")
    .attr("class", "bg")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr("y", (d) => y(d.length))
    .attr("height", (d) => height - y(d.length))
    .attr("rx", 2)
    .attr("fill", "rgba(148,163,184,0.35)");

  if (binsY.length) {
    g.selectAll("rect.fg")
      .data(binsY)
      .join("rect")
      .attr("class", "fg")
      .attr("x", (d) => x(d.x0) + 1)
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => height - y(d.length))
      .attr("rx", 2)
      .attr("fill", "rgba(244,114,182,0.65)");
  }

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(6));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Number of tracks in bin");
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 36)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text("Valence (0 = sad, 1 = positive)");
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", 10)
    .text(`Gray = all filtered tracks · Pink = ${state.eraYear} only`);
}

function renderMythTempo() {
  const margin = { top: 10, right: 10, bottom: 48, left: 56 };
  const h = 130;
  const { width, el } = chartSize("#myth-tempo", 400, h);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.tempo));
  const { g } = clearAndSvg("#myth-tempo", width, h, margin);
  if (!g) return;
  if (data.length < 5) return;
  const rolled = tempoPopularityBins(data);
  const x = d3
    .scaleLinear()
    .domain([60, 200])
    .range([0, width]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(rolled, (d) => d.meanPop) || 100])
    .nice()
    .range([h, 0]);
  addGridLines(g, x, y, width, h, 6, 4);
  const line = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => (x(d.x0) + x(d.x1)) / 2)
    .y((d) => y(d.meanPop));
  g.append("path")
    .datum(rolled.filter((d) => Number.isFinite(d.meanPop)))
    .attr("fill", "none")
    .attr("stroke", "#38bdf8")
    .attr("stroke-width", 2)
    .attr("d", line);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(6));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -44)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Mean popularity in tempo bin (0–100)");
  g.append("text")
    .attr("x", width / 2)
    .attr("y", h + 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Track tempo (BPM, bin midpoint on line)");
}

function renderMythValence() {
  const margin = { top: 6, right: 6, bottom: 42, left: 46 };
  const h = 170;
  const { width, el } = chartSize("#myth-valence", 280, h);
  if (!el) return;
  const by = aggregateByYear(filtered());
  const { g } = clearAndSvg("#myth-valence", width, h, margin);
  if (!g || by.length === 0) return;
  const x = d3
    .scaleLinear()
    .domain(d3.extent(by, (d) => d.year))
    .range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).nice().range([h, 0]);
  const line = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.year))
    .y((d) => y(d.valence));
  g.append("path").datum(by).attr("fill", "none").attr("stroke", "#fde047").attr("stroke-width", 2).attr("d", line);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", h + 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Release year");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -38)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Mean valence (0–1)");
}

function renderMythDanceEnergy() {
  const margin = { top: 6, right: 6, bottom: 42, left: 46 };
  const h = 170;
  const { width, el } = chartSize("#myth-dance-energy", 280, h);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.danceability) && Number.isFinite(d.energy));
  const { g } = clearAndSvg("#myth-dance-energy", width, h, margin);
  if (!g || data.length === 0) return;
  const popCut = d3.quantileSorted(
    data.map((d) => d.popularity).sort(d3.ascending),
    0.75
  );
  const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0]);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(4));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", h + 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Danceability (0–1)");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -38)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Energy (0–1)");
  g.selectAll("c")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.danceability))
    .attr("cy", (d) => y(d.energy))
    .attr("r", 3)
    .attr("fill", (d) => (d.popularity >= popCut ? "#f472b6" : "rgba(148,163,184,0.35)"))
    .attr("stroke", "none");
}

function renderMythDuration() {
  const margin = { top: 6, right: 6, bottom: 42, left: 46 };
  const h = 170;
  const { width, el } = chartSize("#myth-duration", 280, h);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.durationMs));
  const by = d3.rollups(
    data,
    (v) => d3.mean(v, (d) => d.durationMs) / 60000,
    (d) => d.year
  );
  const series = by.map(([year, m]) => ({ year, m })).sort((a, b) => a.year - b.year);
  const { g } = clearAndSvg("#myth-duration", width, h, margin);
  if (!g || series.length === 0) return;
  const x = d3
    .scaleLinear()
    .domain(d3.extent(series, (d) => d.year))
    .range([0, width]);
  const y = d3
    .scaleLinear()
    .domain(d3.extent(series, (d) => d.m))
    .nice()
    .range([h, 0]);
  const line = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.year))
    .y((d) => y(d.m));
  g.append("path").datum(series).attr("fill", "none").attr("stroke", "#a78bfa").attr("stroke-width", 2).attr("d", line);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  g.append("text")
    .attr("x", width / 2)
    .attr("y", h + 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Release year");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -38)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Mean duration (minutes)");
}

function renderCapstone() {
  const panel = document.getElementById("cap-answer-panel");
  const stats = document.getElementById("cap-stats");
  if (!panel || !stats) return;
  const data = filtered();
  if (data.length === 0) {
    panel.innerHTML = "<h3>No readout yet</h3><p>No tracks match this filter.</p>";
    stats.innerHTML = "<h4>Summary</h4><p>Widen the year range or choose another segment.</p>";
    return;
  }

  const top = [...data].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
  const profile = filteredProfile(data);
  const mp = Number((d3.median(data, (d) => d.popularity) ?? 0).toFixed(1));

  const durationMinutes = (d3.median(data, (d) => d.durationMs) ?? 0) / 60000;
  const finiteFeatureRows = data.filter((d) =>
    ["danceability", "energy", "valence"].every((key) => Number.isFinite(d[key]))
  );
  const { top: topQuartile, rest } = getTopQuartileSplit(finiteFeatureRows);
  const separators = ["danceability", "energy", "valence"].map((key) => {
    const topValue = d3.median(topQuartile, (d) => d[key]);
    const restValue = d3.median(rest, (d) => d[key]);
    return {
      key,
      delta: Number.isFinite(topValue) && Number.isFinite(restValue) ? topValue - restValue : 0,
    };
  });
  const strongestSeparator = d3.greatest(separators, (d) => Math.abs(d.delta));

  const byYear = aggregateByYear(data);
  const moodTrend =
    byYear.length >= 2
      ? `Mood ${direction(byYear[byYear.length - 1].valence - byYear[0].valence)} by ${fmt(
          Math.abs(byYear[byYear.length - 1].valence - byYear[0].valence)
        )} from ${byYear[0].year} to ${byYear[byYear.length - 1].year}.`
      : "Mood needs at least two years to show movement.";

  const durationByYear = d3
    .rollups(
      data.filter((d) => Number.isFinite(d.durationMs)),
      (v) => d3.mean(v, (d) => d.durationMs) / 60000,
      (d) => d.year
    )
    .map(([year, minutes]) => ({ year, minutes }))
    .sort((a, b) => a.year - b.year);
  const durationTrend =
    durationByYear.length >= 2
      ? `Duration ${direction(durationByYear[durationByYear.length - 1].minutes - durationByYear[0].minutes)} by ${fmt(
          Math.abs(durationByYear[durationByYear.length - 1].minutes - durationByYear[0].minutes),
          2
        )} minutes.`
      : "Duration needs at least two years to show movement.";

  const tempoBins = tempoPopularityBins(data.filter((d) => Number.isFinite(d.tempo)));
  const tempoSummary =
    tempoBins.length >= 2
      ? `Tempo is a weak standalone explanation here: mean popularity varies by ${fmt(
          d3.max(tempoBins, (d) => d.meanPop) - d3.min(tempoBins, (d) => d.meanPop),
          1
        )} points across BPM bins.`
      : "Tempo needs more variety in this filter before it can support a claim.";

  const metricRows = [
    ["Danceability", fmt(profile.danceability)],
    ["Energy", fmt(profile.energy)],
    ["Mood / valence", fmt(profile.valence)],
    ["Duration", `${fmt(durationMinutes, 2)} min`],
  ]
    .map(([label, value]) => `<div class="cap-metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  const separatorRows = separators
    .map(
      (item) =>
        `<div class="cap-metric"><span>${item.key}</span><strong>${item.delta >= 0 ? "+" : ""}${fmt(
          item.delta
        )}</strong></div>`
    )
    .join("");

  panel.innerHTML = `
    <p class="cap-kicker">Readout for this slice (same lens as every chart above)</p>
    <p class="cap-answer">${profileSentence(data)} Under the hood, hits still disagree with each other on dance, energy, and mood—that spread is why we don’t claim one “predictor.” The blocks below compress a noisy crowd into medians and gaps: useful shorthand for <em>this</em> filter, not a recipe for fame.</p>
    <div class="evidence-grid">
      <article class="evidence-card">
        <h3>Typical profile</h3>
        <p>The median is the center of a wide cloud—one stand-in for the group, not everyone’s taste.</p>
        <div class="cap-metric-list">${metricRows}</div>
      </article>
      <article class="evidence-card">
        <h3>Where the biggest tracks sit</h3>
        <p>Top quarter vs the rest differs most on <strong>${strongestSeparator.key}</strong> (${strongestSeparator.delta >= 0 ? "+" : ""}${fmt(strongestSeparator.delta)}). Small gaps still matter as texture; they’re not proof that turning this dial “makes” a smash.</p>
        <div class="cap-metric-list">${separatorRows}</div>
      </article>
      <article class="evidence-card">
        <h3>What changed over time</h3>
        <p>${moodTrend}</p>
        <p>${durationTrend}</p>
      </article>
      <article class="evidence-card">
        <h3>What didn’t carry the whole story</h3>
        <p>${tempoSummary}</p>
      </article>
    </div>
  `;

  stats.innerHTML = `
    <h4>Selection</h4>
    <dl>
      <dt>Tracks</dt><dd>${data.length}</dd>
      <dt>Years</dt><dd>${state.year0}-${state.year1}</dd>
      <dt>Segment</dt><dd>${state.genre === "all" ? "All segments" : escapeHtml(state.genre)}</dd>
      <dt>Median popularity</dt><dd>${mp}</dd>
    </dl>
    <h4>Examples, not proof</h4>
    <ol style="margin:0;padding-left:1.1rem;color:#e9d5ff;font-size:0.88rem">
      ${top
        .map(
          (t) =>
            `<li>${escapeHtml(t.title)} <span style="opacity:0.8">(${t.year}, ${t.popularity})</span></li>`
        )
        .join("")}
    </ol>
  `;
}

function syncYearInputs() {
  const a = document.getElementById("control-year-min");
  const b = document.getElementById("control-year-max");
  if (a) a.value = String(state.year0);
  if (b) b.value = String(state.year1);
}

function populateGenreOptions() {
  const sel = document.getElementById("control-genre");
  if (!sel) return;
  const counts = d3.rollup(allTracks, (v) => v.length, (d) => categoryOf(d));
  const sorted = Array.from(counts, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  categoryTopKeys = sorted.slice(0, 10).map((d) => d.k);
  colorScale.domain([...categoryTopKeys, "Other"]);

  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "all";
  opt0.textContent = "All segments";
  sel.appendChild(opt0);
  sorted.forEach(({ k }) => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = `${k} (${counts.get(k)})`;
    sel.appendChild(o);
  });
  sel.value = state.genre;
}

function renderAll() {
  renderHook();
  renderNarrativeTakeaways();
  renderTimelineWithBrush();
  renderScatter("#dash-scatter", 400, 320, false);
  renderThreshold();
  renderEraTimeline();
  renderEraHist();
  renderMythTempo();
  renderMythValence();
  renderMythDanceEnergy();
  renderMythDuration();
  renderCapstone();
  if (typeof window.refreshTempoMini === "function") window.refreshTempoMini();
}

function initControls() {
  const ymin = document.getElementById("control-year-min");
  const ymax = document.getElementById("control-year-max");
  const gsel = document.getElementById("control-genre");
  const reset = document.getElementById("control-reset");
  const eraSlider = document.getElementById("era-year-slider");
  const eraLabel = document.getElementById("era-year-label");

  const applyYears = () => {
    let a = Number(ymin && ymin.value);
    let b = Number(ymax && ymax.value);
    if (!Number.isFinite(a)) a = YEAR_MIN;
    if (!Number.isFinite(b)) b = YEAR_MAX;
    a = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(a)));
    b = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(b)));
    if (a > b) [a, b] = [b, a];
    state.year0 = a;
    state.year1 = b;
    syncYearInputs();
    renderAll();
  };

  ymin && ymin.addEventListener("change", applyYears);
  ymax && ymax.addEventListener("change", applyYears);
  gsel &&
    gsel.addEventListener("change", () => {
      state.genre = gsel.value;
      renderAll();
    });
  reset &&
    reset.addEventListener("click", () => {
      state.year0 = YEAR_MIN;
      state.year1 = YEAR_MAX;
      state.genre = "all";
      syncYearInputs();
      if (gsel) gsel.value = "all";
      renderAll();
    });
  eraSlider &&
    eraSlider.addEventListener("input", () => {
      state.eraYear = Number(eraSlider.value);
      if (eraLabel) eraLabel.textContent = String(state.eraYear);
      renderEraTakeaway();
      renderEraHist();
    });
}

/* --- Tempo mini (nearest track), uses filtered(allTracks) subset --- */
function initTempoMini() {
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
  let suppressInputSync = false;

  function buildYouTubeSearchUrl(song) {
    const query = `${song.title} ${song.artist} official audio`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  function poolForTempo() {
    const f = filtered().filter((d) => Number.isFinite(d.tempo));
    if (f.length) return f;
    return allTracks.filter((d) => Number.isFinite(d.tempo));
  }

  function getNearestSong(targetTempo, pool) {
    if (!pool || !pool.length) return null;
    return pool.reduce((closest, current) => {
      const cd = Math.abs(current.tempo - targetTempo);
      const bd = Math.abs(closest.tempo - targetTempo);
      return cd < bd ? current : closest;
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
    if (!song) {
      songTitle.textContent = "No tracks";
      songArtist.textContent = "Widen your year filter or pick All segments.";
      songMetrics.textContent = "";
      youtubeLink.classList.add("disabled");
      youtubeLink.href = "#";
      return;
    }
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

  window.refreshTempoMini = function refreshTempoMini() {
    const pool = poolForTempo();
    const selectedTempo = Number(slider.value);
    if (!suppressInputSync) tempoInput.value = String(selectedTempo);
    const song = getNearestSong(selectedTempo, pool);
    updateThumbSize(selectedTempo);
    updateSongPanel(song, selectedTempo);
  };

  slider.addEventListener("input", () => window.refreshTempoMini());
  tempoInput.addEventListener("input", () => {
    const raw = Number(tempoInput.value);
    if (!Number.isFinite(raw)) return;
    const minTempo = Number(slider.min);
    const maxTempo = Number(slider.max);
    const clamped = Math.max(minTempo, Math.min(maxTempo, Math.round(raw)));
    suppressInputSync = true;
    slider.value = String(clamped);
    suppressInputSync = false;
    window.refreshTempoMini();
  });

  youtubeLink.classList.add("disabled");
  youtubeLink.href = "#";
  songTitle.textContent = "Loading…";
  songArtist.textContent = "";
}

document.addEventListener("DOMContentLoaded", () => {
  initTempoMini();
  initControls();
  const eraLabel = document.getElementById("era-year-label");
  if (eraLabel) eraLabel.textContent = String(state.eraYear);

  d3.csv(DATA_MAIN)
    .then((mainRows) => {
      allTracks = mainRows.map(parseMainRow).filter(Boolean);

      if (allTracks.length === 0) {
        document.getElementById("hook-takeaway").textContent = "Main dataset failed to load.";
        return;
      }
      populateGenreOptions();
      syncYearInputs();
      renderAll();
    })
    .catch(() => {
      const t = document.getElementById("hook-takeaway");
      if (t) t.textContent = "Could not load CSV. Serve the site over http(s) (e.g. python -m http.server).";
    });
});
