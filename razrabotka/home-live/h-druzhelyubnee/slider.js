/* Слайдер первого экрана: стрелки, точки, свайп, автопрокрутка с паузой (WCAG 2.2.2).
   Разметка: [data-slider] > [data-slide]×N; управление [data-prev] [data-next] [data-dot]×N [data-pause]; [data-live] — объявление для экранного диктора.
   Слайды стоят в одной ячейке сетки, высота = самый высокий слайд, страница не прыгает.
   ?slide=2 — открыть сразу второй слайд (для скриншотов). Reduced motion: без автопрокрутки и без сдвига. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var startAt = parseInt(new URLSearchParams(location.search).get("slide"), 10);

  document.querySelectorAll("[data-slider]").forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll("[data-slide]"));
    if (slides.length < 2) return;
    var dots = Array.prototype.slice.call(root.querySelectorAll("[data-dot]"));
    var prev = root.querySelector("[data-prev]");
    var next = root.querySelector("[data-next]");
    var pause = root.querySelector("[data-pause]");
    var live = root.querySelector("[data-live]");
    var delay = parseInt(root.getAttribute("data-delay"), 10) || 7000;
    var i = 0, timer = 0, playing = !reduce && !startAt, hold = false;

    function show(n, user) {
      var old = i;
      i = (n + slides.length) % slides.length;
      root.style.setProperty("--dir", n < old ? "-1" : "1");
      slides.forEach(function (s, k) {
        var on = k === i;
        s.classList.toggle("is-active", on);
        s.setAttribute("aria-hidden", String(!on));
        s.inert = !on;
      });
      dots.forEach(function (d, k) { d.setAttribute("aria-current", k === i ? "true" : "false"); });
      root.setAttribute("data-current", String(i + 1));
      if (user && live) live.textContent = "Слайд " + (i + 1) + " из " + slides.length;
      restart();
    }
    function restart() {
      clearTimeout(timer);
      if (playing && !hold && !document.hidden) timer = setTimeout(function () { show(i + 1); }, delay);
    }
    function setPlaying(p) {
      playing = p;
      if (pause) {
        pause.setAttribute("aria-pressed", String(!p));
        pause.classList.toggle("is-paused", !p);
        var l = pause.querySelector("[data-pause-label]");
        if (l) l.textContent = p ? "Остановить автопрокрутку слайдов" : "Включить автопрокрутку слайдов";
      }
      restart();
    }

    if (prev) prev.addEventListener("click", function () { show(i - 1, true); });
    if (next) next.addEventListener("click", function () { show(i + 1, true); });
    dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k, true); }); });
    if (pause) pause.addEventListener("click", function () { setPlaying(!playing); });

    /* пока курсор или фокус внутри — не листаем сами */
    root.addEventListener("mouseenter", function () { hold = true; restart(); });
    root.addEventListener("mouseleave", function () { hold = false; restart(); });
    root.addEventListener("focusin", function () { hold = true; restart(); });
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) { hold = false; restart(); } });
    document.addEventListener("visibilitychange", restart);

    /* стрелки клавиатуры, когда фокус на управлении */
    root.addEventListener("keydown", function (e) {
      if (!e.target.closest("[data-slider-nav]")) return;
      if (e.key === "ArrowLeft") { show(i - 1, true); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(i + 1, true); e.preventDefault(); }
    });

    /* свайп пальцем */
    var x0 = null, y0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? i + 1 : i - 1, true);
      x0 = null;
    }, { passive: true });

    setPlaying(playing);
    show(startAt >= 1 && startAt <= slides.length ? startAt - 1 : 0);
  });
})();
