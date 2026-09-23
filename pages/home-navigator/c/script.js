/* home-navigator/c — «Диалог»: реплики ТвГУ и ответы кнопками, аудитория (localStorage + ?audience= + ?state=audience-*),
   путь с текущим шагом и порядок блоков под аудиторию, фильтр программ со шторкой, ассистент, лид, липкая панель.
   Печать: при первом визите, без reduced-motion. Текст разложен заранее, символы только проявляются — строки не прыгают. */
(function () {
  "use strict";
  const KEY = "tvsu-audience";
  const SEEN = "tvsu-dialog-seen";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 767px)");
  const params = new URLSearchParams(location.search);
  const states = new Set((params.get("state") || "").split(",").map((s) => s.trim()).filter(Boolean));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
  };
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ───── Что отвечает университет каждой аудитории (см. NOTES.md) ───── */
  const AUD = {
    abiturient: {
      me: "Я абитуриент",
      reply: "Вот что обычно нужно абитуриенту:",
      acts: [["Подобрать программу", "#programs"], ["Калькулятор баллов", "Куда проходишь с твоими баллами ЕГЭ", "#"], ["Сроки приёма", "Даты кампании 2027 и твой путь", "#path"]],
      path: "Путь абитуриента", now: "Сентябрь: самое время выбрать программу", current: 0,
      steps: [["Выбрать программу", "Фильтр по ЕГЭ, уровню и форме", "#programs"], ["Посчитать баллы", "Сравнить с проходными прошлого года", "#"], ["Подать документы", "Госуслуги или приёмная комиссия", "#"], ["Следить за конкурсом", "Место в списках каждый день", "#"], ["Зачисление", "Согласие и приказ", "#"]],
      order: ["programs", "faq", "today"],
    },
    student: {
      me: "Я студент",
      reply: "Вот что студенты открывают чаще всего:",
      acts: [["Открыть расписание", "#"], ["Личный кабинет", "Оценки, задания, СДО", "#"], ["Справки и заявления", "Заказать онлайн, забрать в деканате", "#"]],
      path: "Учебный год студента", now: "Сентябрь: первые недели семестра", current: 1,
      steps: [["Расписание", "Группа, преподаватель, аудитория", "#"], ["СДО и задания", "Материалы курсов и дедлайны", "#"], ["Сессия", "Зачёты, экзамены, пересдачи", "#"], ["Справки", "Об обучении, для военкомата, стипендия", "#"], ["Практика", "Места у партнёров университета", "#"]],
      order: ["today", "faq", "programs"],
    },
    parent: {
      me: "Я родитель абитуриента",
      reply: "Родители чаще всего спрашивают про деньги и быт:",
      acts: [["Узнать стоимость", "#faq"], ["Общежитие", "Места, цены, как заселиться", "#faq"], ["День открытых дверей", "Приезжайте вместе", "#today"]],
      path: "Поступление вместе с ребёнком", now: "Начните со сравнения программ и бюджета", current: 0,
      steps: [["Выбрать программу вместе", "Сравнить направления и баллы", "#programs"], ["Посчитать бюджет", "Обучение, жильё, дорога", "#"], ["Проверить общежитие", "Комнаты, столовая, правила", "#"], ["Договор и оплата", "Для платного обучения", "#"], ["Связь с деканатом", "Кураторы и контакты", "#"]],
      order: ["faq", "programs", "today"],
    },
    staff: {
      me: "Я сотрудник",
      reply: "Вот сервисы, которые нужны каждый день:",
      acts: [["Открыть сервисы", "#"], ["Документы и приказы", "Положения, шаблоны, приказы", "#"], ["Конкурсы и гранты", "Открытые конкурсы и сроки", "#"]],
      path: "Главное для сотрудника", now: "Всё на одной линии, без старых разделов", current: 0,
      steps: [["Сервисы", "Почта, СДО, заявки в ИТ", "#"], ["Документы", "Шаблоны и приказы", "#"], ["Гранты", "Конкурсы и отчётность", "#"], ["Повышение квалификации", "Программы и заявки", "#"], ["Отпуск и кадры", "Заявления в отдел кадров", "#"]],
      order: ["today", "faq", "programs"],
    },
    partner: {
      me: "Я представляю организацию",
      reply: "С партнёрами мы обычно начинаем так:",
      acts: [["Предложить проект", "#lead-title"], ["Целевое обучение", "Подготовим специалистов под задачу", "#faq"], ["Практика студентов", "Практиканты и стажёры", "#"]],
      path: "Как начать сотрудничество", now: "Первый шаг — описать задачу", current: 0,
      steps: [["Задача", "Кадры, исследование или событие", "#"], ["Контакт", "Отдел по работе с партнёрами", "#"], ["Договор", "Шаблоны и сроки", "#"], ["Практиканты", "Отбор студентов", "#"], ["Проект", "Команда и отчётность", "#"]],
      order: ["today", "programs", "faq"],
    },
    foreign: {
      me: "I'm an international applicant",
      reply: "Иностранным абитуриентам обычно нужно вот это:",
      acts: [["Выбрать программу", "#programs"], ["Квоты и стипендии", "Квота Правительства РФ и контракт", "#faq"], ["Виза и приезд", "Приглашение, регистрация, общежитие", "#"]],
      path: "Путь иностранного абитуриента", now: "Начните с программы и языка обучения", current: 0,
      steps: [["Выбрать программу", "Уровень и язык обучения", "#programs"], ["Документы и перевод", "Нострификация и перевод", "#"], ["Квота или контракт", "Бюджет по квоте или платно", "#"], ["Виза", "Приглашение от университета", "#"], ["Приезд и общежитие", "Встреча, регистрация, заселение", "#"]],
      order: ["programs", "faq", "today"],
    },
  };
  const IDS = Object.keys(AUD);

  function fromUrl() {
    const p = params.get("audience");
    if (IDS.includes(p)) return p;
    for (const s of states) if (s.startsWith("audience-") && IDS.includes(s.slice(9))) return s.slice(9);
    return null;
  }

  /* ───── Движение ───── */
  const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
  const IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
  const motionOn = () => !reduce.matches && "animate" in Element.prototype && document.documentElement.classList.contains("m-on");
  const rescan = (root) => { if (window.TVSU_MOTION && root) window.TVSU_MOTION.scan(root); };
  /* Пружина без библиотеки: затухающий осциллятор (демпфирование = 1 − bounce, как у Apple), разложенный в linear() */
  function springEasing(bounce) {
    const zeta = 1 - bounce, w = 2 * Math.PI * 1.3, wd = w * Math.sqrt(1 - zeta * zeta), pts = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const x = i === 50 ? 1 : 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
      pts.push(+x.toFixed(4));
    }
    return `linear(${pts.join(", ")})`;
  }
  const SPRING = window.CSS && CSS.supports("transition-timing-function", "linear(0, 1)") ? springEasing(0.2) : EASE_OUT;

  /* Реплика появляется пузырём снизу, от своего «хвостика» */
  const pop = (el, delay, dist = 16) => el.animate(
    [{ opacity: 0, transform: `translate3d(0, ${dist}px, 0) scale(0.94)` }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: "none" }],
    { duration: 620, delay, easing: SPRING, fill: "backwards" }
  );
  const rung = (el, delay) => el.animate(
    [{ opacity: 0, transform: "translate3d(0, 12px, 0) scale(0.97)" }, { opacity: 1, offset: 0.4 }, { opacity: 1, transform: "none" }],
    { duration: 560, delay, easing: SPRING, fill: "backwards" }
  );
  /* Три действия раскладываются веером: стартуют стопкой под репликой, чуть повёрнутые, и разъезжаются по местам */
  function fan(delay, list = []) {
    const items = $$("[data-acts] > li");
    if (!items.length) return list;
    const top0 = items[0].getBoundingClientRect().top;
    items.forEach((li, i) => {
      const dy = top0 - li.getBoundingClientRect().top + 14;
      const rot = [0, -2.5, 2.5][i] || 0;
      li.style.transformOrigin = "0 0";
      list.push(li.animate(
        [{ opacity: 0, transform: `translate3d(0, ${dy}px, 0) rotate(${rot}deg) scale(0.96)` }, { opacity: 1, offset: 0.3 }, { opacity: 1, transform: "none" }],
        { duration: 700, delay: delay + i * 70, easing: SPRING, fill: "backwards" }
      ));
    });
    return list;
  }

  /* ───── Применить аудиторию: содержимое меняется сразу, движение — отдельно и прерываемо ───── */
  function apply(id, { spoken }) {
    const d = AUD[id];
    document.body.dataset.audience = id;
    $$("[data-dialog] [data-audience]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.audience === id)));

    const me = $("[data-me]");
    me.textContent = d.me;
    me.hidden = !spoken;           // своя реплика — только если человек ответил сам (или уже отвечал раньше)
    me.lang = id === "foreign" ? "en" : "";
    if (!me.lang) me.removeAttribute("lang");
    $("[data-reply-text]").textContent = d.reply;

    const acts = $("[data-acts]");
    acts.replaceChildren(...d.acts.map((a, i) => {
      const li = document.createElement("li");
      if (i === 0) {
        li.className = "act act--main";
        li.innerHTML = `<a class="btn btn--accent btn--lg act__main" data-magnetic><span></span><span class="icon icon--arrow-right" aria-hidden="true"></span></a>`;
        li.querySelector("span").textContent = a[0];
        li.querySelector("a").href = a[1];
      } else {
        li.className = "act";
        li.innerHTML = `<a class="act__link"><span class="act__t"></span><span class="act__h"></span><span class="icon icon--arrow-right" aria-hidden="true"></span></a>`;
        li.querySelector(".act__t").textContent = a[0];
        li.querySelector(".act__h").textContent = a[1];
        li.querySelector("a").href = a[2];
      }
      return li;
    }));
    const barCta = $("[data-actionbar-cta]");
    if (barCta) { barCta.textContent = d.acts[0][0]; barCta.href = d.acts[0][1]; }

    $("[data-path-title]").textContent = d.path;
    $("[data-path-now]").textContent = d.now;
    const steps = $("[data-steps]");
    // пока путь ещё не проявлялся — шаги с data-m (проявит общий слой); после — без, чтобы линия текущего шага переехала FLIP'ом
    const firstStep = steps.firstElementChild;
    const fresh = Boolean(firstStep && firstStep.hasAttribute("data-m") && !firstStep.classList.contains("m-in"));
    steps.replaceChildren(...d.steps.map(([t, h, href], i) => {
      const li = document.createElement("li");
      li.className = "step" + (i === d.current ? " is-current" : "");
      if (fresh) li.dataset.m = "up";
      li.innerHTML = `<a class="step__link"><span class="step__n num">${String(i + 1).padStart(2, "0")}</span><span class="step__t"></span><span class="step__h"></span></a>`;
      const a = li.querySelector("a");
      a.href = href;
      li.querySelector(".step__t").textContent = t;
      li.querySelector(".step__h").textContent = h;
      if (i === d.current) {
        a.setAttribute("aria-current", "step");
        a.insertAdjacentHTML("beforeend", `<span class="step__here">Вы здесь</span>`);
      }
      return li;
    }));
    return { fresh };
  }

  /* ───── Печать реплики: символы-спаны под aria-hidden, полный текст — для скринридера ───── */
  function splitForTyping(el) {
    const text = el.textContent.trim().replace(/[ \t\n\r]+/g, " ");
    const sr = document.createElement("span");
    sr.className = "visually-hidden";
    sr.textContent = text;
    const vis = document.createElement("span");
    vis.setAttribute("aria-hidden", "true");
    const chars = [];
    // делим только по обычным пробелам: неразрывные остаются внутри слова, переносы совпадают с итоговой раскладкой
    text.split(/( +)/).forEach((part) => {
      if (/^ +$/.test(part)) { vis.append(" "); return; }
      const word = document.createElement("span");
      word.style.whiteSpace = "nowrap";
      for (const ch of part) {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = ch;
        s.style.opacity = "0";
        word.append(s);
        chars.push(s);
      }
      vis.append(word);
    });
    el.replaceChildren(sr, vis);
    return {
      chars,
      restore() { el.textContent = text; },
    };
  }

  /* Первый визит: ТвГУ «печатает» оффер (точки → символы с курсором), вопрос и ответы лесенкой,
     затем реплика-подсказка и веер действий. Любое действие в диалоге досказывает всё сразу. */
  function playSequence() {
    const dialog = $("[data-dialog]");
    const anims = [];
    const timers = [];
    const cleanups = [];
    const CHAR = 12, DOTS = 380;
    const typing = [];   // { chars, from, to, until }
    const T0 = performance.now();

    function typeMsg(msg, textEl, start, hold) {
      anims.push(pop(msg, start));
      const dots = $$(".msg__dots i", msg);
      timers.push(setTimeout(() => msg.classList.add("is-typing"), start + 120));
      dots.forEach((dot, k) => anims.push(dot.animate(
        [{ opacity: 0.3 }, { opacity: 1 }, { opacity: 0.3 }],
        { duration: 420, delay: start + 120 + k * 90, iterations: 1, easing: "ease-in-out" }
      )));
      const t = splitForTyping(textEl);
      cleanups.push(t.restore);
      const typeStart = start + DOTS + 120;
      timers.push(setTimeout(() => msg.classList.remove("is-typing"), typeStart));
      t.chars.forEach((c, i) => anims.push(c.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 60, delay: typeStart + i * CHAR, easing: "linear", fill: "forwards" }
      )));
      const end = typeStart + t.chars.length * CHAR;
      typing.push({ msg, chars: t.chars, from: typeStart, to: end, until: end + hold });
      return end;
    }

    let t = typeMsg($('[data-line="1"]'), $("#talk-title"), 120, 420);
    anims.push(pop($('[data-line="2"]'), t + 80, 10));
    $$('[data-line="3"] .answer').forEach((b, i) => anims.push(rung(b, t + 200 + i * 55)));
    t = t + 200 + 6 * 55 + 260;
    t = typeMsg($("[data-reply-msg]"), $("[data-reply-text]"), t, 700);
    fan(t + 80, anims);
    anims.push(rung($("[data-search]"), t + 80 + 3 * 70));
    const total = t + 80 + 3 * 70 + 700;

    /* Курсор печати: сплошной, пока идут символы; резко мигает (steps), пока реплика «думает» перед следующей */
    let caretEl = null, raf = 0;
    const setCaret = (el, blink) => {
      if (caretEl !== el) { caretEl?.classList.remove("is-caret", "is-blink"); caretEl = el; }
      el?.classList.add("is-caret");
      el?.classList.toggle("is-blink", blink);
    };
    const caretLoop = () => {
      const now = performance.now() - T0;
      const cur = typing.find((m) => now >= m.from && now < m.until);
      if (!cur) setCaret(null, false);
      else {
        const i = Math.min(cur.chars.length - 1, Math.floor((now - cur.from) / CHAR));
        setCaret(cur.chars[i], now >= cur.to);
      }
      if (now < total) raf = requestAnimationFrame(caretLoop);
    };
    raf = requestAnimationFrame(caretLoop);

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      setCaret(null, false);
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      cleanups.forEach((fn) => fn());
      $$(".msg.is-typing", dialog).forEach((m) => m.classList.remove("is-typing"));
      dialog.removeEventListener("pointerdown", finish, true);
      dialog.removeEventListener("keydown", finish, true);
    }
    // любое действие в диалоге — досказать сразу, не заставлять ждать
    dialog.addEventListener("pointerdown", finish, true);
    dialog.addEventListener("keydown", finish, true);
    timers.push(setTimeout(finish, total + 60));
    store.set(SEEN, "1");
    return finish;
  }

  /* Повторный визит: без печати, тот же разговор собирается пружинками за ~1 с */
  function playReturn() {
    const list = [];
    list.push(pop($('[data-line="1"]'), 60));
    list.push(pop($('[data-line="2"]'), 180, 10));
    $$('[data-line="3"] .answer').forEach((b, i) => list.push(rung(b, 240 + i * 45)));
    const me = $("[data-me]");
    if (!me.hidden) list.push(pop(me, 420, 12));
    list.push(pop($("[data-reply-msg]"), 500));
    fan(600, list);
    list.push(rung($("[data-search]"), 820));
    return list;
  }

  /* Ответ кнопкой: кнопка-призрак улетает в историю диалога и становится вашей репликой (FLIP),
     ТвГУ «думает» и отвечает, действия раскладываются веером, линия «Вы здесь» переезжает к новому шагу.
     Всё прерываемо: новый клик отменяет текущие анимации, контент уже на местах. */
  const live = {
    anims: [], timers: [], nodes: [],
    clear() {
      this.anims.forEach((a) => a.cancel());
      this.timers.forEach(clearTimeout);
      this.nodes.forEach((n) => n.remove());
      $$("[data-dialog] .msg.is-typing").forEach((m) => m.classList.remove("is-typing"));
      this.anims = []; this.timers = []; this.nodes = [];
    },
  };

  function answerMotion(btn, before) {
    const me = $("[data-me]");
    const replyMsg = $("[data-reply-msg]");
    const replyText = $("[data-reply-text]");
    const A = live.anims;

    // 1. Полёт ответа
    if (!me.hidden) {
      const from = before.btn, to = me.getBoundingClientRect();
      const ghost = document.createElement("span");
      ghost.className = "answer-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = btn.textContent;
      Object.assign(ghost.style, {
        left: from.left + window.scrollX + "px", top: from.top + window.scrollY + "px",
        width: from.width + "px", height: from.height + "px",
      });
      document.body.append(ghost);
      live.nodes.push(ghost);
      const cw = Math.max(0, from.width - to.width), ch = Math.max(0, from.height - to.height);
      const fly = ghost.animate(
        [
          { transform: "none", clipPath: "inset(0px 0px 0px 0px round 6px 6px 6px 6px)" },
          { transform: `translate3d(${to.left - from.left}px, ${to.top - from.top}px, 0)`, clipPath: `inset(0px ${cw}px ${ch}px 0px round 8px 8px 2px 8px)` },
        ],
        { duration: 640, easing: SPRING, fill: "forwards" }
      );
      A.push(fly, ghost.animate([{ opacity: 1 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }], { duration: 640, fill: "forwards" }));
      // рамка выбранной кнопки гаснет в полёте: к месту реплики долетает тихая подложка без рамки (как у .msg--me)
      const ring = getComputedStyle(document.documentElement).getPropertyValue("--c-blue-ink").trim() || "currentColor";
      A.push(ghost.animate(
        [{ boxShadow: `inset 0 0 0 1px ${ring}` }, { boxShadow: "inset 0 0 0 1px transparent" }],
        { duration: 260, easing: EASE_OUT, fill: "forwards" }
      ));
      A.push(me.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: 640, easing: "linear", fill: "backwards" }));
      fly.finished.then(() => ghost.remove(), () => {});
    }

    // 2. ТвГУ «думает» и отвечает
    const t = me.hidden ? 0 : 240;
    A.push(pop(replyMsg, t));
    live.timers.push(setTimeout(() => replyMsg.classList.add("is-typing"), t + 120));
    live.timers.push(setTimeout(() => replyMsg.classList.remove("is-typing"), t + 480));
    $$(".msg__dots i", replyMsg).forEach((dot, k) => A.push(dot.animate(
      [{ opacity: 0.3 }, { opacity: 1 }, { opacity: 0.3 }], { duration: 360, delay: t + 120 + k * 80, easing: "ease-in-out" }
    )));
    A.push(replyText.animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: 640, delay: t, easing: "linear", fill: "backwards" }));

    // 3. Веер действий
    fan(t + 440, A);

    // 4. Линия текущего шага переезжает (FLIP по псевдоэлементу)
    const cur = $(".step.is-current .step__link");
    if (cur && before.step && !before.fresh) {
      const r = cur.getBoundingClientRect(), o = before.step;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const from = wide
        ? `translate3d(${o.left - r.left}px, 0, 0) scaleX(${o.width / r.width})`
        : `translate3d(0, ${o.top - r.top}px, 0) scaleY(${o.height / r.height})`;
      if (Math.abs(o.left - r.left) > 1 || Math.abs(o.top - r.top) > 1) {
        A.push(cur.animate([{ transform: from }, { transform: "none" }], { duration: 620, easing: SPRING, pseudoElement: "::before" }));
        const here = $(".step__here", cur);
        if (here) A.push(here.animate([{ opacity: 0, transform: "translate3d(0, 6px, 0)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 260, easing: EXPO, fill: "backwards" }));
      }
    }
  }

  /* Порядок блоков 4–6 */
  function reorderBlocks(order, animate) {
    const box = $("[data-blocks]");
    const secs = $$(":scope > [data-block]", box);
    const first = animate ? new Map(secs.map((s) => [s, s.getBoundingClientRect().top])) : null;
    order.forEach((key) => { const sec = $(`[data-block="${key}"]`, box); if (sec) box.appendChild(sec); });
    if (!animate) return;
    const vh = window.innerHeight;
    secs.forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      let dy = first.get(s) - r.top;
      if (Math.abs(dy) < 1) return;
      const far = Math.abs(dy) > vh * 0.6;
      if (far) dy = Math.sign(dy) * vh * 0.25;
      live.anims.push(s.animate(
        [{ transform: `translate3d(0, ${dy}px, 0)`, opacity: far ? 0 : 1 }, { transform: "none", opacity: 1 }],
        { duration: far ? 760 : 600, easing: far ? EXPO : IN_OUT }
      ));
    });
  }

  function initDialog() {
    const url = fromUrl();
    const saved = IDS.includes(store.get(KEY)) ? store.get(KEY) : null;
    const first = url || saved || "abiturient";
    apply(first, { spoken: Boolean(url || saved) });
    reorderBlocks(AUD[first].order, false);

    let stopIntro = null;
    // состояние со слоем поверх всей страницы (меню, поиск): разговор под ним не разыгрываем — его не видно
    const covered = states.has("menu-open") || states.has("search-open");
    if (motionOn() && !covered) {
      if (!url && !saved && !store.get(SEEN)) stopIntro = playSequence();
      else live.anims.push(...playReturn());
    }

    $$("[data-dialog] [data-audience]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.audience;
      if (stopIntro) { stopIntro(); stopIntro = null; }
      const wasSpoken = !$("[data-me]").hidden;
      if (document.body.dataset.audience === id && wasSpoken) return;
      const animate = motionOn();
      live.clear();
      const stepEl = $(".step.is-current .step__link");
      const before = { btn: btn.getBoundingClientRect(), step: stepEl && stepEl.getBoundingClientRect() };
      store.set(KEY, id);
      const { fresh } = apply(id, { spoken: true });
      before.fresh = fresh;
      rescan($("[data-acts]").parentElement);
      if (fresh) rescan($("[data-steps]").parentElement);
      reorderBlocks(AUD[id].order, animate);
      if (animate) answerMotion(btn, before);
      if (mobile.matches) {
        const r = $("[data-reply]").getBoundingClientRect();
        if (r.top > window.innerHeight - 160) $("[data-reply]").scrollIntoView({ block: "start", behavior: reduce.matches ? "auto" : "smooth" });
      }
    }));
  }

  /* ───── Счётчик дней ───── */
  function initCountdown() {
    const box = $("[data-countdown]");
    if (!box) return;
    const days = Math.ceil((new Date(box.dataset.countdown + "T00:00:00+03:00") - Date.now()) / 864e5);
    const num = $("[data-countdown-num]", box), unit = $("[data-countdown-unit]", box);
    if (days > 0) { num.textContent = String(days); unit.textContent = plural(days, "день", "дня", "дней") + " до старта приёма"; }
    else { num.textContent = "идёт"; unit.textContent = "приём документов"; }
  }

  /* ───── Фильтр программ и шторка ───── */
  function initFilters() {
    const form = $("[data-filters]");
    if (!form) return;
    const cards = $$("[data-cards] .card");
    const empty = $("[data-cards-empty]");
    const count = $("[data-prog-count]");
    const applyBtn = $("[data-filters-apply]");
    const badge = $("[data-filters-badge]");
    const openBtn = $("[data-filters-open]");
    const backdrop = $("[data-filters-backdrop]");
    let lastFocus = null;

    const run = () => {
      const f = Object.fromEntries(new FormData(form));
      let shown = 0;
      cards.forEach((c) => {
        const ok = (!f.level || c.dataset.level === f.level) && (!f.form || c.dataset.form === f.form) &&
          (!f.dir || c.dataset.dir === f.dir) && (!f.basis || c.dataset.basis.split(" ").includes(f.basis));
        c.hidden = !ok;
        if (ok) shown++;
      });
      const active = Object.values(f).filter(Boolean).length;
      empty.hidden = shown > 0;
      count.textContent = `Показаны ${shown} из ${cards.length}`;
      applyBtn.textContent = shown ? `Показать ${shown} ${plural(shown, "программу", "программы", "программ")}` : "Нет программ";
      badge.hidden = !active;
      badge.textContent = String(active);
    };
    form.addEventListener("change", run);
    form.addEventListener("reset", () => setTimeout(run));
    form.addEventListener("submit", (e) => e.preventDefault());
    $("[data-filters-reset]")?.addEventListener("click", () => form.reset());

    const onKey = (e) => { if (e.key === "Escape") close(); };
    // модальная шторка: всё, что вне неё (кроме подложки), делаем inert на время показа
    let inerted = [];
    const setInert = (on) => {
      if (!on) { inerted.forEach((el) => { el.inert = false; }); inerted = []; return; }
      for (let node = form; node && node !== document.body; node = node.parentElement) {
        [...node.parentElement.children].forEach((sib) => {
          if (sib !== node && sib !== backdrop && !sib.inert && sib.tagName !== "SCRIPT") { sib.inert = true; inerted.push(sib); }
        });
      }
    };
    function open() {
      if (!mobile.matches) return;
      setInert(true);
      lastFocus = document.activeElement;
      form.setAttribute("role", "dialog");
      form.setAttribute("aria-modal", "true");
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add("is-open"));
      form.classList.add("is-open");
      openBtn.setAttribute("aria-expanded", "true");
      document.documentElement.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
      $("select", form).focus({ preventScroll: true });
    }
    function close() {
      form.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      setInert(false);
      form.removeAttribute("role"); form.removeAttribute("aria-modal");
      openBtn.setAttribute("aria-expanded", "false");
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      setTimeout(() => { if (!form.classList.contains("is-open")) backdrop.hidden = true; }, 300);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }
    openBtn.addEventListener("click", open);
    $("[data-filters-close]").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    applyBtn.addEventListener("click", () => { close(); $("#programs").scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth" }); });
    mobile.addEventListener?.("change", () => { if (!mobile.matches && form.classList.contains("is-open")) close(); });
    run();
    if (states.has("filters-open") && mobile.matches) {
      $("#programs").scrollIntoView();
      open();
    }
  }

  /* ───── Ассистент ───── */
  function initChat() {
    const panel = $("[data-chat]");
    const fab = $(".chat-fab");
    if (!panel || !fab) return;
    let lastFocus = null;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function open() {
      lastFocus = document.activeElement;
      panel.hidden = false;
      fab.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", onKey);
      $("#chat-q").focus({ preventScroll: true });
    }
    function close() {
      panel.hidden = true;
      fab.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onKey);
      (lastFocus || fab).focus({ preventScroll: true });
    }
    $$("[data-chat-open]").forEach((b) => b.addEventListener("click", () => (panel.hidden ? open() : close())));
    $("[data-chat-close]").addEventListener("click", close);
    $("[data-chat-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("#chat-q");
      if (!q.value.trim()) { q.focus(); return; }
      const msg = document.createElement("p");
      msg.className = "chat__msg";
      msg.textContent = "Спасибо! Вопрос передан в приёмную комиссию (в прототипе никуда не уходит).";
      $(".chat__body", panel).append(msg);
      q.value = "";
    });
    if (states.has("chat-open")) open();
  }

  /* ───── Лид ───── */
  function initLead() {
    const form = $("[data-lead]");
    if (!form) return;
    const q = $("#lead-q"), c = $("#lead-c"), msg = $("[data-lead-msg]");
    const base = msg.textContent;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = c.value.trim();
      const okC = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^@[A-Za-z0-9_]{4,32}$/.test(v);
      const okQ = q.value.trim().length > 2;
      if (okQ) q.removeAttribute("aria-invalid"); else q.setAttribute("aria-invalid", "true");
      if (okC) c.removeAttribute("aria-invalid"); else c.setAttribute("aria-invalid", "true");
      if (okQ && okC) {
        form.classList.add("is-done");
        msg.className = "field__hint";
        msg.textContent = "Вопрос отправлен. Ответ придёт на указанный контакт.";
      } else {
        msg.className = "field__error";
        msg.textContent = !okQ ? "Напишите вопрос хотя бы в пару слов" : v ? "Нужен e-mail вида name@mail.ru или ник вида @username" : "Впишите e-mail или ник в Telegram";
        (!okQ ? q : c).focus();
      }
    });
    [q, c].forEach((el) => el.addEventListener("input", () => {
      if (el.hasAttribute("aria-invalid")) { el.removeAttribute("aria-invalid"); msg.className = "field__hint"; msg.textContent = base; }
    }));
  }

  /* ───── Липкая панель (390) и FAB: после главной кнопки hero, не поверх подвала ───── */
  function initActionbar() {
    const bar = $("[data-actionbar]"), hero = $("[data-acts]");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    const link = $("a", bar);
    let past = false, footer = false;
    const set = () => {
      const on = past && !footer && mobile.matches;
      bar.classList.toggle("is-on", on);
      bar.setAttribute("aria-hidden", String(!on));
      link.tabIndex = on ? 0 : -1;
      document.body.classList.toggle("has-actionbar", on);
      document.body.classList.toggle("past-hero", past);
    };
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; set(); }).observe(hero);
    (window.TVSU?.ready || Promise.resolve()).then(() => {
      const f = $(".site-footer");
      if (f) new IntersectionObserver(([e]) => { footer = e.isIntersecting; set(); }).observe(f);
    });
    mobile.addEventListener?.("change", set);
  }

  function init() {
    initDialog();
    initCountdown();
    initFilters();
    initChat();
    initLead();
    initActionbar();
    $("[data-search]")?.addEventListener("submit", (e) => e.preventDefault());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
