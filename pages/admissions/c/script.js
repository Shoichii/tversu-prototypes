/* Приёмка c — «Видео-приглашение»: фоновый луп hero (720p на ≥768, на мобильном постер + кнопка и 480p),
   пауза, полоса счётчиков, модалка ролика. ?state=video-open — открыта модалка; ?state=deadline — 4 дня до конца приёма. */
(function () {
  "use strict";
  const ADM = window.ADM;
  if (ADM.states.has("deadline")) ADM.todayOverride = "2027-07-21";
  const daysWord = (n) => ADM.plural(Math.abs(n), "день", "дня", "дней");
  const wide = window.matchMedia("(min-width: 768px)");

  function initHeroVideo() {
    const v = document.querySelector("[data-hero-video]");
    const play = document.querySelector("[data-hero-play]");
    const pause = document.querySelector("[data-hero-pause]");
    const label = document.querySelector("[data-hero-pause-label]");
    if (!v) return;

    const setPaused = (p) => {
      pause.setAttribute("aria-pressed", String(p));
      label.textContent = p ? "Воспроизвести видео" : "Пауза видео";
      pause.classList.toggle("is-paused", p);
    };
    const start = (src) => {
      if (!v.getAttribute("src")) v.src = src;
      v.play().then(() => { pause.hidden = false; setPaused(false); }).catch(() => { pause.hidden = true; });
    };

    if (ADM.reduce.matches) {
      // постер вместо лупа; запуск только по явному нажатию
      play.hidden = false;
    } else if (wide.matches) {
      start(v.dataset.src);
    } else {
      play.hidden = false; // мобильный: тяжёлый файл не грузим без спроса
    }

    play.addEventListener("click", () => {
      play.hidden = true;
      v.setAttribute("data-bg", "");
      start(wide.matches ? v.dataset.src : v.dataset.srcMobile);
    });
    pause.addEventListener("click", () => {
      if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
    });
    // без reduce ui.js сам запускает data-bg; на мобильном снимаем флаг, чтобы не было попытки без src
    if (!wide.matches || ADM.reduce.matches) v.removeAttribute("data-bg");
  }

  function initCounters() {
    const box = document.querySelector("[data-counters]");
    const s = ADM.daysUntil(box.dataset.start), e = ADM.daysUntil(box.dataset.end);
    let label, n;
    if (s > 0) { label = "До старта приёма документов"; n = s; }
    else if (e >= 0) { label = "До конца приёма документов"; n = e; box.classList.add("is-urgent"); }
    else { label = "Приём 2027 завершён"; n = 0; }
    box.querySelector("[data-counter-label]").textContent = label;
    box.querySelector("[data-counter-unit]").textContent = daysWord(n);
    const num = box.querySelector("[data-counter-days]");
    // докрутка, когда полоса попала в кадр
    if ("IntersectionObserver" in window && !ADM.reduce.matches) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { ADM.countTo(num, n, { duration: 800 }); io.disconnect(); } }, { threshold: 0.5 });
      io.observe(box);
    } else num.textContent = n;
    const sticky = document.querySelector("[data-sticky-days]");
    if (sticky) sticky.textContent = `${label.replace(" документов", "")}: ${n} ${daysWord(n)}`;
  }

  /* Модалка ролика раскрывается ИЗ карточки: FLIP по прямоугольнику постера. Диалог сначала ставится
     на место карточки (равномерный масштаб «cover» + clip-path по её рамке), затем разворачивается
     в центр — 460 мс --ease-drawer; закрытие — обратно в рамку карточки, 320 мс. Фон — прозрачностью.
     Reduced-motion — без полёта. Карточка вне экрана — закрытие без полёта. */
  function initVideoModal() {
    const dlg = document.querySelector("[data-video-modal]");
    const video = dlg.querySelector("video");
    const opener = document.querySelector("[data-video-open]");
    const poster = opener.querySelector("img");
    const tok = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
    const still = () => ADM.reduce.matches || !Element.prototype.animate;
    let busy = false;

    function cardPose() {
      const o = poster.getBoundingClientRect();
      if (o.bottom < 0 || o.top > innerHeight || o.width < 2) return null;
      const d = dlg.getBoundingClientRect();
      const v = video.getBoundingClientRect();
      const s = Math.max(o.width / v.width, o.height / v.height);
      const cx = v.left - d.left + v.width / 2, cy = v.top - d.top + v.height / 2; // центр видео в координатах диалога
      const tx = o.left + o.width / 2 - (d.left + cx * s);
      const ty = o.top + o.height / 2 - (d.top + cy * s);
      const hw = o.width / s / 2, hh = o.height / s / 2;
      const clip = `inset(${(cy - hh).toFixed(1)}px ${(d.width - cx - hw).toFixed(1)}px ${(d.height - cy - hh).toFixed(1)}px ${(cx - hw).toFixed(1)}px round ${(8 / s).toFixed(2)}px)`;
      // translate считается от исходной позиции диалога (transform-origin: 0 0)
      return { transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`, clipPath: clip };
    }
    const openPose = { transform: "none", clipPath: "inset(-64px -64px -64px -64px round 0px)" };

    const open = (autoplay = true) => {
      if (dlg.open || busy) return;
      if (!video.getAttribute("src")) video.src = wide.matches ? video.dataset.src : video.dataset.srcMobile;
      video.muted = true; // в ролике нет звуковой дорожки-заглушки; автоплей со звуком запрещён
      dlg.showModal();
      if (!still()) {
        const from = cardPose();
        if (from) {
          busy = true;
          const an = dlg.animate([from, openPose], { duration: 460, easing: tok("--ease-drawer", "ease-out") });
          dlg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: "ease-out", pseudoElement: "::backdrop" });
          an.finished.finally(() => { busy = false; });
        }
      }
      if (autoplay) video.play().catch(() => {});
    };
    const close = () => {
      if (!dlg.open || busy) return;
      const to = still() ? null : cardPose();
      if (!to) { dlg.close(); return; }
      busy = true;
      video.pause();
      const an = dlg.animate([openPose, to], { duration: 320, easing: tok("--ease-in-out", "ease-in-out"), fill: "forwards" });
      dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-out", fill: "forwards", pseudoElement: "::backdrop" });
      an.finished.then(() => {
        dlg.close();
        dlg.getAnimations({ subtree: true }).forEach((x) => x.cancel());
        busy = false;
      }, () => { busy = false; });
    };
    opener.addEventListener("click", () => open());
    dlg.querySelector("[data-video-close]").addEventListener("click", close);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("close", () => { video.pause(); opener.focus({ preventScroll: true }); });
    if (ADM.states.has("video-open")) open(false);
  }

  function init() {
    initHeroVideo();
    initCounters();
    initVideoModal();
    ADM.initSubnav(document.querySelector(".subnav"));
    ADM.initStickyBar(document.querySelector("[data-sticky-cta]"));
    ADM.initChat(document.querySelector("[data-chat]"));
    ADM.initLead(document.querySelector("[data-lead]"));
    ADM.initCalc(document.querySelector("[data-calc]"), { limit: 4 });
    document.querySelector("[data-hero-search]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      document.getElementById("programs").scrollIntoView({ behavior: ADM.reduce.matches ? "auto" : "smooth" });
    });
    document.querySelectorAll('.subnav a[href="#faq"]').forEach((a) => a.addEventListener("click", () => document.getElementById("docs")?.setAttribute("open", "")));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
