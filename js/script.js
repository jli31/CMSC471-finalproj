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

function renderHook() {
  const margin = { top: 16, right: 24, bottom: 40, left: 44 };
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
    takeaway.textContent = `From ${first.year} to ${last.year}, average valence among these hits ${
      dv >= 0 ? "rose" : "fell"
    } by about ${Math.abs(dv).toFixed(2)} on Spotify's 0–1 scale—while energy and danceability wiggle year to year.`;
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

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));

  const leg = g.append("g").attr("class", "legend").attr("transform", `translate(${width - 160}, 4)`);
  keys.forEach((key, i) => {
    const row = leg.append("g").attr("transform", `translate(0, ${i * 16})`);
    row.append("circle").attr("r", 4).attr("fill", color(key));
    row.append("text").attr("x", 10).attr("y", 4).text(key);
  });
}

function renderTimelineWithBrush() {
  const margin = { top: 12, right: 20, bottom: 48, left: 46 };
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
  const margin = { top: 8, right: 16, bottom: 28, left: 92 };
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
  const popSorted = [...data].sort((a, b) => b.popularity - a.popularity);
  let cut = Math.max(1, Math.floor(popSorted.length * 0.25));
  let topIds = new Set(popSorted.slice(0, cut).map((d) => d.trackId));
  let rest = data.filter((d) => !topIds.has(d.trackId));
  if (rest.length === 0 && cut < popSorted.length) {
    cut = Math.min(popSorted.length - 1, cut + 1);
    topIds = new Set(popSorted.slice(0, cut).map((d) => d.trackId));
    rest = data.filter((d) => !topIds.has(d.trackId));
  }
  const feats = ["danceability", "energy", "valence"];
  const rows = feats.map((f) => {
    const tops = data.filter((d) => topIds.has(d.trackId));
    return {
      feat: f,
      mTop: d3.median(tops, (d) => d[f]),
      mRest: rest.length ? d3.median(rest, (d) => d[f]) : null,
    };
  });
  const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
  const y = d3.scaleBand().domain(feats).range([0, height]).padding(0.35);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5));
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
  const margin = { top: 20, right: 16, bottom: 40, left: 46 };
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

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
  g.append("text").attr("x", 4).attr("y", -4).attr("fill", "#fde68a").attr("font-size", 12).text("Mean valence by year (annotated eras)");
}

function renderEraHist() {
  const margin = { top: 10, right: 12, bottom: 40, left: 44 };
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
    .attr("x", width / 2)
    .attr("y", height + 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 11)
    .text(`Valence histogram · gray = all filtered · pink = ${state.eraYear} only`);
}

function renderMythTempo() {
  const margin = { top: 10, right: 10, bottom: 48, left: 50 };
  const h = 130;
  const { width, el } = chartSize("#myth-tempo", 400, h);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.tempo));
  const { g } = clearAndSvg("#myth-tempo", width, h, margin);
  if (!g) return;
  if (data.length < 5) return;
  const edges = d3.range(70, 191, 10);
  const rolled = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i];
    const x1 = edges[i + 1];
    const slice = data.filter((d) => d.tempo >= x0 && d.tempo < x1);
    if (slice.length) rolled.push({ x0, x1, meanPop: d3.mean(slice, (d) => d.popularity) });
  }
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
    .attr("x", width / 2)
    .attr("y", h + 34)
    .attr("text-anchor", "middle")
    .attr("fill", "#c4b5fd")
    .attr("font-size", 10)
    .text("Tempo (BPM) → mean popularity in bin");
}

function renderMythValence() {
  const margin = { top: 6, right: 6, bottom: 32, left: 38 };
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
}

function renderMythDanceEnergy() {
  const margin = { top: 6, right: 6, bottom: 32, left: 38 };
  const h = 170;
  const { width, el } = chartSize("#myth-dance-energy", 280, h);
  if (!el) return;
  const data = filtered().filter((d) => Number.isFinite(d.danceability) && Number.isFinite(d.energy));
  const { g } = clearAndSvg("#myth-dance-energy", width, h, margin);
  if (!g || data.length === 0) return;
  const popCut = d3.quantileSorted(
    Float64Array.from(data, (d) => d.popularity),
    0.75
  );
  const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0]);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(4));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
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
  const margin = { top: 6, right: 6, bottom: 32, left: 38 };
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
}

function renderCapstone() {
  renderScatter("#cap-scatter", 520, 400, true);
  const el = document.getElementById("cap-stats");
  if (!el) return;
  const data = filtered();
  if (data.length === 0) {
    el.innerHTML = "<h4>Summary</h4><p>No tracks match.</p>";
    return;
  }
  const top = [...data].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
  const mf = (arr, acc) => Number((d3.median(arr, acc) ?? 0).toFixed(2));
  const mp = Number((d3.median(data, (d) => d.popularity) ?? 0).toFixed(1));
  el.innerHTML = `
    <h4>Filtered summary</h4>
    <dl>
      <dt>Tracks</dt><dd>${data.length}</dd>
      <dt>Years</dt><dd>${state.year0}–${state.year1}</dd>
      <dt>Segment</dt><dd>${state.genre === "all" ? "All segments" : escapeHtml(state.genre)}</dd>
      <dt>Median popularity</dt><dd>${mp}</dd>
      <dt>Median energy</dt><dd>${mf(data, (d) => d.energy)}</dd>
      <dt>Median valence</dt><dd>${mf(data, (d) => d.valence)}</dd>
      <dt>Median danceability</dt><dd>${mf(data, (d) => d.danceability)}</dd>
    </dl>
    <h4>Five hottest in filter</h4>
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
