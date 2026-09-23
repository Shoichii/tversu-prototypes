/* Поведение общих компонентов: табы, ленты со стрелками, видео под reduced-motion, состояния.
   Подключение: <script src="…/system/ui.js" defer></script> (после partials.js).
   Разметка табов:
     <div class="tabs" data-tabs>
       <div class="tabs__list" role="tablist" aria-label="…">
         <button class="tab" role="tab" aria-selected="true" aria-controls="p1" id="t1">…</button> …
       </div>
       <div class="tabs__panel" role="tabpanel" id="p1" aria-labelledby="t1" tabindex="0">…</div> …
     </div>
   Лента: <div class="ribbon" data-ribbon> … <button data-ribbon-prev> <button data-ribbon-next> … <div class="ribbon__track">…</div></div>
   Состояния: ?state=accordion-open раскрывает первый пункт каждого .accordion. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const states = new Set(
    (new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean)
  );

  function initTabs(root) {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const k = e.key;
        let n = null;
        if (k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (k === "Home") n = tabs[0];
        if (k === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  }

  function initRibbon(root) {
    const track = root.querySelector(".ribbon__track");
    const prev = root.querySelector("[data-ribbon-prev]");
    const next = root.querySelector("[data-ribbon-next]");
    if (!track) return;
    const step = () => {
      const item = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const w = item ? item.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      return Math.max(w, Math.floor(track.clientWidth / w) * w);
    };
    const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reduce.matches ? "auto" : "smooth" });
    prev?.addEventListener("click", () => go(-1));
    next?.addEventListener("click", () => go(1));
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    };
    track.addEventListener("scroll", update, { passive: true });
    new ResizeObserver(update).observe(track);
    update();
    // клавиатура: лента фокусируемая, стрелки листают
    if (!track.hasAttribute("tabindex")) track.tabIndex = 0;
    track.addEventListener("keydown", (e) => {
      if (e.target !== track) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
  }

  function syncVideos() {
    document.querySelectorAll("video[autoplay], video[data-bg]").forEach((v) => {
      if (reduce.matches) { v.pause(); v.removeAttribute("autoplay"); }
      else if (v.dataset.bg !== undefined && v.paused) v.play().catch(() => {});
    });
  }

  function init() {
    document.querySelectorAll("[data-tabs]").forEach(initTabs);
    document.querySelectorAll("[data-ribbon]").forEach(initRibbon);
    syncVideos();
    reduce.addEventListener?.("change", syncVideos);
    if (states.has("accordion-open")) {
      document.querySelectorAll(".accordion").forEach((a) => a.querySelector("details")?.setAttribute("open", ""));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
