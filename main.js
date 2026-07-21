/* Shared behavior: nav state, scroll reveals, in-view video playback,
   counters, and a light parallax on the hero glow. */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav background on scroll ---------- */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Scroll reveals ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Videos: play only while visible ---------- */
  const loopVideos = document.querySelectorAll("video[muted]");
  if (loopVideos.length) {
    const vio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target;
          if (e.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: 0.3 }
    );
    loopVideos.forEach((v) => {
      v.muted = true; // belt-and-braces for autoplay policies
      vio.observe(v);
    });
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const fmt = (el, val) => {
      const decimals = Number(el.dataset.decimals || 0);
      const suffix = el.dataset.suffix || "";
      const n = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US");
      el.textContent = n + suffix;
    };
    const cio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target;
          cio.unobserve(el);
          const target = parseFloat(el.dataset.count);
          if (reduceMotion) { fmt(el, target); continue; }
          const t0 = performance.now();
          const dur = 1200;
          const tick = (t) => {
            const p = Math.min((t - t0) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 4);
            fmt(el, target * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------- Hero glow parallax ---------- */
  const glow = document.getElementById("heroGlow");
  if (glow && !reduceMotion) {
    let raf = null;
    window.addEventListener(
      "scroll",
      () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          glow.style.transform = `translateY(${window.scrollY * 0.18}px)`;
          raf = null;
        });
      },
      { passive: true }
    );
  }

  /* ---------- Reading progress (research page) ---------- */
  const bar = document.querySelector(".progress-bar");
  if (bar) {
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* ---------- TOC scrollspy (research page) ---------- */
  const tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length) {
    const map = new Map();
    tocLinks.forEach((a) => {
      const target = document.getElementById(a.getAttribute("href").slice(1));
      if (target) map.set(target, a);
    });
    const sio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            tocLinks.forEach((a) => a.classList.remove("active"));
            const link = map.get(e.target);
            if (link) link.classList.add("active");
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    map.forEach((_, target) => sio.observe(target));
  }
})();
