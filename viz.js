/* =====================================================================
   Research visualizations: brain-tumor CNN
   All numeric data is digitized from the paper's own figures
   (training curves = Fig. 3/4, prediction probabilities = Fig. 4).
   Hand-built SVG/DOM, no chart libraries.
   ===================================================================== */

(function () {
  "use strict";

  /* ------------------------------- palette ------------------------------- */
  const BLUE = "#3987e5";
  const BLUE_LIGHT = "#86b6ef";
  const GREEN = "#12a012";        // slightly lifted from #008300 for 2px lines on dark
  const GREEN_LIGHT = "#6fca6f";
  const SURFACE = "#1a1a19";
  const BG = "#0d0d0c";
  const GRID = "#2c2c2a";
  const AXIS = "#383835";
  const MUTED = "#898781";
  const INK = "#f4f2ec";
  const INK2 = "#c3c2b7";
  const MONO = "ui-monospace, Menlo, monospace";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ------------------------------ real data ------------------------------ */
  const DATA = {
    custom: {
      trainAcc: [0.56,0.67,0.745,0.735,0.79,0.69,0.805,0.80,0.815,0.86,0.825,0.81,0.845,0.81,0.845,0.89,0.855,0.875,0.855,0.86],
      valAcc:   [0.37,0.33,0.51,0.33,0.65,0.60,0.65,0.735,0.76,0.53,0.735,0.665,0.765,0.80,0.72,0.735,0.785,0.735,0.73,0.865],
      trainLoss:[1.03,0.70,0.635,0.665,0.53,0.695,0.49,0.43,0.465,0.39,0.44,0.445,0.42,0.405,0.455,0.41,0.32,0.37,0.38,0.33],
      valLoss:  [1.57,1.79,1.31,2.09,0.85,1.21,0.97,1.03,1.07,0.65,1.26,0.65,1.03,0.60,0.62,0.74,0.75,0.51,0.72,0.47],
    },
    vgg: {
      trainAcc: [0.75,0.89,0.89,0.92,0.915,0.905,0.93,0.89,0.95,0.905,0.945,0.92,0.955,0.905,0.95,0.985,0.955,0.955,0.955,0.955],
      valAcc:   [0.65,0.665,0.89,0.735,0.905,0.865,0.92,0.865,0.865,0.735,0.94,0.80,0.895,0.865,0.94,0.935,0.955,0.935,0.945,0.865],
      trainLoss:[0.66,0.255,0.285,0.25,0.225,0.285,0.185,0.275,0.15,0.22,0.15,0.15,0.12,0.285,0.14,0.09,0.12,0.21,0.13,0.10],
      valLoss:  [1.16,1.62,0.29,0.72,0.23,0.385,0.205,0.24,0.435,0.815,0.17,0.445,0.29,0.45,0.14,0.13,0.11,0.375,0.13,0.43],
    },
  };
  const CLASSES = ["Glioma", "Meningioma", "No Tumor", "Pituitary"];
  const PRED = {
    transfer: [0.0, 0.0, 0.0, 1.0],
    custom:   [0.125, 0.018, 0.024, 0.835],
  };

  /* ------------------------------- helpers ------------------------------- */
  function el(tag, attrs, parent) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function svg(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function onView(node, cb, threshold) {
    if (reduceMotion) { cb(); return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { io.disconnect(); cb(); }
    }, { threshold: threshold || 0.35 });
    io.observe(node);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // triangular-weighted moving average (radius 2 → weights 3,2,1), edges shrink the window
  function smoothSeries(vals, radius) {
    radius = radius || 2;
    const out = [];
    for (let i = 0; i < vals.length; i++) {
      let num = 0, den = 0;
      for (let j = -radius; j <= radius; j++) {
        const k = i + j; if (k < 0 || k >= vals.length) continue;
        const w = radius + 1 - Math.abs(j);
        num += w * vals[k]; den += w;
      }
      out.push(num / den);
    }
    return out;
  }
  const HEAT = [[14,28,46],[28,92,171],[57,135,229],[134,182,239]];
  function heat(t) {
    t = Math.max(0, Math.min(1, t));
    const seg = t >= 1 ? 2 : Math.floor(t * 3);
    const lt = t * 3 - seg;
    const a = HEAT[seg], b = HEAT[seg + 1];
    return `rgb(${Math.round(lerp(a[0],b[0],lt))},${Math.round(lerp(a[1],b[1],lt))},${Math.round(lerp(a[2],b[2],lt))})`;
  }

  /* -------------------------------- tooltip -------------------------------- */
  let tip = document.getElementById("tooltip");
  if (!tip) { tip = el("div", { class: "chart-tooltip", id: "tooltip", role: "status" }, document.body); }
  function tipMove(evt) {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = evt.clientX + pad, y = evt.clientY - r.height - pad;
    if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y < 8) y = evt.clientY + pad;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function tipHide() { tip.classList.remove("show"); }

  /* ==================================================================== *
   *  1. CNN forward-pass pipeline
   * ==================================================================== */

  function featureMapSVG(N, mode, seed, px) {
    const rng = mulberry32(seed);
    const s = svg("svg", { viewBox: `0 0 ${N} ${N}`, width: px, height: px, "shape-rendering": "crispEdges" });
    let field;
    if (mode === "edge") {
      const ang = rng() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
      const freq = 5 + rng() * 6, phase = rng() * 6.28;
      field = (x, y) => {
        const u = x / N - 0.5, v = y / N - 0.5;
        const p = (u * ca + v * sa);
        return 0.5 + 0.5 * Math.sin(p * freq + phase) * 0.9 + (rng() - 0.5) * 0.18;
      };
    } else { // blob
      const cx = [0.3 + rng() * 0.4, rng(), rng()];
      const cy = [0.3 + rng() * 0.4, rng(), rng()];
      const rad = [0.16 + rng() * 0.1, 0.1 + rng() * 0.1, 0.09 + rng() * 0.08];
      field = (x, y) => {
        const u = x / N, v = y / N; let acc = 0;
        for (let i = 0; i < 3; i++) {
          const dx = u - cx[i], dy = v - cy[i];
          acc += Math.exp(-(dx * dx + dy * dy) / (2 * rad[i] * rad[i]));
        }
        return acc * 0.75 + (rng() - 0.5) * 0.12;
      };
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        svg("rect", { x, y, width: 1.03, height: 1.03, fill: heat(field(x, y)) }, s);
      }
    }
    return s;
  }

  function mapStack(mode, channels, seed, px) {
    const wrap = el("div", { class: "map-stack" });
    wrap.style.width = px + "px"; wrap.style.height = px + "px";
    for (let i = 2; i >= 1; i--) {
      const b = el("div", { class: "map behind" }, wrap);
      b.style.width = px + "px"; b.style.height = px + "px";
      b.style.transform = `translate(${i * 5}px, ${i * 5}px)`;
      b.style.background = heat(0.12);
      b.style.opacity = 0.5 - i * 0.12;
    }
    const front = el("div", { class: "map map-shimmer" }, wrap);
    front.style.width = px + "px"; front.style.height = px + "px";
    front.appendChild(featureMapSVG(mode === "edge" ? 12 : 9, mode, seed, px));
    el("span", { class: "map-badge", text: "×" + channels }, wrap);
    return wrap;
  }

  function mriSVG(px) {
    const uid = "mri" + Math.floor(Math.random() * 1e6);
    const s = svg("svg", { viewBox: "0 0 100 100", width: px, height: px });
    const defs = svg("defs", {}, s);
    const clip = svg("clipPath", { id: uid + "c" }, defs);
    svg("ellipse", { cx: 50, cy: 52, rx: 37, ry: 43 }, clip);
    const grad = svg("radialGradient", { id: uid + "g", cx: "48%", cy: "42%", r: "62%" }, defs);
    svg("stop", { offset: "0%", "stop-color": "#dcdcdc" }, grad);
    svg("stop", { offset: "52%", "stop-color": "#8c8c8c" }, grad);
    svg("stop", { offset: "100%", "stop-color": "#2f2f2f" }, grad);
    const f = svg("filter", { id: uid + "t" }, defs);
    svg("feTurbulence", { type: "fractalNoise", baseFrequency: "0.16", numOctaves: "3", seed: "11", result: "n" }, f);
    svg("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" }, f);
    svg("rect", { x: 0, y: 0, width: 100, height: 100, fill: "#0a0a0a" }, s);
    const g = svg("g", { "clip-path": `url(#${uid}c)` }, s);
    svg("rect", { x: 10, y: 8, width: 80, height: 88, fill: `url(#${uid}g)` }, g);
    svg("rect", { x: 10, y: 8, width: 80, height: 88, filter: `url(#${uid}t)`, opacity: "0.5", style: "mix-blend-mode:overlay" }, g);
    // sulci
    for (const d of [
      "M28 30 Q40 40 34 54", "M68 28 Q58 42 66 56", "M40 20 Q50 30 60 22",
      "M30 66 Q44 72 40 84", "M70 66 Q58 74 62 84",
    ]) svg("path", { d, fill: "none", stroke: "#4a4a4a", "stroke-width": "1.4", "stroke-linecap": "round", opacity: "0.7" }, g);
    // ventricles
    svg("path", { d: "M44 46 Q50 40 56 46 Q52 54 50 54 Q48 54 44 46 Z", fill: "#232323" }, g);
    // region of interest, near pituitary (lower center)
    svg("circle", { cx: 50, cy: 66, r: 8, fill: "rgba(57,135,229,0.28)" }, g);
    svg("circle", { cx: 50, cy: 66, r: 8, fill: "none", stroke: BLUE, "stroke-width": "1.2" }, g);
    // skull
    svg("ellipse", { cx: 50, cy: 52, rx: 38.5, ry: 44.5, fill: "none", stroke: "#6a6a6a", "stroke-width": "2.4" }, s);
    svg("ellipse", { cx: 50, cy: 52, rx: 36, ry: 42, fill: "none", stroke: "#111", "stroke-width": "1" }, s);
    return s;
  }

  const STAGES = [
    { key: "input", kind: "mri", dims: "224² × 3", top: "Input", bot: "MRI scan",
      cap: "A 224×224 RGB MRI slice enters the network as raw pixels, no features, just intensity." },
    { key: "conv1", kind: "map", mode: "edge", ch: 32, px: 66, dims: "222² × 32", top: "Conv 3×3", bot: "edges",
      cap: "32 learned 3×3 filters sweep the scan. Each activation map lights up on one low-level cue: an edge, a gradient, a texture." },
    { key: "pool1", kind: "map", mode: "edge", ch: 32, px: 50, dims: "111² × 32", top: "MaxPool", bot: "↓ 2×2",
      cap: "Max-pooling keeps the strongest response in each 2×2 window: half the resolution, more tolerance to where a feature sits." },
    { key: "conv2", kind: "map", mode: "blob", ch: 64, px: 44, dims: "109² × 64", top: "Conv 3×3", bot: "patterns",
      cap: "64 deeper filters fuse the earlier cues into higher-level structure: curves, regions, tissue boundaries." },
    { key: "pool2", kind: "map", mode: "blob", ch: 64, px: 34, dims: "54² × 64", top: "MaxPool", bot: "↓ 2×2",
      cap: "A second pooling pass. The scan is now a compact 54×54 grid across 64 feature channels." },
    { key: "flatten", kind: "flat", dims: "186,624", top: "Flatten", bot: "→ 1-D vector",
      cap: "The feature grid is unrolled into a single 186,624-value vector the classifier can read." },
    { key: "dense", kind: "dense", dims: "128 → 64", top: "Dense + ReLU", bot: "batch-norm",
      cap: "Fully-connected layers (128 → 64, ReLU, batch-norm) weigh the features into evidence for each class." },
    { key: "softmax", kind: "soft", dims: "4 classes", top: "Softmax", bot: "probabilities",
      cap: "A 4-way softmax turns that evidence into probabilities. Here the network commits to Pituitary." },
  ];

  function connector() {
    const c = el("div", { class: "cnn-conn" });
    const s = svg("svg", { width: 22, height: 40, viewBox: "0 0 22 40" }, c);
    svg("path", { d: "M1 20 H16", stroke: AXIS, "stroke-width": 1.5, fill: "none" }, s);
    svg("path", { d: "M12 15 L18 20 L12 25", stroke: AXIS, "stroke-width": 1.5, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
    svg("circle", { class: "pulse", cx: 5, cy: 20, r: 2.4, fill: BLUE }, s);
    return c;
  }

  function buildPipeline(host) {
    host.textContent = "";
    const head = el("div", {}, host);
    el("h4", { text: "How the network reads one scan" }, head);
    el("p", { class: "viz-sub", text: "A single MRI, transformed layer by layer into a diagnosis. Feature maps are illustrative of the custom CNN's architecture; the final probabilities are its real output on the paper's Pituitary example." }, head);

    const scroll = el("div", { class: "cnn-scroll" }, host);
    const flow = el("div", { class: "cnn-flow" }, scroll);
    const stageEls = [];

    STAGES.forEach((st, i) => {
      const stage = el("div", { class: "cnn-stage", tabindex: "0" }, flow);
      stage.setAttribute("role", "button");
      stage.setAttribute("aria-label", `${st.top}: ${st.cap}`);
      const viz = el("div", { class: "cnn-stage-viz" }, stage);

      if (st.kind === "mri") {
        const m = el("div", { class: "mri-input" }, viz); m.appendChild(mriSVG(96));
      } else if (st.kind === "map") {
        viz.appendChild(mapStack(st.mode, st.ch, 100 + i * 7, st.px));
      } else if (st.kind === "flat") {
        const strip = el("div", { class: "flat-strip" }, viz);
        const rng = mulberry32(77);
        for (let k = 0; k < 16; k++) { const c = el("i", {}, strip); c.style.background = heat(0.2 + rng() * 0.8); }
      } else if (st.kind === "dense") {
        const dv = el("div", { class: "dense-viz" }, viz);
        const s = svg("svg", { width: 46, height: 116, viewBox: "0 0 46 116" }, dv);
        const L = [18, 34, 50, 66, 82, 98], R = [26, 45, 64, 83, 102];
        L.forEach((y1) => R.forEach((y2) => svg("line", { x1: 8, y1, x2: 38, y2, stroke: "rgba(57,135,229,0.14)", "stroke-width": 1 }, s)));
        const on = { 0: 1, 2: 1, 4: 1 };
        L.forEach((y, k) => svg("circle", { cx: 8, cy: y, r: 4, fill: on[k] ? BLUE : "#2f4a66" }, s));
        R.forEach((y, k) => svg("circle", { cx: 38, cy: y, r: 4, fill: k === 1 || k === 3 ? BLUE : "#2f4a66" }, s));
      } else if (st.kind === "soft") {
        const sm = el("div", { class: "softmax" }, viz);
        CLASSES.forEach((c, k) => {
          const win = k === 3;
          const row = el("div", { class: "softmax-row" + (win ? " win" : "") }, sm);
          el("span", { class: "sm-name", text: c }, row);
          const track = el("div", { class: "softmax-track" }, row);
          const fill = el("div", { class: "softmax-fill" }, track);
          fill.dataset.w = Math.round(PRED.custom[k] * 100);
        });
      }

      el("div", { class: "cnn-stage-label", html: `<b>${st.top}</b>${st.bot}` }, stage);
      el("div", { class: "cnn-stage-dims", text: st.dims }, stage);

      stage.addEventListener("pointerenter", () => setActive(i));
      stage.addEventListener("focus", () => setActive(i));
      stageEls.push(stage);
      if (i < STAGES.length - 1) flow.appendChild(connector());
    });

    const cap = el("p", { class: "cnn-caption curve-note", text: STAGES[0].cap }, host);
    function setActive(i) {
      stageEls.forEach((s, k) => s.classList.toggle("active", k === i));
      cap.textContent = STAGES[i].cap;
    }

    // animate on view: light stages left→right, then start pulses + softmax fills
    onView(scroll, () => {
      stageEls.forEach((s, i) => setTimeout(() => s.classList.add("lit"), reduceMotion ? 0 : i * 140));
      setTimeout(() => {
        flow.classList.add("running");
        host.querySelectorAll(".softmax-fill").forEach((f) => { f.style.width = f.dataset.w + "%"; });
      }, reduceMotion ? 0 : STAGES.length * 140 + 200);
    }, 0.2);
  }

  /* ==================================================================== *
   *  2. Training curves (real data): line chart engine
   * ==================================================================== */

  function lineChart(host, opts) {
    // opts: { series:[{name,color,values[]}], yMin,yMax,yTicks,fmt, animate }
    host.textContent = "";
    const W = Math.max(280, host.clientWidth || 420);
    const H = 250;
    const m = { l: 40, r: 20, t: 14, b: 30 };
    const plotW = W - m.l - m.r, plotH = H - m.t - m.b;
    const N = 20;
    const xAt = (e) => m.l + ((e - 1) / (N - 1)) * plotW;
    const yAt = (v) => m.t + (1 - (v - opts.yMin) / (opts.yMax - opts.yMin)) * plotH;

    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img" }, host);
    s.style.display = "block";
    s.setAttribute("aria-label", opts.aria || "line chart");

    // gridlines + y ticks
    opts.yTicks.forEach((v) => {
      svg("line", { x1: m.l, y1: yAt(v), x2: W - m.r, y2: yAt(v), stroke: v === opts.yMin ? AXIS : GRID, "stroke-width": 1 }, s);
      const t = svg("text", { x: m.l - 8, y: yAt(v) + 3.5, "text-anchor": "end", fill: MUTED, "font-size": 10.5, "font-family": MONO }, s);
      t.textContent = opts.fmt(v);
    });
    // x ticks (epochs)
    [1, 5, 10, 15, 20].forEach((e) => {
      const t = svg("text", { x: xAt(e), y: H - 10, "text-anchor": "middle", fill: MUTED, "font-size": 10.5, "font-family": MONO }, s);
      t.textContent = e;
    });
    const xl = svg("text", { x: m.l + plotW / 2, y: H + 4, "text-anchor": "middle", fill: MUTED, "font-size": 10, "font-family": MONO }, s);

    // dashed reference lines (e.g. held-out test accuracy), drawn under the series
    (opts.refs || []).forEach((r) => {
      svg("line", { x1: m.l, y1: yAt(r.value), x2: W - m.r, y2: yAt(r.value),
        stroke: r.color, "stroke-width": 1.5, "stroke-dasharray": "5 4", opacity: 0.85 }, s);
    });

    // lines
    const pathFor = (vals) => {
      let d = "";
      vals.forEach((v, k) => { d += (k === 0 ? "M" : "L") + xAt(k + 1).toFixed(1) + " " + yAt(v).toFixed(1) + " "; });
      return d;
    };
    const paths = [];
    opts.series.forEach((ser) => {
      if (opts.smooth) {
        // raw per-epoch, kept faint behind the trend, nothing hidden, just de-emphasized
        svg("path", { d: pathFor(ser.values), fill: "none", stroke: ser.color, "stroke-width": 1.5,
          opacity: 0.22, "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
        // bold smoothed trend, the line you read
        const p = svg("path", { d: pathFor(smoothSeries(ser.values)), fill: "none", stroke: ser.color,
          "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
        paths.push(p);
      } else {
        const p = svg("path", { d: pathFor(ser.values), fill: "none", stroke: ser.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
        paths.push(p);
        // endpoint dot with surface ring (value lives in tooltip + table + test chips)
        svg("circle", { cx: xAt(N), cy: yAt(ser.values[N - 1]), r: 4.5, fill: ser.color, stroke: SURFACE, "stroke-width": 2 }, s);
      }
    });

    if (opts.animate && !reduceMotion) {
      paths.forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.style.transition = "stroke-dashoffset 1.5s var(--ease-out)";
      });
      onView(s, () => paths.forEach((p) => { p.style.strokeDashoffset = 0; }), 0.3);
    }

    // reference-line labels, on top of everything with a dark halo for legibility
    (opts.refs || []).forEach((r) => {
      const t = svg("text", { x: W - m.r, y: yAt(r.value) - 5, "text-anchor": "end",
        fill: r.color, "font-size": 10, "font-family": MONO, "font-weight": 600,
        stroke: BG, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round" }, s);
      t.textContent = r.label;
    });

    // crosshair + hover
    const cross = svg("line", { y1: m.t, y2: m.t + plotH, stroke: "rgba(255,255,255,0.22)", "stroke-width": 1, opacity: 0 }, s);
    const dots = opts.series.map((ser) => svg("circle", { r: 4, fill: ser.color, stroke: SURFACE, "stroke-width": 2, opacity: 0 }, s));
    const hit = svg("rect", { x: m.l, y: m.t, width: plotW, height: plotH, fill: "transparent" }, s);
    function toEpoch(evt) {
      const r = s.getBoundingClientRect();
      const px = (evt.clientX - r.left) * (W / r.width);
      let e = Math.round((px - m.l) / plotW * (N - 1)) + 1;
      return Math.max(1, Math.min(N, e));
    }
    function show(evt) {
      const e = toEpoch(evt);
      cross.setAttribute("x1", xAt(e)); cross.setAttribute("x2", xAt(e)); cross.setAttribute("opacity", 1);
      tip.textContent = "";
      el("b", { text: "Epoch " + e }, tip);
      opts.series.forEach((ser, i) => {
        dots[i].setAttribute("cx", xAt(e)); dots[i].setAttribute("cy", yAt(ser.values[e - 1])); dots[i].setAttribute("opacity", 1);
        const row = el("div", { style: "display:flex;align-items:center;gap:8px;margin-top:4px" }, tip);
        const key = el("span", {}, row);
        key.style.cssText = `width:14px;height:2px;border-radius:2px;background:${ser.color};flex:0 0 auto`;
        el("span", { text: opts.fmt(ser.values[e - 1], true), style: "color:#f4f2ec;font-weight:600" }, row);
        el("span", { text: ser.name, style: "color:#898781;font-size:12px" }, row);
      });
      tip.classList.add("show"); tipMove(evt);
    }
    function hide() { cross.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); tipHide(); }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerenter", show);
    hit.addEventListener("pointerleave", hide);
  }

  function buildTraining(host) {
    host.textContent = "";
    el("h4", { text: "What 20 epochs of training looked like" }, host);
    el("p", { class: "viz-sub", html: "Validation accuracy across training, digitized from the paper's figures. The <b>bold line is the trend</b>; the faint line is the raw per-epoch value. The dashed line marks each model's final accuracy on the held-out <b>test</b> set." }, host);

    const controls = el("div", { class: "curve-controls" }, host);
    const seg = el("div", { class: "seg", role: "tablist", "aria-label": "Which model to plot" }, controls);
    const MODES = [
      { id: "compare", label: "Compare" },
      { id: "vgg", label: "VGG16 · transfer" },
      { id: "custom", label: "Custom CNN" },
    ];
    let mode = "compare";
    const legend = el("div", { class: "legend" }, controls);

    const charts = el("div", { class: "curve-charts" }, host);
    const accWrap = el("div", { class: "curve-chart" }, charts);
    el("h5", { text: "Accuracy" }, accWrap);
    const accHost = el("figure", {}, accWrap); accHost.style.margin = 0;
    const lossWrap = el("div", { class: "curve-chart" }, charts);
    el("h5", { text: "Loss" }, lossWrap);
    const lossHost = el("figure", {}, lossWrap); lossHost.style.margin = 0;

    const chips = el("div", { class: "test-chips" }, host);
    el("span", { class: "tc-label", text: "Reported test accuracy" }, chips);
    [["VGG16 · transfer", "95%", BLUE], ["Custom CNN", "80%", GREEN]].forEach(([n, v, c]) => {
      const chip = el("span", { class: "tc-chip" }, chips);
      const dot = el("span", { class: "tc-dot" }, chip); dot.style.background = c;
      el("b", { text: v }, chip);
      el("span", { text: n }, chip);
    });

    const note = el("p", { class: "curve-note" }, host);

    function seriesFor(mode, metric) {
      const acc = metric === "acc";
      if (mode === "compare") {
        return [
          { name: "VGG16 (validation)", color: BLUE, values: acc ? DATA.vgg.valAcc : DATA.vgg.valLoss },
          { name: "Custom CNN (validation)", color: GREEN, values: acc ? DATA.custom.valAcc : DATA.custom.valLoss },
        ];
      }
      const d = DATA[mode], base = mode === "vgg" ? BLUE : GREEN, light = mode === "vgg" ? BLUE_LIGHT : GREEN_LIGHT;
      return [
        { name: "Training", color: light, values: acc ? d.trainAcc : d.trainLoss },
        { name: "Validation", color: base, values: acc ? d.valAcc : d.valLoss },
      ];
    }
    const NOTES = {
      compare: "VGG16 climbs higher and steadier from the first few epochs, its ImageNet-learned edge and texture detectors transfer cleanly to MRI. On the held-out <b>test</b> set (dashed) that lead holds: <b>95%</b> versus <b>80%</b> for the same network trained from scratch.",
      vgg: "Training and validation track closely and both stay high, the pre-trained base generalizes with little over-fitting even after fine-tuning. It lands at <b>95%</b> on the held-out test set.",
      custom: "A wide gap between training and validation: the from-scratch model fits the training set faster than it generalizes, the classic case for regularization and, ultimately, transfer learning. It reaches <b>80%</b> on the held-out test set.",
    };

    let animated = false;
    function render() {
      // legend
      legend.textContent = "";
      seriesFor(mode, "acc").forEach((ser) => {
        const k = el("span", { class: "key" }, legend);
        const sw = el("span", { class: "swatch" }, k); sw.style.background = ser.color; sw.style.height = "3px"; sw.style.borderRadius = "2px";
        el("span", { text: ser.name }, k);
      });
      const accRefs = mode === "compare"
        ? [{ value: 0.95, color: BLUE, label: "VGG16 test · 95%" }, { value: 0.80, color: GREEN, label: "Custom test · 80%" }]
        : mode === "vgg"
          ? [{ value: 0.95, color: BLUE, label: "test · 95%" }]
          : [{ value: 0.80, color: GREEN, label: "test · 80%" }];
      lineChart(accHost, {
        series: seriesFor(mode, "acc"), yMin: 0.3, yMax: 1.0, yTicks: [0.4, 0.6, 0.8, 1.0],
        refs: accRefs, smooth: true,
        fmt: (v, tip) => Math.round(v * 100) + (tip ? "%" : ""), animate: !animated,
        aria: "Validation accuracy trend with raw per-epoch values and held-out test accuracy (dashed) for the selected model(s).",
      });
      lineChart(lossHost, {
        series: seriesFor(mode, "loss"), yMin: 0, yMax: 2.2, yTicks: [0, 0.5, 1.0, 1.5, 2.0],
        smooth: true,
        fmt: (v, tip) => v.toFixed(tip ? 2 : 1), animate: !animated,
        aria: "Loss trend with raw per-epoch values for the selected model(s).",
      });
      note.innerHTML = NOTES[mode];
      animated = true;
    }

    MODES.forEach((mo) => {
      const b = el("button", { role: "tab", text: mo.label, "aria-selected": String(mo.id === mode) }, seg);
      b.addEventListener("click", () => {
        mode = mo.id;
        [...seg.children].forEach((c, i) => c.setAttribute("aria-selected", String(MODES[i].id === mode)));
        animated = true; render();
      });
    });

    render();
    let rt = null;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { animated = true; render(); }, 200); });

    // table view
    const det = el("details", { class: "table-toggle" }, host);
    el("summary", { text: "View all data (both models, 20 epochs)" }, det);
    const tbl = el("table", {}, det);
    const thead = el("thead", {}, tbl); const htr = el("tr", {}, thead);
    ["Epoch", "VGG16 val acc", "VGG16 val loss", "CNN val acc", "CNN val loss"].forEach((h) => el("th", { scope: "col", text: h }, htr));
    const tb = el("tbody", {}, tbl);
    for (let i = 0; i < 20; i++) {
      const tr = el("tr", {}, tb);
      el("td", { text: i + 1 }, tr);
      el("td", { text: Math.round(DATA.vgg.valAcc[i] * 100) + "%" }, tr);
      el("td", { text: DATA.vgg.valLoss[i].toFixed(2) }, tr);
      el("td", { text: Math.round(DATA.custom.valAcc[i] * 100) + "%" }, tr);
      el("td", { text: DATA.custom.valLoss[i].toFixed(2) }, tr);
    }
  }

  /* ==================================================================== *
   *  3. Confidence: real prediction probabilities
   * ==================================================================== */

  function buildConfidence(host) {
    host.textContent = "";
    el("h4", { text: "Right answer, very different conviction" }, host);
    el("p", { class: "viz-sub", text: "Both models classify the same scan correctly as Pituitary, the paper's example output. But look at where each one places its probability mass." }, host);

    const grid = el("div", { class: "conf-grid" }, host);
    const left = el("div", {}, grid);
    el("p", { class: "conf-headline",
      html: 'Transfer learning was <b>100%</b> certain of Pituitary. The custom CNN got there too, at only <span class="g">84%</span>, and scattered the rest onto tumor types that weren\'t in the scan.' }, left);
    el("p", { class: "conf-sub", text: "That confidence gap is why transfer learning is the safer basis for a triage tool: a decisive, well-calibrated \"this one, and only this one.\"" }, left);
    const lg = el("div", { class: "legend", style: "margin-top:22px" }, left);
    [["VGG16 (transfer)", BLUE], ["Custom CNN", GREEN]].forEach(([n, c]) => {
      const k = el("span", { class: "key" }, lg);
      const sw = el("span", { class: "swatch" }, k); sw.style.background = c;
      el("span", { text: n }, k);
    });

    const rows = el("div", { class: "conf-rows" }, grid);
    const fills = [];
    CLASSES.forEach((c, k) => {
      const correct = k === 3;
      const row = el("div", { class: "conf-row" + (correct ? " correct" : "") }, rows);
      const head = el("div", { class: "conf-class" }, row);
      el("span", { class: "cc-name", text: c }, head);
      const bars = el("div", { class: "conf-bars" }, row);
      [["TRANSFER", PRED.transfer[k], "transfer"], ["CUSTOM", PRED.custom[k], "custom"]].forEach(([key, val, cls]) => {
        const bar = el("div", { class: "conf-bar" }, bars);
        el("span", { class: "cb-key", text: key }, bar);
        const track = el("div", { class: "cb-track" }, bar);
        const fill = el("div", { class: "cb-fill " + cls }, track);
        fill.dataset.w = (val * 100).toFixed(0);
        fills.push(fill);
        el("span", { class: "cb-val", text: Math.round(val * 100) + "%" }, bar);
      });
    });
    onView(rows, () => fills.forEach((f) => { f.style.width = f.dataset.w + "%"; }));
  }

  /* ==================================================================== *
   *  4. Dataset split
   * ==================================================================== */

  function buildDataset(host) {
    function draw() {
      host.textContent = "";
      const total = 7043, train = 5712, test = 1331;
      const W = Math.max(280, host.clientWidth || 500), narrow = W < 460;
      const H = narrow ? 116 : 92, m = { l: 4, r: 4 }, plotW = W - m.l - m.r;
      const barH = 26, y = 30, gap = 2;
      const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", "aria-hidden": "true" }, host);
      s.style.display = "block";
      const trainW = (train / total) * plotW - gap / 2, testW = (test / total) * plotW - gap / 2;
      const r1 = svg("rect", { x: m.l, y, height: barH, rx: 4, fill: BLUE, width: 0 }, s);
      const r2 = svg("rect", { x: m.l + trainW + gap, y, height: barH, rx: 4, fill: BLUE_LIGHT, width: 0 }, s);
      onView(s, () => { r1.setAttribute("width", trainW); r2.setAttribute("width", testW); r1.style.transition = r2.style.transition = "width 1.1s var(--ease-out)"; });
      const l1 = svg("text", { x: m.l, y: y - 9, fill: MUTED, "font-size": 12, "font-family": MONO }, s); l1.textContent = "Training: 5,712 (81%)";
      const l2 = svg("text", { x: m.l + plotW, y: narrow ? y + barH + 20 : y - 9, "text-anchor": "end", fill: MUTED, "font-size": 12, "font-family": MONO }, s); l2.textContent = "Testing: 1,331 (19%)";
      const cap = svg("text", { x: m.l, y: (narrow ? y + barH + 40 : y + barH + 20), fill: MUTED, "font-size": 11.5, "font-family": MONO }, s);
      cap.textContent = narrow ? "7,043 images total" : "7,043 labeled MRI images · test set further split into validation + test";
    }
    draw();
    let rt = null; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 200); });
  }

  /* ==================================================================== *
   *  5. Architecture explorer
   * ==================================================================== */

  const ARCH = {
    custom: [
      { n: "Input", d: "224 × 224 × 3", h: 1.0, t: "RGB MRI scan, resized to a uniform 224×224 so every input has identical dimensions; pixels normalized to [0, 1]." },
      { n: "Conv 32", d: "3×3 · ReLU", h: 0.95, t: "32 filters slide across the image extracting low-level features: edges, textures, intensity gradients." },
      { n: "MaxPool", d: "2×2", h: 0.5, t: "Halves the spatial dimensions, keeping the strongest activation in each 2×2 window." },
      { n: "Dropout", d: "20%", h: 0.5, t: "Randomly silences 20% of neurons during training so no single feature detector becomes a crutch." },
      { n: "Conv 64", d: "3×3 · ReLU", h: 0.45, t: "64 filters build on the first layer to detect more complex, composite patterns." },
      { n: "MaxPool", d: "2×2", h: 0.25, t: "A second downsampling pass, the scan becomes a compact grid of high-level features." },
      { n: "Dropout", d: "20%", h: 0.25, t: "Second regularization pass on the pooled feature maps." },
      { n: "Flatten", d: "2D → 1D", h: 0.2, t: "The feature maps unroll into a single vector for the fully connected layers." },
      { n: "Dense 128", d: "ReLU + BatchNorm", h: 0.35, t: "128 neurons learn high-level combinations of features; batch normalization keeps training stable." },
      { n: "Dense 64", d: "ReLU", h: 0.25, t: "A second dense layer refines the representation before classification." },
      { n: "Dropout", d: "10%", h: 0.25, t: "A lighter dropout pass just before the output layer." },
      { n: "Softmax", d: "4 classes", h: 0.15, t: "Four neurons emit a probability for each diagnosis: glioma, meningioma, pituitary, or no tumor." },
    ],
    vgg: [
      { n: "Input", d: "224 × 224 × 3", h: 1.0, t: "Same preprocessing: VGG16 natively expects 224×224 RGB input." },
      { n: "VGG16 base", d: "13 conv · frozen", h: 0.8, t: "The entire ImageNet-pretrained convolutional stack, frozen initially: years of learned edge, texture, and shape detectors, for free. Some layers were unfrozen later to fine-tune." },
      { n: "Flatten", d: "2D → 1D", h: 0.2, t: "VGG16's feature maps unroll into a vector for the new classification head." },
      { n: "Dense 128", d: "ReLU + BatchNorm", h: 0.35, t: "A fresh layer that maps ImageNet features onto MRI pathology; batch normalization stabilizes it." },
      { n: "Dropout", d: "10%", h: 0.35, t: "Regularization on the new head: the pretrained base doesn't need it, the fresh layers do." },
      { n: "Dense 64", d: "ReLU", h: 0.25, t: "Second dense layer of the head, fine-tuned at a gentle 0.0001 learning rate." },
      { n: "Dropout", d: "regularize", h: 0.25, t: "Final over-fitting guard before classification." },
      { n: "Softmax", d: "4 classes", h: 0.15, t: "Probabilities for the four classes, noticeably more confident than the custom CNN." },
    ],
  };

  function buildArch(flow, detail, tabCustom, tabVgg) {
    let current = "custom", selected = 0;
    function renderDetail(model, i) {
      const l = ARCH[model][i];
      detail.textContent = "";
      el("h5", { text: `${i + 1} / ${ARCH[model].length} · ${l.n}` }, detail);
      el("span", { class: "dims", text: l.d }, detail);
      el("p", { text: l.t }, detail);
    }
    function render(model) {
      current = model; selected = Math.min(selected, ARCH[model].length - 1);
      flow.textContent = "";
      ARCH[model].forEach((layer, i) => {
        const btn = el("button", { class: "arch-layer", type: "button", role: "tab", "aria-selected": String(i === selected) }, flow);
        const viz = el("span", { class: "bar-viz" }, btn);
        const bar = el("i", {}, viz); bar.style.height = Math.round(layer.h * 100) + "%";
        el("span", { text: layer.n }, btn);
        el("small", { text: layer.d }, btn);
        btn.addEventListener("click", () => select(i));
        btn.addEventListener("pointerenter", () => renderDetail(current, i));
        btn.addEventListener("pointerleave", () => renderDetail(current, selected));
      });
      renderDetail(model, selected);
    }
    function select(i) { selected = i; [...flow.children].forEach((b, j) => b.setAttribute("aria-selected", String(j === i))); renderDetail(current, i); }
    flow.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const nx = e.key === "ArrowRight" ? Math.min(selected + 1, ARCH[current].length - 1) : Math.max(selected - 1, 0);
      select(nx); flow.children[nx].focus();
    });
    function activate(model) { selected = 0; tabCustom.setAttribute("aria-selected", String(model === "custom")); tabVgg.setAttribute("aria-selected", String(model === "vgg")); render(model); }
    tabCustom.addEventListener("click", () => activate("custom"));
    tabVgg.addEventListener("click", () => activate("vgg"));
    render("custom");
  }

  /* ------------------------------- init ------------------------------- */
  function init() {
    const pipe = document.getElementById("viz-pipeline"); if (pipe) buildPipeline(pipe);
    const train = document.getElementById("viz-training"); if (train) buildTraining(train);
    const conf = document.getElementById("viz-confidence"); if (conf) buildConfidence(conf);
    const dset = document.getElementById("viz-dataset"); if (dset) buildDataset(dset);
    const af = document.getElementById("arch-flow"), ad = document.getElementById("arch-detail");
    const tc = document.getElementById("tab-custom"), tv = document.getElementById("tab-vgg");
    if (af && ad && tc && tv) buildArch(af, ad, tc, tv);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
