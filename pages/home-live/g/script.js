/* home-live/g — «Стол первокурсника».
   Десктоп + мышь: предметы кладут на стол, их можно взять и бросить (Draggable + Inertia), клик — предмет подъезжает и страница едет к разделу.
   Мобильный: подписи ленты предметов дорисовываются при появлении карточки.
   Тетрадь «Кому что нужно» перелистывается по прокрутке (десктоп, без закрепления).
   Без GSAP и при reduced-motion — выверенный статичный кадр из CSS. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var states = (window.TVSU && window.TVSU.states) || new Set();

  initEnvelope();
  initVideo();

  var gsap = window.gsap;
  if (!gsap) { doc.classList.remove("g-intro", "g-deck"); return; }
  var plugins = [window.ScrollTrigger, window.Draggable, window.InertiaPlugin, window.DrawSVGPlugin, window.ScrollToPlugin].filter(Boolean);
  gsap.registerPlugin.apply(gsap, plugins);

  var board = $("[data-board]");
  var mm = gsap.matchMedia();

  mm.add({
    desk: "(min-width: 1024px)",
    fine: "(hover: hover) and (pointer: fine)",
    motion: "(prefers-reduced-motion: no-preference)"
  }, function (ctx) {
    var c = ctx.conditions;
    var cleanups = [];
    if (!c.motion) { doc.classList.remove("g-intro", "g-deck"); return; }

    if (c.desk) {
      intro();
      if (c.fine && window.Draggable) cleanups.push(drag());
      if (window.ScrollTrigger) cleanups.push(flip());
    } else {
      cleanups.push(deckDraw());
      cleanups.push(ticksOnce());
    }
    return function () { cleanups.forEach(function (fn) { if (fn) fn(); }); };
  });

  if (window.ScrollTrigger) {
    var refresh = function () { window.ScrollTrigger.refresh(); };
    if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(refresh);
    window.addEventListener("load", refresh, { once: true });
  }

  /* ───────── Раскладка предметов ───────── */
  function intro() {
    // страховка из <head> уже сняла класс: GSAP опоздал — показываем стол как есть
    if (!doc.classList.contains("g-intro")) return;
    var order = ["ring", "ruler", "zk", "pol-you", "sched", "ticket", "pol", "env", "phone", "key", "mug", "pen", "clip"];
    var objs = [];
    order.forEach(function (k) { $$(".thing--" + k + " > .obj", board).forEach(function (o) { if (objs.indexOf(o) < 0) objs.push(o); }); });
    gsap.set(objs, { opacity: 0 });
    doc.classList.remove("g-intro");

    var tl = gsap.timeline({ delay: 0.12 });
    objs.forEach(function (o, i) {
      var r = rot(o);
      var at = i * 0.058;
      if (o.classList.contains("obj--static")) { tl.to(o, { opacity: 1, duration: 0.5, ease: "power1.out" }, at); return; }
      tl.fromTo(o,
        { y: -44, x: gsap.utils.random(-12, 12), scale: 1.1, rotation: r + gsap.utils.random(-9, 9), "--lift": 1 },
        { y: 0, x: 0, scale: 1, rotation: r, duration: 0.56, ease: "power3.out" }, at)
        .to(o, { opacity: 1, duration: 0.16, ease: "none" }, at)
        .to(o, { "--lift": 0, duration: 0.46, ease: "power2.in" }, at + 0.08);
    });

    // пометки ручкой — пока предметы ещё ложатся
    var notes = 0.5;
    tl.fromTo($$(".notebook .hl__ink"), { scaleX: 0 }, { scaleX: 1, duration: 0.42, ease: "power2.out", stagger: 0.5 }, notes);
    wipe(tl, $(".nb__date"), notes - 0.2);
    wipe(tl, $(".nb__why"), notes + 0.1);
    if (window.DrawSVGPlugin) {
      tl.fromTo(".facts__circle path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power1.inOut" }, notes + 0.35)
        .fromTo(".nb__you-arrow path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.inOut" }, notes + 0.7)
        .fromTo(".thing--sched .ink-path--red", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.55, ease: "power1.inOut" }, notes + 0.55);
    }
    wipe(tl, $(".nb__you .hand"), notes + 1.0);
  }

  function wipe(tl, el, at) {
    if (!el) return;
    tl.fromTo(el, { clipPath: "inset(-25% 100% -25% -6%)" },
      { clipPath: "inset(-25% -6% -25% -6%)", duration: 0.45, ease: "power2.out", clearProps: "clipPath" }, at);
  }

  function rot(o) { return parseFloat(getComputedStyle(o.parentElement).getPropertyValue("--r")) || 0; }

  /* ───────── Взять и бросить ───────── */
  function drag() {
    var objs = $$(".thing > .obj:not(.obj--static)", board);
    var reset = $("[data-desk-reset]");
    var z = 20;
    var moved = false;
    var justDragged = null;
    var draggables = [];
    var listeners = [];
    doc.classList.add("g-drag");

    function on(el, type, fn, opt) { el.addEventListener(type, fn, opt); listeners.push([el, type, fn, opt]); }

    objs.forEach(function (o) {
      var thing = o.parentElement;
      var base = rot(o);
      var lastX = 0, vel = 0;
      var rotTo = gsap.quickTo(o, "rotation", { duration: 0.35, ease: "power3.out" });
      o.dataset.r0 = base;
      gsap.set(o, { rotation: base });

      var d = window.Draggable.create(o, {
        type: "x,y",
        inertia: !!window.InertiaPlugin,
        dragClickables: true,
        edgeResistance: 0.78,
        minDuration: 0.25,
        maxDuration: 1.1,
        zIndexBoost: false,
        onPress: function () {
          thing.style.zIndex = ++z;
          thing.classList.add("is-lifted");
          var b = board.getBoundingClientRect();
          var r = o.getBoundingClientRect();
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          this.applyBounds({
            minX: this.x - (cx - b.left), maxX: this.x + (b.right - cx),
            minY: this.y - (cy - b.top), maxY: this.y + (b.bottom - cy)
          });
          lastX = this.x; vel = 0;
          gsap.to(o, { scale: 1.06, "--lift": 1, duration: 0.22, ease: "power2.out", overwrite: "auto" });
        },
        onDragStart: function () {
          o.classList.add("is-dragging");
          if (!moved) { moved = true; reset.hidden = false; }
        },
        onDrag: function () {
          vel = vel * 0.75 + (this.x - lastX) * 0.25;
          lastX = this.x;
          rotTo(base + gsap.utils.clamp(-14, 14, vel * 1.6));
        },
        onRelease: function () {
          if (this.isDragging || o.classList.contains("is-dragging")) {
            base = base + gsap.utils.clamp(-10, 10, vel * 0.9);
          }
          rotTo(base);
          gsap.to(o, { scale: 1, "--lift": o.matches(":hover") ? 0.45 : 0, duration: 0.5, ease: "power2.out", overwrite: "auto" });
          if (!o.matches(":hover")) thing.classList.remove("is-lifted");
        },
        onDragEnd: function () {
          o.classList.remove("is-dragging");
          justDragged = o;
          setTimeout(function () { if (justDragged === o) justDragged = null; }, 60);
        }
      })[0];
      o._gDrag = d;
      o._gBase = function (v) { if (v !== undefined) base = v; return base; };
      draggables.push(d);

      on(o, "pointerenter", function () {
        if (o.classList.contains("is-dragging")) return;
        thing.classList.add("is-lifted");
        gsap.to(o, { scale: 1.03, "--lift": 0.45, duration: 0.25, ease: "power2.out", overwrite: "auto" });
      });
      on(o, "pointerleave", function () {
        if (o.classList.contains("is-dragging")) return;
        thing.classList.remove("is-lifted");
        gsap.to(o, { scale: 1, "--lift": 0, duration: 0.3, ease: "power2.out", overwrite: "auto" });
      });

      if (o.tagName === "A") on(o, "click", function (e) {
        e.preventDefault();
        if (justDragged === o) return;
        go(o);
      });
      if (o.tagName !== "A") on(o, "click", function (e) { e.preventDefault(); });
      on(o, "dragstart", function (e) { e.preventDefault(); });
    });

    function go(o) {
      var target = $(o.getAttribute("href"));
      if (!target) return;
      var b = board.getBoundingClientRect();
      var r = o.getBoundingClientRect();
      var from = { x: gsap.getProperty(o, "x"), y: gsap.getProperty(o, "y"), rotation: gsap.getProperty(o, "rotation") };
      o.parentElement.style.zIndex = ++z;
      var dx = (b.left + b.width / 2 - (r.left + r.width / 2)) * 0.5;
      var dy = (b.top + b.height * 0.46 - (r.top + r.height / 2)) * 0.5;
      gsap.timeline()
        .to(o, { x: from.x + dx, y: from.y + dy, rotation: 0, scale: 1.12, "--lift": 1, duration: 0.4, ease: "power3.inOut" })
        .add(function () {
          if (window.ScrollToPlugin) {
            gsap.to(window, { scrollTo: { y: target, offsetY: 72, autoKill: true }, duration: 0.85, ease: "power3.inOut", onComplete: arrive });
          } else { target.scrollIntoView(); arrive(); }
        }, 0.2)
        .to(o, { x: from.x, y: from.y, rotation: from.rotation, scale: 1, "--lift": 0, duration: 0.5, ease: "power2.out" }, 0.9);
      function arrive() {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        if (history.pushState) history.pushState(null, "", o.getAttribute("href"));
      }
    }

    function home(instant) {
      moved = false;
      reset.hidden = true;
      objs.forEach(function (o) {
        var r0 = parseFloat(o.dataset.r0) || 0;
        o._gBase(r0);
        o.parentElement.classList.remove("is-lifted");
      });
      if (instant) { gsap.set(objs, { x: 0, y: 0, scale: 1, "--lift": 0, rotation: function (i, o) { return parseFloat(o.dataset.r0) || 0; } }); return; }
      gsap.to(objs, {
        x: 0, y: 0, scale: 1, "--lift": 0,
        rotation: function (i, o) { return parseFloat(o.dataset.r0) || 0; },
        duration: 0.6, ease: "power3.inOut", stagger: 0.025, overwrite: "auto",
        onComplete: function () { $$(".thing", board).forEach(function (t) { t.style.zIndex = ""; }); }
      });
    }
    on(reset, "click", function () { home(false); });

    var lastW = board.offsetWidth;
    var ro = new ResizeObserver(function () {
      var w = board.offsetWidth;
      if (Math.abs(w - lastW) > 1) { lastW = w; home(true); }
    });
    ro.observe(board);

    return function () {
      ro.disconnect();
      draggables.forEach(function (d) { d.kill(); });
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      objs.forEach(function (o) { o.classList.remove("is-dragging"); o.parentElement.classList.remove("is-lifted"); o.parentElement.style.zIndex = ""; });
      gsap.set(objs, { clearProps: "transform,opacity,--lift" });
      reset.hidden = true;
      doc.classList.remove("g-drag");
    };
  }

  /* ───────── Тетрадь перелистывается ───────── */
  function flip() {
    var book = $("[data-book]");
    var sheet = $("[data-sheet]", book);
    if (!book || !sheet) return null;
    var ticks = $$(".tick__v", book);
    gsap.set(sheet, { rotationY: 0 });
    var tl = gsap.timeline({
      scrollTrigger: { trigger: book, start: "top 80%", end: "top 18%", scrub: 0.6 }
    });
    tl.to(sheet, { rotationY: -180, duration: 1, ease: "power1.inOut" }, 0)
      .fromTo($(".sheet__face--front .sheet__shade", book), { opacity: 0 }, { opacity: 0.7, duration: 0.5, ease: "power1.in" }, 0)
      .fromTo($(".sheet__face--back .sheet__shade", book), { opacity: 0.7 }, { opacity: 0, duration: 0.5, ease: "power1.out" }, 0.5);
    if (window.DrawSVGPlugin && ticks.length) {
      tl.fromTo(ticks, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.18, ease: "power1.out", stagger: 0.05 }, 0.72);
    }
    var st = tl.scrollTrigger;
    var onFocus = function () { if (st.progress < 1) window.scrollTo(0, Math.ceil(st.end) + 2); };
    book.addEventListener("focusin", onFocus);
    return function () { book.removeEventListener("focusin", onFocus); };
  }

  /* ───────── Мобильный: подписи и галочки ───────── */
  function deckDraw() {
    if (!doc.classList.contains("g-deck")) return null;
    var things = $$(".things .thing:not(.thing--decor)");
    things.forEach(function (t) {
      gsap.set($$(".cap__txt", t), { clipPath: "inset(-20% 100% -20% -6%)" });
      gsap.set($$(".cap__arrow path", t), { strokeDasharray: 1, strokeDashoffset: 1 });
    });
    doc.classList.remove("g-deck");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        gsap.to($$(".cap__arrow path", e.target), { strokeDashoffset: 0, duration: 0.42, ease: "power2.inOut", delay: 0.1 });
        gsap.to($$(".cap__txt", e.target), { clipPath: "inset(-20% -6% -20% -6%)", duration: 0.5, ease: "power2.out", delay: 0.36 });
      });
    }, { threshold: 0.6 });
    things.forEach(function (t) { io.observe(t); });
    return function () { io.disconnect(); };
  }

  function ticksOnce() {
    var book = $("[data-book]");
    if (!book || !window.DrawSVGPlugin) return null;
    var groups = $$(".toc", book);
    groups.forEach(function (g) { gsap.set($$(".tick__v", g), { drawSVG: "0%" }); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        gsap.to($$(".tick__v", e.target), { drawSVG: "100%", duration: 0.3, ease: "power1.out", stagger: 0.12, delay: 0.15 });
      });
    }, { threshold: 0.5 });
    groups.forEach(function (g) { io.observe(g); });
    return function () { io.disconnect(); };
  }

  /* ───────── Видео в телефоне: создаётся только по нажатию ───────── */
  function initVideo() {
    $$("[data-video-play]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var screen = btn.closest(".phone__screen");
        var img = $("img", screen);
        var v = document.createElement("video");
        v.src = btn.dataset.src;
        v.controls = true;
        v.playsInline = true;
        v.preload = "auto";
        if (img) { v.poster = img.currentSrc || img.src; v.setAttribute("aria-label", img.alt); }
        v.setAttribute("width", "854");
        v.setAttribute("height", "480");
        screen.replaceChildren(v);
        v.focus({ preventScroll: true });
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
    });
  }

  /* ───────── Конверт: письмо складывается, клапан закрывается, штамп ───────── */
  function initEnvelope() {
    var env = $("[data-env]");
    if (!env) return;
    var form = $("[data-env-form]", env);
    var letter = $("[data-env-letter]", env);
    var done = $("[data-env-done]", env);
    var again = $("[data-env-again]", env);
    var status = $("[data-env-status]");
    done.setAttribute("tabindex", "-1");

    function seal(instant) {
      env.classList.toggle("is-static", !!instant);
      env.classList.add("is-sent");
      letter.inert = true;
      done.hidden = false;
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      seal(false);
      status.textContent = "Письмо отправлено. Это демо: на самом деле оно никуда не ушло.";
      done.focus({ preventScroll: true });
    });
    again.addEventListener("click", function () {
      env.classList.remove("is-sent", "is-static");
      letter.inert = false;
      done.hidden = true;
      status.textContent = "";
      form.reset();
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(function () { $("textarea", form).focus({ preventScroll: true }); }, reduce ? 0 : 1000);
    });
    if (states.has("sent")) seal(true);
  }
})();
