/* home-nika/b — «Кино»: фоновый луп сцены (только от 768 и без reduced-motion), пауза, лид-форма, липкая панель, news-hover. */
(function () {
  "use strict";

  const VIDEO = "../../../assets/stub/video/vals-scena-obshiy.mp4";
  const POSTER = "../../../assets/stub/video/vals-scena-obshiy.jpg";

  /* ── Сцена: видео вставляется в DOM только там, где его стоит грузить ── */
  const media = document.querySelector("[data-cine-media]");
  const toggle = document.querySelector("[data-cine-toggle]");
  const wide = window.matchMedia("(min-width: 768px)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let video = null;
  let userPaused = false;

  const setToggle = (paused) => {
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.querySelector("[data-icon-pause]").hidden = paused;
    toggle.querySelector("[data-icon-play]").hidden = !paused;
    toggle.querySelector("[data-cine-label]").textContent = paused ? "Продолжить видео" : "Поставить видео на паузу";
  };

  const mount = () => {
    if (video) return;
    video = document.createElement("video");
    video.className = "cine__video";
    Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true, poster: POSTER, preload: "auto" });
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.addEventListener("playing", () => video.classList.add("is-on"), { once: true });
    video.src = VIDEO;
    media.appendChild(video);
    video.play().catch(() => {});
    toggle.hidden = false;
    setToggle(false);
  };

  const unmount = () => {
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    video = null;
    toggle.hidden = true;
  };

  const sync = () => {
    if (wide.matches && !reduce.matches) mount();
    else unmount();
  };

  if (media && toggle) {
    toggle.addEventListener("click", () => {
      if (!video) return;
      if (video.paused) { userPaused = false; video.play().catch(() => {}); setToggle(false); }
      else { userPaused = true; video.pause(); setToggle(true); }
    });
    wide.addEventListener?.("change", sync);
    reduce.addEventListener?.("change", sync);
    /* не крутить луп, когда сцена ушла с экрана */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (!video || userPaused) return;
        if (e.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }).observe(media);
    }
    sync();
  }

  /* ── Сцена уходит в глубину при прокрутке: без scroll-timeline — один rAF на страницу (с ним работает CSS) ── */
  if (media && document.documentElement.classList.contains("m-on") && !(window.CSS && CSS.supports("animation-timeline: scroll()"))) {
    const rings = document.querySelector(".cine__rings");
    const inner = document.querySelector(".cine__inner");
    let raf = 0;
    const frame = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      media.style.transform = p ? `scale(${(1 - 0.12 * p).toFixed(4)})` : "";
      media.style.opacity = p ? (1 - 0.7 * p).toFixed(3) : "";
      if (rings) { rings.style.rotate = (28 * p).toFixed(2) + "deg"; rings.style.scale = (1 + 0.12 * p).toFixed(4); }
      if (inner) inner.style.translate = `0 ${(-12 * p).toFixed(2)}vh`;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener("scroll", kick, { passive: true });
    kick();
  }

  /* ── Мягкий лид ── */
  const ask = document.querySelector("[data-ask]");
  if (ask) {
    const contact = ask.querySelector("#ask-contact");
    const err = ask.querySelector("#ask-contact-err");
    const done = ask.querySelector("[data-ask-done]");
    const valid = (v) => {
      const t = v.trim();
      return t.replace(/\D/g, "").length >= 11 || /^@[a-z0-9_]{5,32}$/i.test(t);
    };
    const setError = (on) => {
      err.hidden = !on;
      if (on) contact.setAttribute("aria-invalid", "true");
      else contact.removeAttribute("aria-invalid");
    };
    contact.addEventListener("input", () => { if (!err.hidden && valid(contact.value)) setError(false); });
    ask.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!valid(contact.value)) { setError(true); contact.focus(); return; }
      setError(false);
      done.hidden = false;
      done.textContent = "Вопрос отправлен. Приёмная комиссия ответит на " + contact.value.trim() + " в течение [N] рабочих дней.";
      ask.reset();
    });
  }

  /* ── Липкая панель «Поступить» на мобильном: после сцены и до контактов ── */
  const dock = document.querySelector("[data-dock]");
  const hero = document.querySelector(".cine");
  const contacts = document.getElementById("contacts");
  if (dock && hero && contacts && "IntersectionObserver" in window) {
    const btn = dock.querySelector("a");
    let heroGone = false, contactsReached = false;
    const update = () => {
      const on = heroGone && !contactsReached;
      dock.classList.toggle("is-visible", on);
      dock.setAttribute("aria-hidden", String(!on));
      btn.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(hero);
    new IntersectionObserver(([e]) => { contactsReached = e.isIntersecting || e.boundingClientRect.top < 0; update(); }).observe(contacts);
  }

  /* ── Состояния для скриншотов ── */
  const applyStates = () => {
    const states = (window.TVSU && window.TVSU.states) || new Set();
    if (states.has("news-hover")) {
      document.querySelector("[data-hover-demo]")?.classList.add("is-hover");
      document.querySelector("[data-hover-row]")?.classList.add("is-hover");
    }
  };
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(applyStates);
  else document.addEventListener("partials:ready", applyStates, { once: true });
})();
