/* =====================================================================
   Faysics: the scan-to-glasses pipeline, told in five plain steps.
   Minimal by design: a title and one sentence per step, no jargon.
   ===================================================================== */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  function onView(node, cb) {
    if (reduceMotion) { cb(); return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { io.disconnect(); cb(); }
    }, { threshold: 0.2 });
    io.observe(node);
  }

  const STEPS = [
    { title: "Scan the face", text: "The TrueDepth camera captures the whole face in color and 3D from every angle." },
    { title: "Find the features", text: "AI marks the same key points on every face and locates the ears." },
    { title: "Build the 3D model", text: "Every frame is fused into one detailed 3D mesh on the phone." },
    { title: "Line it up", text: "The scan is aligned to a standard reference so measurements stay consistent." },
    { title: "Measure & design", text: "Key distances are read off the model and the frame is drafted to fit." },
  ];

  function build(host) {
    host.textContent = "";

    const head = el("div", { class: "fpx-panel-head" }, host);
    el("h4", { text: "How a scan becomes a pair of glasses" }, head);
    el("p", { class: "viz-sub", text: "Five steps, all running on the phone." }, head);

    const steps = el("div", { class: "fpx-steps" }, host);
    const nodes = [];
    STEPS.forEach((s, i) => {
      const step = el("div", { class: "fpx-step" }, steps);
      const top = el("div", { class: "fpx-step-top" }, step);
      el("span", { class: "fpx-step-num", text: String(i + 1) }, top);
      el("h5", { text: s.title }, step);
      el("p", { text: s.text }, step);
      nodes.push(step);
    });

    el("p", { class: "fpx-built", text: "Built with ARKit · MediaPipe · Vision · Open3D · SceneKit" }, host);

    // Gentle highlight that walks the steps in order, so the sequence reads
    // even at a glance. Pauses off-screen, yields to hover, off for reduced motion.
    if (!reduceMotion) {
      let i = -1, timer = null;
      const tick = () => {
        nodes.forEach((n) => n.classList.remove("seq"));
        i = (i + 1) % nodes.length;
        nodes[i].classList.add("seq");
        timer = setTimeout(tick, i === nodes.length - 1 ? 2400 : 1300);
      };
      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
      new IntersectionObserver((es) => {
        for (const e of es) {
          if (e.isIntersecting && !timer) tick();
          else if (!e.isIntersecting) { stop(); nodes.forEach((n) => n.classList.remove("seq")); }
        }
      }, { threshold: 0.2 }).observe(steps);
      nodes.forEach((n) => {
        n.addEventListener("pointerenter", () => { stop(); nodes.forEach((x) => x.classList.remove("seq")); n.classList.add("seq"); });
        n.addEventListener("pointerleave", () => n.classList.remove("seq"));
      });
    }

    onView(steps, () => nodes.forEach((n, k) => setTimeout(() => n.classList.add("in"), k * 100)));
  }

  function init() {
    const host = document.getElementById("faysics-system");
    if (host) build(host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
