/* admissions-sell/b — «Лица поступивших».
   Истории по одной дороге (авторский момент: дорога рисуется прокруткой, остановки встают по очереди; смена истории — кроссфейд),
   клубы, видео в ленте дня, калькулятор (пример данных), лид, липкая панель. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const P = "../../../assets/stub/photos/";
  const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  const EASE_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

  /* Истории: цитаты и ответы НЕ выдуманы — это вопросы для интервью в скобках. */
  const STORIES = [
    {
      img: P + "portrait-studentka-v-ochkah.jpg", pos: "35% 35%",
      alt: "Студентка в очках слушает на занятии",
      quote: "«Фраза о том, почему выбрала Тверь, а не город поближе к дому»",
      who: "[Имя], факультет иностранных языков и международной коммуникации, [курс]",
      stops: [
        "[Какие ЕГЭ и сколько баллов, почему эта программа, что посоветовала бы себе в 11 классе]",
        "[Первая сессия: что было сложно, какой предмет зацепил, кто из преподавателей запомнился]",
        "[Как заселилась, с кем живёт, сколько платит в месяц, что взять с собой]",
        "[Где проходила практику, как нашла место, что дальше]"
      ],
      talk: "Задать вопрос студентке", program: "Программы факультета"
    },
    {
      img: P + "portrait-inostrannye-studenty-ulica.jpg", pos: "50% 30%",
      alt: "Иностранные студенты на улице Твери",
      quote: "«Фраза о первом дне в России: что удивило, кто помог»",
      who: "[Имена], Институт экономики и управления, [курс]",
      stops: [
        "[Как подавали документы из своей страны, квота или контракт, сколько заняла виза]",
        "[Подготовительное отделение, язык, первые оценки]",
        "[Общежитие для иностранных студентов: соседи, кухня, что привезли из дома]",
        "[Практика или стажировка, планы после выпуска]"
      ],
      talk: "Задать вопрос студентам", program: "Программы института"
    },
    {
      img: P + "students-biblioteka-diskussiya.jpg", pos: "50% 40%",
      alt: "Студенты спорят над книгами в библиотеке",
      quote: "«Фраза о том, зачем сегодня учиться на историка»",
      who: "[Имена], исторический факультет, [курс]",
      stops: [
        "[Какие баллы по истории и обществознанию, была ли олимпиада]",
        "[Первый семинар, первая курсовая, любимый архив или музей]",
        "[Живут в общежитии или снимают, сколько это стоит]",
        "[Археологическая или музейная практика: где и что нашли]"
      ],
      talk: "Задать вопрос студентам", program: "Программы факультета"
    },
    {
      img: P + "students-za-noutbukom.jpg", pos: "50% 40%",
      alt: "Студенты работают за ноутбуком",
      quote: "«Фраза о том, чем прикладная математика оказалась не похожа на школьную»",
      who: "[Имя], факультет прикладной математики и кибернетики, [курс]",
      stops: [
        "[Профильная математика и информатика: баллы, как готовилась]",
        "[Первый язык программирования, первый проект в команде]",
        "[Быт в общежитии: интернет, тишина для учёбы]",
        "[Практика в IT-компании: как попала, что делала]"
      ],
      talk: "Задать вопрос студентке", program: "Программы факультета"
    }
  ];

  function ready(fn) {
    if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(fn);
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* ───── Истории ───── */
  function initStories() {
    const tabs = [...document.querySelectorAll(".story-tab")];
    const panel = document.getElementById("story-panel");
    if (!tabs.length || !panel) return;
    const photo = panel.querySelector(".story__photo");
    const quote = panel.querySelector("[data-story-quote]");
    const who = panel.querySelector("[data-story-who]");
    const stops = [...panel.querySelectorAll("[data-stop]")];
    const stopItems = [...panel.querySelectorAll(".road__stop")];
    const road = panel.querySelector("[data-road]");
    const talk = panel.querySelector("[data-story-talk]");
    const program = panel.querySelector("[data-story-program]");
    let current = 0;
    let token = 0;

    function paint(i) {
      const s = STORIES[i];
      quote.textContent = s.quote;
      who.textContent = s.who;
      stops.forEach((p, n) => { p.textContent = s.stops[n]; });
      talk.textContent = s.talk;
      program.firstChild.textContent = s.program + " ";
    }

    async function show(i, focus) {
      if (i === current) { if (focus) tabs[i].focus(); return; }
      const my = ++token;
      tabs.forEach((t, n) => {
        const on = n === i;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[i].focus();
      panel.setAttribute("aria-labelledby", tabs[i].id);
      current = i;
      const s = STORIES[i];

      const next = new Image();
      next.src = s.img; next.alt = s.alt; next.width = 2000; next.height = 1333;
      next.dataset.storyImg = "";
      next.style.objectPosition = s.pos;

      if (reduce.matches) {
        stopItems.forEach((el) => el.classList.add("is-on"));
        photo.replaceChildren(next);
        paint(i);
        return;
      }
      try { await next.decode(); } catch (e) { /* покажем как есть */ }
      if (my !== token) return;

      // кроссфейд: новое фото проявляется поверх старого и доезжает из лёгкого зума
      photo.querySelectorAll("img").forEach((old, n, all) => { if (n < all.length - 1) old.remove(); });
      photo.appendChild(next);
      const wipe = next.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 460, easing: EASE_OUT, fill: "both" }
      );
      next.animate(
        [{ transform: "scale(1.06)" }, { transform: "none" }],
        { duration: 1100, easing: EASE_EXPO }
      );
      road.style.setProperty("--road-p", "1");
      stopItems.forEach((el) => el.classList.add("is-on"));

      // текст: гаснет быстро, приходит с остановками по очереди
      paint(i);
      const textEls = [quote.parentElement, who];
      textEls.forEach((el) => el.animate(
        [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: 320, easing: EASE_OUT, fill: "backwards" }
      ));
      const axis = window.matchMedia("(min-width: 768px)").matches ? "scaleX" : "scaleY";
      try {
        road.animate(
          [{ transform: axis + "(0)" }, { transform: axis + "(1)" }],
          { duration: 480, easing: EASE_OUT, pseudoElement: "::before" }
        );
      } catch (e) { /* без псевдоэлементов в WAAPI линия просто стоит */ }
      stopItems.forEach((el, n) => el.animate(
        [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: 320, delay: 140 + n * 60, easing: EASE_OUT, fill: "backwards" }
      ));

      wipe.finished.then(() => {
        if (my !== token) return;
        photo.querySelectorAll("img").forEach((img) => { if (img !== next) img.remove(); });
        wipe.cancel();
      }).catch(() => {});
    }

    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(i));
      t.addEventListener("keydown", (e) => {
        let n = null;
        if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") n = 0;
        if (e.key === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); show(n, true); }
      });
    });

    document.querySelectorAll("[data-story-link]").forEach((a) => {
      a.addEventListener("click", () => show(Number(a.dataset.storyLink)));
    });
  }

  /* ───── Путь студента по прокрутке ─────
     Один rAF на страницу: одна мерка дороги за кадр, прогресс защёлкивается (назад не стирается)
     и догоняется мягко (lerp), остановка появляется, когда линия до неё дошла. */
  function initRoadScrub() {
    const road = document.querySelector("[data-road]");
    if (!road || !document.documentElement.classList.contains("m-on")) return;
    const stops = [...road.querySelectorAll(".road__stop")];
    const wide = window.matchMedia("(min-width: 768px)");
    const four = window.matchMedia("(min-width: 1024px)");
    let goal = 0, shown = 0, raf = 0, marks = [];
    road.classList.add("is-scrub");
    road.style.setProperty("--road-p", "0");

    const measure = () => {
      const w = road.clientWidth || 1, h = road.clientHeight || 1;
      marks = stops.map((s, n) => (four.matches ? s.offsetLeft / w : wide.matches ? n / stops.length : s.offsetTop / h));
    };
    const read = () => {
      const r = road.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.92;
      const end = wide.matches ? vh * 0.5 : vh * 0.6 - r.height;   // где верх дороги, когда линия дорисована
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      if (p > goal) goal = p;
    };
    const frame = () => {
      raf = 0;
      read();
      shown += (goal - shown) * 0.16;
      if (goal - shown < 0.002) shown = goal;
      road.style.setProperty("--road-p", shown.toFixed(4));
      stops.forEach((s, n) => { if (shown >= marks[n] + 0.015) s.classList.add("is-on"); });
      if (shown < goal) raf = requestAnimationFrame(frame);
      else if (shown >= 1) window.removeEventListener("scroll", kick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    measure();
    new ResizeObserver(() => { measure(); kick(); }).observe(road);
    window.addEventListener("scroll", kick, { passive: true });
    kick();
  }

  /* ───── После пар ───── */
  function initLife() {
    const items = [...document.querySelectorAll(".life__item")];
    const imgs = [...document.querySelectorAll(".life__stage img")];
    if (!items.length) return;
    const set = (i) => {
      items.forEach((b, n) => b.setAttribute("aria-pressed", String(n === i)));
      imgs.forEach((img, n) => img.classList.toggle("is-on", n === i));
    };
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    items.forEach((b, i) => {
      b.addEventListener("click", () => set(i));
      b.addEventListener("focus", () => set(i));
      b.addEventListener("pointerenter", () => { if (fine.matches) set(i); });
    });
  }

  /* ───── Видео в ленте дня ───── */
  function initVideo() {
    const video = document.querySelector("[data-day-video]");
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
      }, { threshold: 0.5 }).observe(video);
    }
    sync();
  }

  /* ───── Калькулятор (пример данных для прототипа) ───── */
  const PROGRAMS = [
    { name: "Лингвистика", fac: "Иностранные языки", need: ["Русский язык", "Иностранный язык", "История"], pass: 241 },
    { name: "Экономика", fac: "Институт экономики и управления", need: ["Русский язык", "Математика (профиль)", "Обществознание"], pass: 228 },
    { name: "История", fac: "Исторический факультет", need: ["Русский язык", "История", "Обществознание"], pass: 212 },
    { name: "Юриспруденция", fac: "Юридический факультет", need: ["Русский язык", "Обществознание", "История"], pass: 255 },
    { name: "Психология", fac: "Факультет психологии", need: ["Русский язык", "Биология", "Обществознание"], pass: 219 },
    { name: "Прикладная математика и информатика", fac: "ПМиК", need: ["Русский язык", "Математика (профиль)", "Информатика"], pass: 205 },
    { name: "Реклама и связи с общественностью", fac: "Филологический факультет", need: ["Русский язык", "Обществознание", "История"], pass: 233 },
    { name: "Педагогическое образование", fac: "Институт педагогического образования", need: ["Русский язык", "Обществознание", "История"], pass: 198 }
  ];
  const BONUS = { medal: 5, gto: 2, vol: 2 }; // пример, реальные баллы — в правилах приёма

  function initCalc() {
    const form = document.querySelector("[data-calc]");
    if (!form) return;
    const err = form.querySelector("[data-calc-error]");
    const result = document.querySelector("[data-calc-result]");
    const empty = result.querySelector("[data-calc-empty]");
    const filled = result.querySelector("[data-calc-filled]");
    const sumEl = result.querySelector("[data-calc-sum]");
    const list = result.querySelector("[data-calc-list]");
    const inputs = ["b1", "b2", "b3"].map((id) => form.elements[id]);

    inputs.forEach((inp) => inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(0, 3);
      inp.removeAttribute("aria-invalid");
    }));

    function run() {
      const vals = inputs.map((i) => (i.value === "" ? NaN : Number(i.value)));
      const bad = vals.map((v) => !(v >= 0 && v <= 100));
      inputs.forEach((inp, n) => inp.toggleAttribute("aria-invalid", bad[n]));
      if (bad.some(Boolean)) {
        err.hidden = false;
        inputs[bad.indexOf(true)].focus();
        return;
      }
      err.hidden = true;
      const subjects = ["s1", "s2", "s3"].map((id) => form.elements[id].value);
      let sum = vals.reduce((a, b) => a + b, 0);
      Object.keys(BONUS).forEach((k) => { if (form.elements[k].checked) sum += BONUS[k]; });

      const rows = PROGRAMS.map((p) => {
        const match = p.need.every((s) => subjects.includes(s));
        return { ...p, match, gap: p.pass - sum };
      }).filter((p) => p.match).sort((a, b) => a.gap - b.gap);
      const pass = rows.filter((r) => r.gap <= 0);
      const near = rows.filter((r) => r.gap > 0);
      const show = near.length ? pass.slice(0, 2).concat(near.slice(0, 3 - Math.min(pass.length, 2))) : pass.slice(0, 3);

      const prevSum = parseInt(sumEl.textContent, 10) || 0;
      if (reduce.matches || prevSum === sum) sumEl.textContent = sum;
      else {
        const t0 = performance.now();
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / 700), e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
          sumEl.textContent = Math.round(prevSum + (sum - prevSum) * e);
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
      empty.hidden = true;
      filled.hidden = false;
      list.replaceChildren();
      if (!show.length) {
        const li = document.createElement("li");
        li.className = "calc__item";
        li.innerHTML = '<span class="calc__item-name">С такими предметами программ в примере нет</span><span class="calc__item-meta">Попробуйте другой второй или третий предмет</span>';
        list.appendChild(li);
      }
      show.forEach((r, n) => {
        const li = document.createElement("li");
        li.className = "calc__item";
        const ok = r.gap <= 0;
        li.innerHTML =
          '<span class="calc__item-name"></span>' +
          '<span class="calc__item-meta"></span>' +
          '<span class="calc__verdict' + (ok ? " is-pass" : "") + '"></span>';
        li.children[0].textContent = r.name;
        li.children[1].textContent = r.fac + " · проходной 2026 (пример): " + r.pass;
        li.children[2].textContent = ok ? "Баллов хватает на бюджет" : "Не хватает " + r.gap + " до бюджета";
        list.appendChild(li);
        if (!reduce.matches) {
          li.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
            { duration: 260, delay: n * 50, easing: EASE_OUT, fill: "backwards" });
          // вердикт — штамп: коротко и резко, после появления строки
          li.children[2].animate([{ transform: "scale(1.12)", opacity: 0 }, { transform: "none", opacity: 1 }],
            { duration: 160, delay: 180 + n * 50, easing: EASE_OUT, fill: "backwards" });
        }
      });
    }

    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });

    const states = (window.TVSU && window.TVSU.states) || new Set();
    if (states.has("calc-result")) {
      form.elements.b1.value = "78";
      form.elements.s2.value = "Обществознание";
      form.elements.b2.value = "84";
      form.elements.s3.value = "История";
      form.elements.b3.value = "71";
      form.elements.medal.checked = true;
      run();
    }
  }

  /* ───── Лид ───── */
  function initTalk() {
    const form = document.querySelector("[data-talk]");
    if (!form) return;
    const contact = form.elements.contact;
    const err = document.getElementById("t-contact-err");
    const done = form.querySelector("[data-talk-done]");
    const submit = form.querySelector("[data-talk-submit]");
    form.querySelectorAll('input[name="to"]').forEach((r) => r.addEventListener("change", () => {
      submit.textContent = r.value === "student" ? "Поговорить со студентом" : "Задать вопрос";
    }));
    contact.addEventListener("input", () => { contact.removeAttribute("aria-invalid"); err.hidden = true; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = contact.value.trim();
      const ok = /^@[A-Za-z0-9_]{4,32}$/.test(v) || v.replace(/\D/g, "").length === 11;
      if (!ok) {
        contact.setAttribute("aria-invalid", "true");
        err.hidden = false;
        contact.focus();
        return;
      }
      done.hidden = false;
      submit.disabled = true;
    });
  }

  /* ───── Липкая панель на мобильном ───── */
  function initDock() {
    const dock = document.querySelector("[data-dock]");
    if (!dock || !("IntersectionObserver" in window)) return;
    const watched = [document.querySelector("[data-hero-cta]"), document.querySelector(".dates__count"), document.getElementById("talk")].filter(Boolean);
    const visible = new Set(watched);
    const update = () => dock.classList.toggle("is-shown", visible.size === 0);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      update();
    });
    watched.forEach((el) => io.observe(el));
  }

  ready(() => {
    initRoadScrub();
    initStories();
    initLife();
    initVideo();
    initCalc();
    initTalk();
    initDock();
  });
})();
