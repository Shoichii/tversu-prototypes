/* home-navigator/b — «Сцена»: аудитория (localStorage + ?audience= + ?state=audience-*), сцена со склейкой-шторкой,
   путь и порядок блоков под аудиторию, фильтр программ со шторкой на мобильном, ассистент, лид, липкая панель. */
(function () {
  "use strict";
  const KEY = "tvsu-audience";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 767px)");
  const desktop = window.matchMedia("(min-width: 1024px)"); // сцена справа на всю высоту колонки оффера
  const params = new URLSearchParams(location.search);
  const states = new Set((params.get("state") || "").split(",").map((s) => s.trim()).filter(Boolean));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ───── Что меняется для каждой аудитории (см. NOTES.md) ───── */
  const AUD = {
    abiturient: {
      title: "Поступай в ТвГУ: 129 программ и пять шагов до зачисления",
      lead: "Выбери направление, посчитай баллы ЕГЭ и подай документы онлайн. Подскажем на каждом шаге.",
      cta: ["Подобрать программу", "#programs"],
      quick: [["Каталог программ", "129 программ, фильтр по ЕГЭ", "#programs"], ["Калькулятор баллов", "Куда проходишь с твоими баллами", "#"], ["Сроки приёма", "Даты кампании 2027", "#deadline"]],
      pathFor: "Пять шагов абитуриента: от выбора программы до приказа о зачислении",
      steps: [["Выбрать программу", "Фильтр по ЕГЭ, уровню и форме", "#programs"], ["Посчитать баллы", "Сравнить с проходными прошлого года", "#"], ["Подать документы", "Госуслуги или приёмная комиссия", "#"], ["Следить за конкурсом", "Место в списках каждый день", "#"], ["Зачисление", "Согласие и приказ", "#"]],
      order: ["programs", "faq", "today"],
      caption: "День знаний: лекция на газоне во дворе университета",
      note: "Приём документов на 2027 год: с [20 июня]",
    },
    student: {
      title: "Расписание, кабинет и справки в двух кликах",
      lead: "Пары на неделю, задания в СДО и заявления без очереди в деканат. Всё, что нужно для учёбы, здесь.",
      cta: ["Открыть расписание", "#"],
      quick: [["Расписание", "Пары твоей группы на неделю", "#"], ["Личный кабинет", "Оценки, задания, СДО", "#"], ["Справки и заявления", "Заказать онлайн, забрать в деканате", "#"]],
      pathFor: "Учебный год студента по шагам",
      steps: [["Расписание", "Группа, преподаватель, аудитория", "#"], ["СДО и задания", "Материалы курсов и дедлайны", "#"], ["Сессия", "Зачёты, экзамены, пересдачи", "#"], ["Справки", "Об обучении, для военкомата, стипендия", "#"], ["Практика и стажировки", "Места у партнёров университета", "#"]],
      order: ["today", "faq", "programs"],
      caption: "Поточная аудитория-амфитеатр: лекция для всего курса",
      note: "Сегодня в ТвГУ: [N] событий на неделе",
    },
    parent: {
      title: "Что важно родителю: стоимость, общежитие и связь с деканатом",
      lead: "Честно о деньгах и быте: сколько стоит обучение, где живут первокурсники и кому звонить, если что-то пошло не так.",
      cta: ["Узнать стоимость", "#faq"],
      quick: [["Стоимость и оплата", "Цены по программам, рассрочка", "#faq"], ["Общежитие", "Места, цены, как заселиться", "#faq"], ["День открытых дверей", "Приезжайте вместе", "#today"]],
      pathFor: "Как пройти поступление вместе с ребёнком",
      steps: [["Выбрать программу вместе", "Сравнить направления и баллы", "#programs"], ["Посчитать бюджет", "Обучение, жильё, дорога", "#"], ["Проверить общежитие", "Комнаты, столовая, правила", "#"], ["Договор и оплата", "Для платного обучения", "#"], ["Связь с деканатом", "Кураторы и контакты", "#"]],
      order: ["faq", "programs", "today"],
      caption: "Общежитие: столовая-кафе для студентов",
      note: "Место в общежитии: [N ₽ в месяц]",
    },
    staff: {
      title: "Сервисы, документы и гранты сотрудника ТвГУ",
      lead: "Почта, кадровые документы, конкурсы и повышение квалификации без поиска по старым разделам.",
      cta: ["Открыть сервисы", "#"],
      quick: [["Сервисы и почта", "Корпоративная почта, СДО, заявки", "#"], ["Документы и приказы", "Положения, шаблоны, приказы", "#"], ["Конкурсы и гранты", "Открытые конкурсы и сроки", "#"]],
      pathFor: "Главное для сотрудника на одной линии",
      steps: [["Сервисы", "Почта, СДО, заявки в ИТ", "#"], ["Документы", "Шаблоны и приказы", "#"], ["Гранты", "Конкурсы и отчётность", "#"], ["Повышение квалификации", "Программы и заявки", "#"], ["Отпуск и кадры", "Заявления в отдел кадров", "#"]],
      order: ["today", "faq", "programs"],
      caption: "Научное шоу: опыт перед зрителями",
      note: "Открытые конкурсы и гранты: [N]",
    },
    partner: {
      title: "Студенты и наука ТвГУ для вашей организации",
      lead: "Целевое обучение, практика и совместные проекты с 15 факультетами и институтами. Один контакт на всё.",
      cta: ["Предложить проект", "#lead-title"],
      quick: [["Целевое обучение", "Подготовим специалистов под задачу", "#faq"], ["Практика студентов", "Практиканты и стажёры", "#"], ["Совместные проекты", "Исследования и заказы", "#"]],
      pathFor: "Как начать сотрудничество",
      steps: [["Задача", "Кадры, исследование или событие", "#"], ["Контакт", "Отдел по работе с партнёрами", "#"], ["Договор", "Шаблоны и сроки", "#"], ["Практиканты", "Отбор студентов", "#"], ["Проект", "Команда и отчётность", "#"]],
      order: ["today", "programs", "faq"],
      caption: "Памятная стела во дворе университета",
      note: "15 факультетов и институтов, 129 программ",
    },
    foreign: {
      title: "Учиться в России: 129 программ в городе на Волге",
      lead: "Бакалавриат, магистратура и аспирантура в университете с 1870 года. Поможем с визой, документами и жильём.",
      cta: ["Выбрать программу", "#programs"],
      quick: [["Programs in English", "Программы и курсы на английском", "#"], ["Квоты и стипендии", "Квота Правительства РФ и контракт", "#faq"], ["Виза и приезд", "Приглашение, регистрация, общежитие", "#"]],
      pathFor: "Пять шагов иностранного абитуриента",
      steps: [["Выбрать программу", "Уровень и язык обучения", "#programs"], ["Документы и перевод", "Нострификация и перевод", "#"], ["Квота или контракт", "Бюджет по квоте или платно", "#"], ["Виза", "Приглашение от университета", "#"], ["Приезд и общежитие", "Встреча, регистрация, заселение", "#"]],
      order: ["programs", "faq", "today"],
      caption: "Иностранные студенты ТвГУ на прогулке по Твери",
      note: "Консультация для иностранных абитуриентов: [дата]",
    },
  };
  const IDS = Object.keys(AUD);

  function initialAudience() {
    const p = params.get("audience");
    if (IDS.includes(p)) return p;
    for (const s of states) if (s.startsWith("audience-") && IDS.includes(s.slice(9))) return s.slice(9);
    try { const v = localStorage.getItem(KEY); if (IDS.includes(v)) return v; } catch (e) { /* приватный режим */ }
    return "abiturient";
  }

  /* ───── Движение: общий слой + свои WAAPI-анимации смены аудитории ───── */
  const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
  const IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
  const OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  const motionOn = () => document.documentElement.classList.contains("m-on") && !reduce.matches && "animate" in Element.prototype;
  const rescan = (root) => { if (window.TVSU_MOTION && root) window.TVSU_MOTION.scan(root); };
  const rise = (el, { delay = 0, dist = 10, duration = 520 } = {}) => el.animate(
    [{ opacity: 0, transform: `translate3d(0, ${dist}px, 0)` }, { opacity: 1, transform: "none" }],
    { duration, delay, easing: EXPO, fill: "backwards" }
  );

  /* Индикатор выбранного чипа: одна тёмная плашка под чипами, едет clip-path'ом (150 мс) */
  const ink = {
    el: null, box: null,
    init() {
      this.box = $("[data-audience-chips]");
      if (!this.box || !motionOn()) return;
      this.el = document.createElement("span");
      this.el.className = "who__ink";
      this.el.setAttribute("aria-hidden", "true");
      this.box.prepend(this.el);
      this.box.classList.add("has-ink");
      if ("ResizeObserver" in window) {
        const ro = new ResizeObserver(() => this.move(false));
        ro.observe(this.box);
        $$(".chip", this.box).forEach((c) => ro.observe(c));
      }
    },
    /* В покое плашка ровно под нажатым чипом (иначе под соседними чипами тёмный фон — и для глаз, и для axe).
       На время езды раскрывается на весь ряд и едет clip-path'ом; повторный клик в пути перенацеливает transition. */
    cur: null, wide: false, timer: 0,
    set(box, clip) {
      const s = this.el.style;
      s.left = box[0] + "px"; s.top = box[1] + "px"; s.width = box[2] + "px"; s.height = box[3] + "px";
      if (clip) s.clipPath = clip;
    },
    instant(fn) {
      this.el.style.transition = "none";
      fn();
      void this.el.offsetWidth;
      this.el.style.transition = "";
    },
    clipFor(c, W, H) {
      return `inset(${c.offsetTop}px ${W - c.offsetLeft - c.offsetWidth}px ${H - c.offsetTop - c.offsetHeight}px ${c.offsetLeft}px round 6px)`;
    },
    rest(c) {
      this.wide = false;
      this.instant(() => this.set([c.offsetLeft, c.offsetTop, c.offsetWidth, c.offsetHeight], "inset(0 round 6px)"));
    },
    move(animate) {
      const c = this.el && $('.chip[aria-pressed="true"]', this.box);
      if (!c) return;
      clearTimeout(this.timer);
      const from = this.cur;
      this.cur = c;
      if (!animate || !from || from === c) { this.rest(c); return; }
      const W = this.box.scrollWidth, H = this.box.scrollHeight;
      if (!this.wide) {
        this.wide = true;
        this.instant(() => this.set([0, 0, W, H], this.clipFor(from, W, H)));
      }
      this.el.style.clipPath = this.clipFor(c, W, H);
      this.timer = setTimeout(() => this.rest(c), 170);
    },
  };

  /* Оффер: старые слова уходят вверх под маску, новые поднимаются по словам. Прерываемо: новый клик отменяет всё и начинает с текущего текста */
  const offer = {
    anims: [], token: 0,
    words(el) { return $$(".m-wi, .o-wi", el); },
    split(el, text) {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((p) => {
        if (!p) return;
        if (!p.trim()) { frag.append(document.createTextNode(p)); return; }
        const w = document.createElement("span"); w.className = "o-w";
        const wi = document.createElement("span"); wi.className = "o-wi"; wi.textContent = p;
        w.append(wi); frag.append(w);
      });
      el.replaceChildren(frag);
    },
    set(d, animate) {
      const title = $("[data-offer-title]"), lead = $("[data-offer-lead]"), cta = $("[data-offer-cta]");
      const fill = () => {
        lead.textContent = d.lead;
        cta.textContent = d.cta[0]; cta.href = d.cta[1];
      };
      if (!animate) { title.textContent = d.title; fill(); return; }
      const tok = ++this.token;
      this.anims.forEach((a) => a.cancel());
      this.anims = [];
      const old = this.words(title);
      const outs = old.map((w, i) => w.animate(
        [{ transform: "none", opacity: 1 }, { transform: "translate3d(0, -105%, 0)", opacity: 0 }],
        { duration: 170, delay: Math.min(i * 12, 80), easing: IN_OUT, fill: "forwards" }
      ));
      outs.push(lead.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" }));
      this.anims.push(...outs);
      Promise.all(outs.map((a) => a.finished)).then(() => {
        if (tok !== this.token) return;
        this.anims.forEach((a) => a.cancel());
        // <1024: сцена над оффером, резерва высоты нет — всё, что под оффером и видно, доезжает до нового места (FLIP)
        const below = desktop.matches ? [] : $$("[data-search], [data-quick], .proof, #path");
        const before = below.map((el) => el.getBoundingClientRect().top);
        this.split(title, d.title);
        fill();
        const vh = window.innerHeight;
        below.forEach((el, i) => {
          const r = el.getBoundingClientRect(), dy = before[i] - r.top;
          if (Math.abs(dy) < 1 || r.top > vh + Math.abs(dy) || r.bottom + Math.abs(dy) < 0) return;
          this.anims.push(el.animate([{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: "none" }], { duration: 560, easing: EXPO }));
        });
        this.anims = this.words(title).map((w, i) => w.animate(
          [{ transform: "translate3d(0, 105%, 0)" }, { transform: "none" }],
          { duration: 680, delay: i * 32, easing: EXPO, fill: "backwards" }
        ));
        this.anims.push(rise(lead, { delay: 160 }), rise(cta, { delay: 240 }));
      }, () => { /* отменено новым кликом */ });
    },
  };

  /* ───── Сцена ───── */
  const stage = {
    el: null, frame: null, edge: null, video: null, play: null, playLabel: null, inView: true, userPaused: false,
    init() {
      this.el = $("[data-scene-stage]");
      if (!this.el) return;
      this.frame = $(".stage__frame", this.el);
      this.video = $("[data-scene-video]", this.el);
      this.play = $("[data-stage-play]", this.el);
      this.playLabel = $("[data-stage-play-label]", this.el);
      this.play.addEventListener("click", () => {
        if (this.video.paused) { this.userPaused = false; this.start(true); }
        else { this.userPaused = true; this.video.pause(); this.syncBtn(); }
      });
      this.video.addEventListener("play", () => this.syncBtn());
      this.video.addEventListener("pause", () => this.syncBtn());
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(([e]) => {
          this.inView = e.isIntersecting;
          if (!this.inView) this.video.pause();
          else if (this.autoAllowed() && this.active === "abiturient" && !this.userPaused) this.start(false);
        }, { threshold: 0.2 }).observe(this.el);
      }
    },
    autoAllowed() { return !reduce.matches && !mobile.matches; },
    load() {
      if (this.video.dataset.loaded) return;
      this.video.src = mobile.matches ? this.video.dataset.srcMobile : this.video.dataset.src;
      this.video.dataset.loaded = "1";
    },
    start(byUser) {
      if (!byUser && !this.autoAllowed()) return;
      this.load();
      this.video.play().catch(() => this.syncBtn());
    },
    syncBtn() {
      const playing = !this.video.paused;
      this.play.setAttribute("aria-pressed", String(playing));
      this.playLabel.textContent = playing ? "Пауза" : "Смотреть видео";
    },
    /* Смена сцены — «монтажная склейка»: новый кадр открывается шторкой со стороны выбранного чипа
       (вперёд по списку — справа, назад — слева), по краю шторки идёт тонкая белая линия; кадр доезжает из 1.12,
       уходящий кадр смещается навстречу и темнеет. Номер кадра щёлкает как табло. */
    show(id, data, index, animate) {
      if (!this.el) return;
      const prevId = this.active;
      this.active = id;
      const scenes = $$(".scene", this.el);
      const next = scenes.find((s) => s.dataset.scene === id);
      const prev = scenes.find((s) => s.dataset.scene === prevId);
      // прерывание: всё, что ещё едет, досказываем мгновенно
      scenes.forEach((s) => s.getAnimations({ subtree: true }).forEach((a) => a.cancel()));
      if (this.edge) this.edge.getAnimations().forEach((a) => a.cancel());
      scenes.forEach((s) => { s.classList.toggle("is-active", s === next); s.classList.remove("is-leaving"); });

      const caption = $("[data-stage-caption]", this.el), note = $("[data-stage-note]", this.el), idx = $("[data-stage-index]", this.el);
      caption.textContent = data.caption;
      note.textContent = data.note;
      idx.textContent = String(index + 1).padStart(2, "0") + " / " + String(IDS.length).padStart(2, "0");

      if (animate && prev && prev !== next) {
        const dir = IDS.indexOf(id) > IDS.indexOf(prevId) ? 1 : -1;
        const W = this.frame.clientWidth;
        prev.classList.add("is-leaving");
        const wipe = next.animate(
          [{ clipPath: dir > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
          { duration: 680, easing: IN_OUT }
        );
        $(".scene__media", next).animate(
          [{ transform: `translate3d(${dir * 5}%, 0, 0) scale(1.12)` }, { transform: "none" }],
          { duration: 1200, easing: EXPO }
        );
        // на тёмном уходящий кадр гаснет глубже — тонет в чернилах, а не сереет
        prev.animate([{ filter: "brightness(1)" }, { filter: "brightness(0.3)" }], { duration: 680, easing: IN_OUT, fill: "forwards" });
        $(".scene__media", prev).animate(
          [{ transform: "none" }, { transform: `translate3d(${-dir * 8}%, 0, 0)` }],
          { duration: 680, easing: IN_OUT, fill: "forwards" }
        );
        if (!this.edge) {
          this.edge = document.createElement("span");
          this.edge.className = "stage__edge";
          this.edge.setAttribute("aria-hidden", "true");
          this.frame.append(this.edge);
        }
        this.edge.animate(
          [{ transform: `translate3d(${dir > 0 ? W : 0}px, 0, 0)`, opacity: 1 }, { transform: `translate3d(${dir > 0 ? 0 : W}px, 0, 0)`, opacity: 1, offset: 0.9 }, { transform: `translate3d(${dir > 0 ? 0 : W}px, 0, 0)`, opacity: 0 }],
          { duration: 680, easing: IN_OUT }
        );
        wipe.finished.then(() => {
          prev.classList.remove("is-leaving");
          prev.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        }, () => {});
        idx.animate([{ transform: "translate3d(0, 55%, 0)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 150, easing: OUT });
        rise(caption, { delay: 200, dist: 8, duration: 560 });
        rise(note, { delay: 380, dist: 8, duration: 560 });
      }

      const isVideo = id === "abiturient";
      this.play.hidden = !isVideo;
      if (isVideo) { if (this.inView && !this.userPaused) this.start(false); }
      else this.video.pause();
      this.syncBtn();
    },
  };

  /* ───── Резерв высоты: hero не прыгает при смене аудитории ─────
     На ≥1024 рамка сцены тянется на всю высоту левой колонки: оффер на строку длиннее — кадр вырастает.
     Колонка оффера держит высоту самого длинного из шести офферов, подпись сцены — самой длинной подписи
     (на всех ширинах: на десктопе она тоже в высоте сцены). Замер — скрытой копией в той же ширине;
     повтор при смене ширины и после загрузки шрифтов. На узких резерв дал бы дыру под кнопкой — там FLIP в offer.set. */
  const reserve = {
    key: "", raf: 0,
    tallest(el, fill) {
      const probe = el.cloneNode(true);
      ["aria-live", "data-m", "id"].forEach((a) => probe.removeAttribute(a));
      probe.querySelectorAll("[id], [data-m]").forEach((n) => { n.removeAttribute("id"); n.removeAttribute("data-m"); });
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = `position:absolute;left:0;top:0;width:${el.getBoundingClientRect().width}px;min-height:0;margin:0;visibility:hidden;pointer-events:none`;
      el.parentElement.append(probe);
      let max = 0;
      IDS.forEach((id) => { fill(probe, AUD[id]); max = Math.max(max, probe.getBoundingClientRect().height); });
      probe.remove();
      return Math.ceil(max);
    },
    run(force) {
      const copy = $(".hero__copy"), cap = $(".stage__caption");
      if (!copy || !cap) return;
      const key = `${copy.clientWidth}:${cap.clientWidth}:${desktop.matches}`;
      if (!force && key === this.key) return;
      this.key = key;
      copy.style.minHeight = desktop.matches ? this.tallest(copy, (p, d) => {
        $("[data-offer-title]", p).textContent = d.title;
        $("[data-offer-lead]", p).textContent = d.lead;
        $("[data-offer-cta]", p).textContent = d.cta[0];
      }) + "px" : "";
      cap.style.minHeight = this.tallest(cap, (p, d) => { $("[data-stage-caption]", p).textContent = d.caption; }) + "px";
    },
    init() {
      this.run(true);
      const later = () => { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.run(false)); };
      if ("ResizeObserver" in window) {
        const ro = new ResizeObserver(later);
        [$(".hero__copy"), $(".stage__caption")].forEach((el) => el && ro.observe(el));
      } else window.addEventListener("resize", later);
      document.fonts?.ready.then(() => this.run(true));
    },
  };

  /* Блоки 4–6 меняют порядок: FLIP только для тех, что видны на экране */
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
      s.animate(
        [{ transform: `translate3d(0, ${dy}px, 0)`, opacity: far ? 0 : 1 }, { transform: "none", opacity: 1 }],
        { duration: far ? 760 : 600, easing: far ? EXPO : IN_OUT }
      );
    });
  }

  /* ───── Применить аудиторию ───── */
  function apply(id, { instant = false } = {}) {
    const d = AUD[id];
    const animate = !instant && motionOn();
    document.body.dataset.audience = id;
    if (instant) document.body.classList.add("is-instant");

    $$("[data-audience-chips] [data-audience]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.audience === id)));
    ink.move(animate);

    offer.set(d, animate);
    const barCta = $("[data-actionbar-cta]");
    if (barCta) { barCta.textContent = d.cta[0]; barCta.href = d.cta[1]; }

    // быстрые действия и шаги пересоздаются с data-m: общий слой проявляет их лесенкой, линия пути рисуется заново
    const quick = $("[data-quick]");
    quick.replaceChildren(...d.quick.map(([t, h, href]) => {
      const li = document.createElement("li");
      li.dataset.m = "up";
      li.dataset.mDelay = instant ? "540" : "280";
      li.innerHTML = `<a class="quick__link" href="${href}"><span class="quick__t"></span><span class="quick__h"></span><span class="icon icon--arrow-right" aria-hidden="true"></span></a>`;
      li.querySelector(".quick__t").textContent = t;
      li.querySelector(".quick__h").textContent = h;
      return li;
    }));

    $("[data-path-for]").textContent = d.pathFor;
    const steps = $("[data-steps]");
    steps.replaceChildren(...d.steps.map(([t, h, href], i) => {
      const li = document.createElement("li");
      li.className = "step";
      li.dataset.m = "up";
      li.innerHTML = `<a class="step__link" href="${href}"><span class="step__n num">${i + 1}</span><span class="step__t"></span><span class="step__h"></span></a>`;
      li.querySelector(".step__t").textContent = t;
      li.querySelector(".step__h").textContent = h;
      return li;
    }));
    if (!instant) { rescan(quick.parentElement); rescan(steps.parentElement); }

    // Порядок блоков 4–6: переставляем узлы, чтобы порядок табуляции совпадал с видимым
    reorderBlocks(d.order, animate);

    stage.show(id, d, IDS.indexOf(id), animate);

    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("is-instant")));
  }

  function initAudience() {
    stage.init();
    ink.init();
    const first = initialAudience();
    apply(first, { instant: true });
    reserve.init();
    $$("[data-audience-chips] [data-audience]").forEach((chip) => chip.addEventListener("click", () => {
      const id = chip.dataset.audience;
      if (document.body.dataset.audience === id) return;
      try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
      apply(id);
      if (mobile.matches) chip.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
    }));
    const pressed = $(`[data-audience-chips] [data-audience="${first}"]`);
    if (pressed && mobile.matches) pressed.parentElement.scrollLeft = Math.max(0, pressed.offsetLeft - 8); // offsetParent — сам ряд чипов (position: relative)
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
    const apply = $("[data-filters-apply]");
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
      apply.textContent = shown ? `Показать ${shown} ${plural(shown, "программу", "программы", "программ")}` : "Нет программ";
      badge.hidden = !active;
      badge.textContent = String(active);
    };
    form.addEventListener("change", run);
    form.addEventListener("reset", () => setTimeout(run));
    form.addEventListener("submit", (e) => e.preventDefault());
    $("[data-filters-reset]")?.addEventListener("click", () => { form.reset(); });

    const onKey = (e) => { if (e.key === "Escape") close(); };
    function open() {
      if (!mobile.matches) return;
      lastFocus = document.activeElement;
      form.setAttribute("role", "dialog");
      form.setAttribute("aria-modal", "true");
      backdrop.hidden = false;
      requestAnimationFrame(() => { form.classList.add("is-open"); backdrop.classList.add("is-open"); });
      form.classList.add("is-open");
      openBtn.setAttribute("aria-expanded", "true");
      document.documentElement.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
      $("select", form).focus({ preventScroll: true });
    }
    function close() {
      form.classList.remove("is-open");
      backdrop.classList.remove("is-open");
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
    apply.addEventListener("click", () => { close(); $("#programs").scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth" }); });
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
      q.toggleAttribute("aria-invalid", !okQ);
      c.toggleAttribute("aria-invalid", !okC);
      if (!okQ) q.setAttribute("aria-invalid", "true");
      if (!okC) c.setAttribute("aria-invalid", "true");
      if (okQ && okC) {
        form.classList.add("is-done");
        msg.className = "field__hint";
        msg.textContent = "Вопрос отправлен. Ответ придёт на указанный контакт.";
      } else {
        msg.className = "field__error";
        msg.textContent = !okQ ? "Напиши вопрос хотя бы в пару слов" : v ? "Нужен e-mail вида name@mail.ru или ник вида @username" : "Впиши e-mail или ник в Telegram";
        (!okQ ? q : c).focus();
      }
    });
    [q, c].forEach((el) => el.addEventListener("input", () => {
      if (el.hasAttribute("aria-invalid")) { el.removeAttribute("aria-invalid"); msg.className = "field__hint"; msg.textContent = base; }
    }));
  }

  /* ───── Липкая панель (390): после главной кнопки hero, не поверх подвала ───── */
  function initActionbar() {
    const bar = $("[data-actionbar]"), hero = $(".hero__cta");
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
    initAudience();
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
