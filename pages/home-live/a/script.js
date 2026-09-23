/* home-live/a «Стикерпак».
   1. Куча стикеров в hero — Matter.js: падение, хватание, бросок, «Встряхнуть», встряска телефона.
   2. Коллекционные карточки направлений — переворот и счётчик «Собрано N из 6».
   3. Марки «История в лицах» прилипают пружиной при появлении (GSAP ScrollTrigger).
   4. Форма вопроса — проверка полей и стикер, который перелетает из формы на доску.
   Под prefers-reduced-motion: статичная композиция из CSS, карточки меняют стороны без вращения, всё видно сразу. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hasGsap = () => typeof window.gsap !== "undefined";

  /* ═════════════ 1. Куча стикеров ═════════════ */
  function initPile() {
    const hero = document.querySelector("[data-hero]");
    const pile = hero?.querySelector("[data-pile]");
    if (!pile) return;
    const items = [...pile.querySelectorAll(".stk")];
    const shakeBtn = hero.querySelector("[data-shake]");

    if (reduce.matches || typeof window.Matter === "undefined") {
      pile.classList.add("is-static");
      return;
    }

    const { Engine, Bodies, Body, Composite, Constraint, Sleeping, Vector } = window.Matter;
    const STEP = 1000 / 60;
    const WALL = 0x1, STK = 0x2, COPY = 0x4;

    const engine = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 6 });
    engine.gravity.y = 2;
    const world = engine.world;

    let W = 0, H = 0, floor = 36, copyRight = 0, copyBottom = 0;
    let titleRight = 0, titleBottom = 0, lowerRight = 0;
    let side = false; // true: текст слева, куча справа (десктоп); false: куча в лотке под текстом
    let statics = [];
    const list = []; // { el, body, w, h, shape, copyOn }
    let running = false, raf = 0, last = 0, acc = 0, visible = true, z = 10;
    let drag = null;

    const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

    function measure() {
      const r = hero.getBoundingClientRect();
      W = r.width; H = r.height;
      floor = num(getComputedStyle(hero).getPropertyValue("--floor"), 36);
      side = num(getComputedStyle(hero).getPropertyValue("--tray")) < 1;
      const box = (sel) => {
        let right = 0, bottom = 0;
        hero.querySelectorAll(sel).forEach((el) => {
          const b = el.getBoundingClientRect();
          if (!b.width) return;
          right = Math.max(right, b.right - r.left);
          bottom = Math.max(bottom, b.bottom - r.top);
        });
        return { right, bottom };
      };
      const t = box(".tape");
      const l = box(".hero__lead, .hero__actions > *, .hero__play > *");
      titleRight = Math.min(W, t.right + 18);
      titleBottom = t.bottom + 6;
      lowerRight = Math.min(W, l.right + 18);
      copyRight = Math.max(titleRight, lowerRight);
      copyBottom = Math.max(t.bottom, l.bottom) + 14;
    }

    function buildStatics() {
      if (statics.length) Composite.remove(world, statics);
      const opt = (cat) => ({ isStatic: true, friction: 0.6, restitution: 0.1, collisionFilter: { category: cat, mask: STK } });
      const T = 200, tall = H + 6000;
      statics = [
        Bodies.rectangle(W / 2, H - floor + T / 2, W + 2 * T, T, opt(WALL)),         // пол: верх на линии «пола»
        Bodies.rectangle(-T / 2, H - tall / 2, T, tall, opt(WALL)),                   // левая стенка
        Bodies.rectangle(W + T / 2, H - tall / 2, T, tall, opt(WALL)),                // правая стенка
        Bodies.rectangle(W / 2, -900 - T / 2, W + 2 * T, T, opt(WALL)),               // потолок далеко над кадром
      ];
      if (side) {
        // ступенька: колонка заголовка до потолка + блок лида и кнопок; под «козырьком» заголовка стикерам можно спрятаться
        statics.push(Bodies.rectangle(titleRight / 2, (titleBottom - 3000) / 2, titleRight, titleBottom + 3000, opt(COPY)));
        if (copyBottom > titleBottom) statics.push(Bodies.rectangle(lowerRight / 2, (titleBottom + copyBottom) / 2, lowerRight, copyBottom - titleBottom, opt(COPY)));
      } else {
        statics.push(Bodies.rectangle(W / 2, (copyBottom - 3000) / 2, W + 400, copyBottom + 3000, opt(COPY))); // потолок лотка
      }
      Composite.add(world, statics);
    }

    function makeBody(el, x, y, angle) {
      const w = el.offsetWidth, h = el.offsetHeight;
      const circle = el.dataset.shape === "circle";
      const photo = el.classList.contains("stk--photo");
      const common = {
        angle,
        friction: 0.4,
        frictionStatic: 0.6,
        frictionAir: 0.018,
        restitution: el.hasAttribute("data-bouncy") ? 0.6 : 0.25,
        density: photo ? 0.0021 : 0.0016,
        slop: 0.04,
        collisionFilter: { category: STK, mask: side ? WALL | STK | COPY : WALL | STK },
      };
      // тело чуть меньше картинки: бумажные края заходят друг на друга, как в настоящей куче наклеек
      const body = circle
        ? Bodies.circle(x, y, (Math.min(w, h) / 2) * 0.9, common)
        : Bodies.rectangle(x, y, w * 0.84, h * 0.84, { ...common, chamfer: { radius: Math.min(14, Math.min(w, h) * 0.16) } });
      return { el, body, w, h, circle, copyOn: side };
    }

    function render() {
      for (const it of list) {
        const { x, y } = it.body.position;
        it.el.style.transform = `translate3d(${(x - it.w / 2).toFixed(1)}px, ${(y - it.h / 2).toFixed(1)}px, 0) rotate(${it.body.angle.toFixed(4)}rad)`;
      }
    }

    function housekeeping() {
      for (const it of list) {
        const b = it.body;
        // когда стикер целиком ниже текста или правее его — текст становится для него твёрдым
        if (!it.copyOn && (b.bounds.min.y > copyBottom || b.bounds.min.x > copyRight)) {
          it.copyOn = true;
          b.collisionFilter.mask = WALL | STK | COPY;
        }
        const p = b.position;
        if (p.y > H + 400 || p.x < -300 || p.x > W + 300 || !Number.isFinite(p.x + p.y)) {
          Body.setPosition(b, { x: spawnX(W * 0.75, it.w), y: -it.h });
          Body.setVelocity(b, { x: 0, y: 4 });
          it.copyOn = side;
          b.collisionFilter.mask = side ? WALL | STK | COPY : WALL | STK;
        }
      }
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min(100, now - last);
      last = now;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 4) {
        if (drag) Body.setAngularVelocity(drag.it.body, drag.it.body.angularVelocity * 0.9); // держим за край — раскачка гаснет быстрее
        Engine.update(engine, STEP);
        acc -= STEP;
        n++;
      }
      if (n === 4) acc = 0;
      housekeeping();
      render();
      const asleep = !drag && list.every((it) => it.body.isSleeping);
      if (asleep) { running = false; return; }
      raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (!visible) return;
      if (!running) { running = true; last = performance.now(); acc = 0; }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function wakeAll() { list.forEach((it) => Sleeping.set(it.body, false)); kick(); }

    function spawnX(x, w) {
      const left = side ? titleRight + w * 0.45 : w * 0.45;
      return Math.max(left, Math.min(W - w * 0.45, x));
    }

    function populate(drop) {
      const r = hero.getBoundingClientRect();
      const seeds = items.filter((el) => el.offsetWidth > 0).map((el) => {
        const b = el.getBoundingClientRect();
        const angle = (num(getComputedStyle(el).getPropertyValue("--r")) * Math.PI) / 180;
        return { el, cx: b.left + b.width / 2 - r.left, cy: b.top + b.height / 2 - r.top, angle };
      });
      pile.classList.add("is-physics");
      seeds.forEach((s, i) => {
        const it = makeBody(s.el, s.cx, s.cy, s.angle);
        if (drop) {
          // падаем в свою колонку из-за верхнего края; нижний слой первым
          Body.setPosition(it.body, { x: spawnX(s.cx + (Math.random() - 0.5) * 20, it.w), y: -it.h / 2 - 30 - i * 80 });
          Body.setAngle(it.body, s.angle + (Math.random() - 0.5) * 0.4);
          Body.setVelocity(it.body, { x: 0, y: 9 });
          Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.06);
        }
        list.push(it);
        Composite.add(world, it.body);
        s.el.style.zIndex = String(i + 1);
      });
      z = seeds.length + 1;
      render();
    }

    /* ───── хватание и бросок ───── */
    function toLocal(e) {
      const r = hero.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onDown(e) {
      if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
      const el = e.target.closest(".stk");
      const it = el && list.find((x) => x.el === el);
      if (!it) return;
      e.preventDefault();
      const p = toLocal(e);
      const b = it.body;
      Sleeping.set(b, false);
      const c = Constraint.create({
        pointA: { x: p.x, y: p.y },
        bodyB: b,
        pointB: { x: p.x - b.position.x, y: p.y - b.position.y },
        stiffness: 0.18,
        damping: 0.08,
        length: 0,
        render: { visible: false },
      });
      Composite.add(world, c);
      b.frictionAir = 0.06;
      el.classList.add("is-held");
      el.style.zIndex = String(++z);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* capture не обязателен */ }
      drag = { it, c, id: e.pointerId, hist: [{ x: p.x, y: p.y, t: e.timeStamp }] };
      kick();
    }

    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toLocal(e);
      p.x = Math.max(8, Math.min(W - 8, p.x));
      p.y = Math.max(-200, Math.min(H - floor - 4, p.y));
      drag.c.pointA.x = p.x;
      drag.c.pointA.y = p.y;
      drag.hist.push({ x: p.x, y: p.y, t: e.timeStamp });
      if (drag.hist.length > 12) drag.hist.shift();
      Sleeping.set(drag.it.body, false);
      kick();
    }

    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const { it, c, hist } = drag;
      Composite.remove(world, c);
      const b = it.body;
      b.frictionAir = 0.018;
      it.el.classList.remove("is-held");
      const lastP = hist[hist.length - 1];
      const idle = e.timeStamp - lastP.t > 60;
      const first = hist.find((h) => lastP.t - h.t <= 80) || hist[0];
      const span = lastP.t - first.t;
      const bv = Body.getVelocity(b);
      let v;
      if (idle || span < 8 || e.type === "pointercancel") {
        v = Vector.mult(bv, idle ? 0.35 : 1);
      } else {
        const pv = { x: ((lastP.x - first.x) / span) * STEP, y: ((lastP.y - first.y) / span) * STEP };
        v = { x: pv.x * 0.8 + bv.x * 0.2, y: pv.y * 0.8 + bv.y * 0.2 };
      }
      const mag = Vector.magnitude(v);
      if (mag > 38) v = Vector.mult(v, 38 / mag);
      Body.setVelocity(b, v);
      drag = null;
      kick();
    }

    /* ───── встряска ───── */
    function shake() {
      list.forEach((it) => {
        Sleeping.set(it.body, false);
        Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 18, y: -(10 + Math.random() * 14) });
        Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.3);
      });
      kick();
    }

    let motionAsked = false, lastShake = 0, prevAcc = null;
    function onDeviceMotion(e) {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      if (prevAcc) {
        const d = Math.abs(a.x - prevAcc.x) + Math.abs(a.y - prevAcc.y) + Math.abs(a.z - prevAcc.z);
        const now = performance.now();
        if (d > 28 && now - lastShake > 700 && visible) { lastShake = now; shake(); }
      }
      prevAcc = { x: a.x, y: a.y, z: a.z };
    }
    function askMotion() {
      if (motionAsked || !window.matchMedia("(pointer: coarse)").matches || typeof DeviceMotionEvent === "undefined") return;
      motionAsked = true;
      const listen = () => window.addEventListener("devicemotion", onDeviceMotion, { passive: true });
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        DeviceMotionEvent.requestPermission().then((s) => { if (s === "granted") listen(); }).catch(() => {});
      } else listen();
    }

    /* ───── размеры ───── */
    let rzT = 0, lastW = 0;
    function onResize() {
      clearTimeout(rzT);
      rzT = setTimeout(() => {
        const oldW = W, oldSide = side;
        measure();
        buildStatics();
        const widthChanged = Math.abs(W - lastW) > 1;
        lastW = W;
        const k = oldW ? W / oldW : 1;
        // стикеры, которые появились/исчезли на брейкпоинте или сменили размер, пересоздаём на том же месте
        items.forEach((el, i) => {
          const shown = el.offsetWidth > 0;
          const idx = list.findIndex((x) => x.el === el);
          const it = idx > -1 ? list[idx] : null;
          if (it && (!shown || it.w !== el.offsetWidth || it.h !== el.offsetHeight || widthChanged)) {
            const { x, y } = it.body.position;
            const angle = it.body.angle;
            Composite.remove(world, it.body);
            list.splice(idx, 1);
            if (shown) {
              const n = makeBody(el, Math.max(20, Math.min(W - 20, x * k)), Math.min(y, H - floor - el.offsetHeight / 2), angle);
              list.splice(idx, 0, n);
              Composite.add(world, n.body);
            } else {
              el.style.transform = "";
            }
          } else if (!it && shown) {
            const n = makeBody(el, W * (0.55 + Math.random() * 0.4), -el.offsetHeight - i * 40, 0);
            list.push(n);
            Composite.add(world, n.body);
            el.style.zIndex = String(++z);
          }
        });
        list.forEach((it, i) => {
          it.copyOn = side;
          it.body.collisionFilter.mask = side ? WALL | STK | COPY : WALL | STK;
          const p = it.body.position;
          // сменилась раскладка или стикер оказался внутри текста — роняем его заново сверху
          if (side !== oldSide || (side && p.x < copyRight && p.y < copyBottom)) {
            Body.setPosition(it.body, { x: spawnX(p.x, it.w), y: -it.h / 2 - 30 - i * 60 });
            Body.setVelocity(it.body, { x: 0, y: 6 });
          }
        });
        wakeAll();
        render();
      }, 150);
    }

    function start() {
      measure();
      lastW = W;
      buildStatics();
      populate(true);
      kick();

      pile.addEventListener("pointerdown", onDown);
      pile.addEventListener("pointermove", onMove);
      pile.addEventListener("pointerup", onUp);
      pile.addEventListener("pointercancel", onUp);
      pile.addEventListener("lostpointercapture", onUp);
      pile.addEventListener("dragstart", (e) => e.preventDefault());

      shakeBtn?.addEventListener("click", () => {
        askMotion();
        shake();
        const icon = shakeBtn.querySelector("svg");
        icon?.animate?.([{ transform: "rotate(0deg)" }, { transform: "rotate(-360deg)" }], { duration: 520, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      });

      new ResizeObserver(onResize).observe(hero);
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) kick();
        else { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
      }).observe(hero);

      reduce.addEventListener?.("change", () => {
        if (!reduce.matches) return;
        running = false;
        if (raf) cancelAnimationFrame(raf);
        pile.classList.remove("is-physics");
        pile.classList.add("is-static");
        items.forEach((el) => { el.style.transform = ""; el.style.zIndex = ""; });
      });
    }

    const fontsReady = document.fonts?.ready || Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 800))]).then(() => requestAnimationFrame(start));
  }

  /* ═════════════ 2. Карточки направлений ═════════════ */
  function initCards() {
    const cards = [...document.querySelectorAll("[data-card]")];
    if (!cards.length) return;
    const counter = document.querySelector("[data-collect-n]");
    const reward = document.querySelector("[data-reward]");
    const got = new Set();

    function collect(id) {
      if (got.has(id)) return;
      got.add(id);
      if (counter) counter.textContent = String(got.size);
      document.querySelector(`[data-slot="${id}"]`)?.classList.add("is-on");
      if (got.size === cards.length && reward) reward.hidden = false;
    }

    function flip(card, on) {
      const btn = card.querySelector(".card__flip");
      const front = card.querySelector(".card__front");
      const back = card.querySelector(".card__back");
      if (card.classList.contains("is-flipped") === on) return;
      card.classList.toggle("is-flipped", on);
      btn.setAttribute("aria-expanded", String(on));
      if (!reduce.matches) {
        card.classList.remove("is-lift");
        void card.offsetWidth;
        card.classList.add("is-lift");
      }
      if (on) {
        back.inert = false;
        back.focus({ preventScroll: true });
        front.inert = true;
        collect(card.dataset.card);
      } else {
        front.inert = false;
        btn.focus({ preventScroll: true });
        back.inert = true;
      }
    }

    cards.forEach((card) => {
      card.querySelector(".card__flip").addEventListener("click", () => flip(card, true));
      card.querySelector(".card__unflip").addEventListener("click", () => flip(card, false));
      card.addEventListener("keydown", (e) => { if (e.key === "Escape" && card.classList.contains("is-flipped")) flip(card, false); });
      card.addEventListener("animationend", (e) => { if (e.animationName === "card-lift") card.classList.remove("is-lift"); });
    });
  }

  /* ═════════════ 3. Марки прилипают ═════════════ */
  function initStamps() {
    const track = document.querySelector("[data-stamps]");
    if (!track || reduce.matches || !hasGsap() || typeof window.ScrollTrigger === "undefined") return;
    const stamps = [...track.querySelectorAll(".stamp")];
    gsap.set(stamps, { opacity: 0 });
    ScrollTrigger.batch(stamps, {
      start: "top 88%",
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, { opacity: 1, duration: 0.25, stagger: 0.09, ease: "power1.out" });
        gsap.fromTo(batch,
          { scale: 1.4, y: -30, rotation: (i) => (i % 2 ? 9 : -9) },
          { scale: 1, y: 0, rotation: 0, duration: 1, ease: "elastic.out(1, 0.5)", stagger: 0.09, clearProps: "transform" });
      },
    });
  }

  /* ═════════════ 4. Вопрос на доску ═════════════ */
  function initAsk() {
    const form = document.querySelector("[data-ask]");
    const notes = document.querySelector("[data-board-notes]");
    if (!form || !notes) return;
    const q = form.querySelector("#ask-q");
    const c = form.querySelector("#ask-c");
    const ok = form.querySelector("[data-ask-ok]");
    const reTg = /^@?[a-zA-Z0-9_]{5,32}$/;
    const reMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const rules = [
      [q, () => q.value.trim().length >= 3],
      [c, () => { const v = c.value.trim(); return reTg.test(v) || reMail.test(v); }],
    ];
    function check(field, test) {
      const good = test();
      field.setAttribute("aria-invalid", String(!good));
      document.getElementById(field.id + "-err").hidden = good;
      return good;
    }
    rules.forEach(([field, test]) => {
      field.addEventListener("input", () => { if (field.getAttribute("aria-invalid") === "true") check(field, test); });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ok.textContent = "";
      const bad = rules.filter(([f, t]) => !check(f, t));
      if (bad.length) { bad[0][0].focus(); return; }

      const li = document.createElement("li");
      li.className = "note note--sun";
      const tag = document.createElement("span");
      tag.className = "note__tag";
      tag.textContent = "твой вопрос";
      const p = document.createElement("p");
      p.textContent = q.value.trim();
      li.append(tag, p);
      notes.prepend(li);
      while (notes.children.length > 4) notes.lastElementChild.remove();

      if (!reduce.matches && hasGsap()) {
        const from = form.getBoundingClientRect();
        const to = li.getBoundingClientRect();
        gsap.fromTo(li,
          { x: from.left + from.width / 2 - (to.left + to.width / 2), y: from.top + from.height / 3 - (to.top + to.height / 2), rotation: -14, scale: 1.25, opacity: 0 },
          { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.75, ease: "power3.out", clearProps: "transform,opacity" });
      }
      ok.textContent = "Вопрос на доске! Ответим в течение [N] рабочих дней.";
      form.reset();
      rules.forEach(([f]) => f.removeAttribute("aria-invalid"));
    });
  }

  function init() {
    if (hasGsap() && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    initPile();
    initCards();
    initStamps();
    initAsk();
    document.addEventListener("partials:ready", () => { if (window.ScrollTrigger) ScrollTrigger.refresh(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
