/* Общий слой движения — разметка описана в motion.css.
   Подключать в <head> без defer: сразу ставит html.m-on (иначе контент мигнёт до скрытия).
   API: window.TVSU_MOTION.scan(root) — подхватить узлы, вставленные позже (фильтры, смена аудитории);
        window.TVSU_MOTION.reveal(el) — показать немедленно; .reduce — MediaQueryList. */
(function () {
  "use strict";
  const doc = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!reduce.matches && "IntersectionObserver" in window) doc.classList.add("m-on");

  const seen = new WeakSet();
  const proxies = new WeakMap(); // родитель → шторки внутри него
  let io = null;

  const msList = (v) => v.split(",").map((x) => parseFloat(x) * (x.trim().endsWith("ms") ? 1 : 1000));
  function reveal(el) {
    if (el.hasAttribute("data-m") && !el.classList.contains("m-in") && doc.classList.contains("m-on")) {
      el.classList.add("m-run");
      const cs = getComputedStyle(el);
      const d = msList(cs.transitionDuration), dl = msList(cs.transitionDelay);
      const total = Math.max(0, ...d.map((x, i) => x + (dl[i % dl.length] || 0)));
      setTimeout(() => el.classList.remove("m-run"), total + (el.dataset.m === "mask" ? 500 : 0) + 80);
    }
    el.classList.add("m-in");
    if (el.hasAttribute("data-count")) countUp(el);
    el.querySelectorAll?.("[data-count]:not([data-m])").forEach(countUp);
  }

  /* ───── Слова заголовка ───── */
  function splitWords(el) {
    if (el.dataset.mSplit) return;
    el.dataset.mSplit = "1";
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/([ \t\n\r]+)/); // неразрывный пробел держит слова вместе
          if (!parts.some((p) => p.trim())) return;
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (!/[^ \t\n\r]/.test(p)) { frag.append(document.createTextNode(p)); return; }
            const w = document.createElement("span");
            w.className = "m-w";
            const wi = document.createElement("span");
            wi.className = "m-wi";
            wi.style.setProperty("--m-wi", i++);
            wi.textContent = p;
            w.append(wi);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !/^(BR|SVG|IMG)$/.test(n.nodeName)) {
          walk(n);
        }
      });
    };
    walk(el);
  }

  /* ───── Счётчики ───── */
  function countUp(el) {
    if (el.dataset.mCounted) return;
    el.dataset.mCounted = "1";
    const text = el.textContent;
    const m = text.match(/(?:(?<![\p{L}\d])-)?\d[\d\s  ]*(?:[.,]\d+)?/u); // «топ-200» — не минус
    if (!m || reduce.matches) return;
    const raw = m[0];
    const sep = (raw.match(/[\s  ]/) || [""])[0];
    const decimals = (raw.split(/[.,]/)[1] || "").length;
    const target = parseFloat(raw.replace(/[\s  ]/g, "").replace(",", "."));
    const from = el.hasAttribute("data-count-from") ? parseFloat(el.dataset.countFrom) : 0;
    const dur = parseFloat(el.dataset.countDur) || 1400;
    const fmt = (v) => {
      let s = v.toFixed(decimals);
      if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      if (raw.includes(",")) s = s.replace(".", ",");
      return text.slice(0, m.index) + s + text.slice(m.index + raw.length);
    };
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      el.textContent = fmt(from + (target - from) * e);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = text;
    };
    el.textContent = fmt(from);
    requestAnimationFrame(tick);
  }

  /* ───── Магнит и наклон (только мышь) ───── */
  function magnetic(el) {
    const strength = parseFloat(el.dataset.magnetic) || 0.3;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(loop);
      else { raf = 0; if (!tx && !ty) el.style.translate = ""; }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * strength;
      ty = (e.clientY - r.top - r.height / 2) * strength;
      kick();
    });
    el.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
  }

  function tilt(el) {
    const max = parseFloat(el.dataset.tilt) || 5;
    let rx = 0, ry = 0, trx = 0, try_ = 0, raf = 0;
    const loop = () => {
      rx += (trx - rx) * 0.12; ry += (try_ - ry) * 0.12;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      if (Math.abs(trx - rx) > 0.02 || Math.abs(try_ - ry) > 0.02) raf = requestAnimationFrame(loop);
      else { raf = 0; if (!trx && !try_) el.style.transform = ""; }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      try_ = px * max * 2; trx = -py * max * 2;
      el.style.setProperty("--mx", (px + 0.5) * 100 + "%");
      el.style.setProperty("--my", (py + 0.5) * 100 + "%");
      kick();
    });
    el.addEventListener("pointerleave", () => { trx = 0; try_ = 0; kick(); });
  }

  /* ───── Параллакс (один rAF на всех) ───── */
  const plx = [];
  let plxRaf = 0;
  function plxFrame() {
    plxRaf = 0;
    const vh = window.innerHeight;
    for (const it of plx) {
      const r = it.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const off = (r.top + r.height / 2 - vh / 2) * it.k;
      it.el.style.translate = `0 ${(-off).toFixed(1)}px`;
    }
  }
  const plxKick = () => { if (!plxRaf) plxRaf = requestAnimationFrame(plxFrame); };

  function scan(root = document) {
    const on = doc.classList.contains("m-on");
    root.querySelectorAll("[data-m-stagger]").forEach((box) => {
      [...box.querySelectorAll(":scope > [data-m], :scope > * > [data-m]")].forEach((el, i) => el.style.setProperty("--m-i", i));
    });
    const own = root.nodeType === 1 && root.matches("[data-m], [data-m-line], [data-count]") ? [root] : [];
    [...own, ...root.querySelectorAll("[data-m], [data-m-line], [data-count]")].forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      if (el.dataset.mDelay) el.style.setProperty("--m-delay", el.dataset.mDelay + "ms");
      if (el.dataset.m === "words" && on) splitWords(el);
      if (el.hasAttribute("data-m-line") && el.getTotalLength) el.setAttribute("pathLength", "1");
      if (!on) { el.classList.add("m-in"); return; }
      // Шторки полностью скрыты clip-path — IntersectionObserver их не видит; следим за родителем
      // Карточки горизонтальных лент за краем тоже не пересекают экран — следим за самой лентой
      const clipped = el.dataset.m === "mask" || el.dataset.m === "wipe";
      const scroller = el.closest(".ribbon__track, [data-m-scroller]");
      const target = scroller && scroller !== el ? scroller : clipped && el.parentElement ? el.parentElement : el;
      if (target !== el) {
        const list = proxies.get(target) || [];
        list.push(el);
        proxies.set(target, list);
      }
      io.observe(target);
    });
    if (on && finePointer.matches) {
      root.querySelectorAll("[data-magnetic]:not([data-m-mag])").forEach((el) => { el.dataset.mMag = ""; magnetic(el); });
      root.querySelectorAll("[data-tilt]:not([data-m-tilt])").forEach((el) => { el.dataset.mTilt = ""; tilt(el); });
    }
    if (on) {
      root.querySelectorAll("[data-parallax]:not([data-m-plx])").forEach((el) => {
        el.dataset.mPlx = "";
        plx.push({ el, k: parseFloat(el.dataset.parallax) || 0.1 });
      });
      if (plx.length) plxKick();
    }
  }

  function init() {
    if (doc.classList.contains("m-on")) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const list = proxies.get(e.target);
          if (list) { list.forEach(reveal); proxies.delete(e.target); }
          if (list && !e.target.matches("[data-m], [data-m-line], [data-count]")) { io.unobserve(e.target); return; }
          io.unobserve(e.target);
          reveal(e.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      window.addEventListener("scroll", plxKick, { passive: true });
      window.addEventListener("resize", plxKick, { passive: true });
    }
    scan();
    // Страховка: всё, что уже выше низа экрана (например, после якорного перехода), показывается сразу
    requestAnimationFrame(() => {
      document.querySelectorAll("[data-m]:not(.m-in), [data-m-line]:not(.m-in)").forEach((el) => {
        if (el.getBoundingClientRect().bottom < 0) { io?.unobserve(el); reveal(el); }
      });
    });
    reduce.addEventListener?.("change", () => {
      if (reduce.matches) {
        doc.classList.remove("m-on");
        document.querySelectorAll("[data-m], [data-m-line]").forEach((el) => el.classList.add("m-in"));
      }
    });
  }

  window.TVSU_MOTION = { scan, reveal, reduce, finePointer };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
