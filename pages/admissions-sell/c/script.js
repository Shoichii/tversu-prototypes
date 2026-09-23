/* admissions-sell/c — «Тверь выгодно».
   Авторский момент: выбор города на линии дороги — поезд едет к станции, колонка ведомости перелистывается.
   Поверх линии — 3D-карта (road3d.js); здесь остаётся запасной слой (рельс, отрезок, поезд) и ведомость.
   Смета года: считает только строки, где сумма точно ноль; остальное — пустые ячейки [N ₽]. Лид в 1 поле. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  const CITY = { msk: "Москва", spb: "Петербург" };
  const SLOT = (t) => '<span class="slot">' + t + "</span>";

  function ready(fn) {
    if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(fn);
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* ───── Линия дороги ───── */
  function initLine() {
    const track = document.querySelector("[data-line]");
    if (!track) return;
    const train = track.querySelector("[data-line-train]");
    const awayName = document.querySelector("[data-away-name]");
    const aways = [...document.querySelectorAll("[data-away]")];
    const radios = [...track.querySelectorAll('input[name="city"]')];

    const place = () => {
      const city = radios.find((r) => r.checked).value;
      const shift = track.clientWidth / 3;             // центры станций — через треть ширины
      train.style.setProperty("--train-x", (city === "spb" ? -shift : shift) * 0.72 + "px");
    };

    const set = (city, animate) => {
      track.dataset.city = city;
      place();
      if (awayName.textContent === CITY[city]) return;
      const cells = [awayName].concat(aways);
      if (!animate || reduce.matches) { awayName.textContent = CITY[city]; return; }
      cells.forEach((el, n) => {
        const out = el.animate(
          [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }],
          { duration: 110, delay: n * 40, easing: EASE_OUT, fill: "forwards" }
        );
        out.finished.then(() => {
          if (el === awayName) el.textContent = CITY[city];
          el.animate(
            [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
            { duration: 220, easing: EASE_OUT, fill: "forwards" }
          ).finished.then((a) => { a.commitStyles?.(); a.cancel(); out.cancel(); }).catch(() => {});
        }).catch(() => {});
      });
    };

    radios.forEach((r) => r.addEventListener("change", () => set(r.value, true)));
    new ResizeObserver(place).observe(track);
    set(radios.find((r) => r.checked).value, false);
  }

  /* ───── Смета года ───── */
  function initYear() {
    const form = document.querySelector("[data-year]");
    const bill = document.querySelector("[data-bill]");
    if (!form || !bill) return;
    const rowsEl = bill.querySelector("[data-bill-rows]");
    const totalEl = bill.querySelector("[data-bill-total]");

    function rows(v) {
      const r = [];
      if (v.form === "budget") r.push({ name: "Обучение", sum: "0 ₽", zero: true, why: "Бюджетное место оплачивает государство" });
      else if (v.form === "target") r.push({ name: "Обучение", sum: "0 ₽", zero: true, why: "Целевое обучение идёт на бюджетное место, плюс меры поддержки от заказчика" });
      else r.push({ name: "Обучение, платно", sum: SLOT("[N ₽]"), why: "Зависит от программы. Можно оплатить маткапиталом, часть вернуть вычетом" });

      if (v.home === "dorm") r.push({ name: "Общежитие, 10 месяцев", sum: SLOT("[N ₽]"), why: "Место иногороднему студенту очной формы" });
      else if (v.home === "rent") r.push({ name: "Аренда комнаты, 12 месяцев", sum: SLOT("[N ₽]"), why: "Средняя цена в Твери, собрать по открытым данным" });
      else r.push({ name: "Жильё", sum: "0 ₽", zero: true, why: "Живёшь дома" });

      r.push({ name: "Еда и проезд по городу", sum: SLOT("[N ₽]"), why: "12 месяцев" });

      if (v.from === "tver") r.push({ name: "Дорога домой", sum: "0 ₽", zero: true, why: "Ты уже дома" });
      else if (v.from === "other") r.push({ name: "Дорога домой", sum: SLOT("[N ₽]"), why: "[N] поездок в год, зависит от города" });
      else r.push({ name: "Поезд домой, " + (v.from === "msk" ? "Москва" : "Петербург"), sum: SLOT("[N ₽]"), why: "[N] поездок в год, одна линия без пересадок" });

      if (v.form === "budget" || v.form === "target") r.push({ name: "Стипендия", sum: "+ " + SLOT("[N ₽]"), why: "Академическая стипендия при учёбе без троек" });
      return r;
    }

    function render(animate) {
      const v = Object.fromEntries(new FormData(form));
      const list = rows(v);
      rowsEl.replaceChildren();
      list.forEach((row, n) => {
        const li = document.createElement("li");
        li.className = "bill__row" + (row.zero ? " is-zero" : "");
        const name = document.createElement("span"); name.className = "bill__row-name"; name.textContent = row.name;
        const sum = document.createElement("span"); sum.className = "bill__row-sum num"; sum.innerHTML = row.sum;
        const why = document.createElement("span"); why.className = "bill__row-why"; why.textContent = row.why;
        li.append(name, sum, why);
        rowsEl.appendChild(li);
        if (animate && !reduce.matches) {
          li.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
            { duration: 240, delay: n * 40, easing: EASE_OUT, fill: "backwards" });
        }
      });
      const allZero = list.every((r) => r.zero || r.name === "Стипендия");
      totalEl.innerHTML = allZero ? "0 ₽" : SLOT("[N ₽]");
      if (animate && !reduce.matches) {
        /* итог — резкий штамп после лесенки строк */
        totalEl.style.display = "inline-block";
        totalEl.style.transformOrigin = "right center";
        totalEl.animate([{ opacity: 0.35, transform: "scale(1.12)" }, { opacity: 1, transform: "scale(1)" }],
          { duration: 170, delay: list.length * 40 + 120, easing: EASE_OUT, fill: "backwards" });
      }
    }

    form.addEventListener("change", () => render(true));
    form.addEventListener("submit", (e) => { e.preventDefault(); render(true); });

    const states = (window.TVSU && window.TVSU.states) || new Set();
    if (states.has("calc-result")) {
      form.elements.form.value = "paid";
      form.elements.home.value = "dorm";
      form.elements.from.value = "msk";
    }
    render(false);
  }

  /* ───── Лид: расчёт на почту или в Telegram ───── */
  function initSend() {
    const form = document.querySelector("[data-send]");
    if (!form) return;
    const input = form.elements.to;
    const label = form.querySelector("[data-send-label]");
    const err = document.getElementById("send-err");
    const done = form.querySelector("[data-send-done]");
    const via = () => form.elements.via.value;
    const sync = () => {
      const tg = via() === "tg";
      input.type = tg ? "text" : "email";
      input.autocomplete = tg ? "username" : "email";
      input.placeholder = tg ? "@username" : "name@mail.ru";
      label.textContent = tg ? "Ник в Telegram" : "Электронная почта";
      err.textContent = tg ? "Ник начинается с @, от 5 символов" : "Проверь адрес почты";
      input.removeAttribute("aria-invalid"); err.hidden = true;
    };
    form.querySelectorAll('input[name="via"]').forEach((r) => r.addEventListener("change", sync));
    input.addEventListener("input", () => { input.removeAttribute("aria-invalid"); err.hidden = true; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = via() === "tg" ? /^@[A-Za-z0-9_]{4,32}$/.test(v) : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (!ok) { input.setAttribute("aria-invalid", "true"); err.hidden = false; input.focus(); return; }
      done.hidden = false;
      form.querySelector('button[type="submit"]').disabled = true;
    });
  }

  /* ───── Видео ботсада ───── */
  function initVideo() {
    const video = document.querySelector("[data-city-video]");
    const btn = document.querySelector("[data-video-toggle]");
    if (!video || !btn) return;
    const label = btn.querySelector("[data-video-label]");
    const iPlay = btn.querySelector("[data-icon-play]");
    const iPause = btn.querySelector("[data-icon-pause]");
    let userPaused = false;
    const sync = () => {
      const playing = !video.paused;
      btn.setAttribute("aria-pressed", String(playing));
      label.textContent = playing ? "Поставить видео на паузу" : "Воспроизвести видео";
      iPlay.hidden = playing; iPause.hidden = !playing;
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    btn.addEventListener("click", () => {
      if (video.paused) { userPaused = false; video.play().catch(() => {}); }
      else { userPaused = true; video.pause(); }
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && !reduce.matches && !userPaused) video.play().catch(() => {});
          else if (!en.isIntersecting && !video.paused) video.pause();
        });
      }, { threshold: 0.4 }).observe(video);
    }
    sync();
  }

  /* ───── Липкая панель ───── */
  function initDock() {
    const dock = document.querySelector("[data-dock]");
    if (!dock || !("IntersectionObserver" in window)) return;
    const watched = [document.querySelector("[data-hero-cta]"), document.getElementById("year"), document.getElementById("dates")].filter(Boolean);
    const visible = new Set(watched);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      dock.classList.toggle("is-shown", visible.size === 0 && window.scrollY > 200);
    });
    watched.forEach((el) => io.observe(el));
  }

  ready(() => {
    initLine();
    initYear();
    initSend();
    initVideo();
    initDock();
  });
})();
