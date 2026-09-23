/* Медиатека галереи: превью всех заглушек из assets/stub/manifest.json.
   Подключение: <section id="media-library"></section> + <script src="media-library.js" defer></script>
   Самодостаточный: сам вставляет стили, фильтр по тегу, пометку hero-кандидата, видео по наведению. */
(function () {
  "use strict";
  var MANIFEST = "assets/stub/manifest.json";
  var TAG_RU = {
    campus: "кампус", building: "здания", students: "студенты", lecture: "учёба", lab: "лаборатория",
    sport: "спорт", event: "мероприятия", "people-portrait": "портреты", city: "город", nature: "природа",
    ceremony: "церемонии", dance: "танец", archive: "архив", dorm: "общежитие"
  };

  function css() {
    if (document.getElementById("ml-style")) return;
    var s = document.createElement("style");
    s.id = "ml-style";
    s.textContent = [
      ".ml{font:15px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;color:#111}",
      ".ml__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;margin:0 0 16px}",
      ".ml__title{font-size:28px;font-weight:700;margin:0}",
      ".ml__count{color:#555}",
      ".ml__filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}",
      ".ml__chip{min-height:44px;padding:0 14px;border:1px solid #D9DEE6;border-radius:6px;background:#fff;color:#111;font:inherit;cursor:pointer}",
      ".ml__chip[aria-pressed=true]{background:#2A3DAD;border-color:#2A3DAD;color:#fff}",
      ".ml__chip:focus-visible,.ml__card a:focus-visible{outline:3px solid #E10447;outline-offset:2px}",
      ".ml__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}",
      ".ml__card{margin:0;border:1px solid #D9DEE6;border-radius:6px;overflow:hidden;background:#fff;display:flex;flex-direction:column}",
      ".ml__media{position:relative;aspect-ratio:4/3;background:#F3F5F8}",
      ".ml__media img,.ml__media video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}",
      ".ml__media video{opacity:0;transition:opacity .2s}",
      ".ml__card.is-playing video{opacity:1}",
      ".ml__badge{position:absolute;top:8px;left:8px;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;background:#E10447;color:#fff}",
      ".ml__badge--video{left:auto;right:8px;background:#101A4D}",
      ".ml__cap{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}",
      ".ml__what{margin:0;font-size:14px}",
      ".ml__path{margin:0;font:12px/1.3 ui-monospace,Menlo,monospace;color:#555;word-break:break-all}",
      ".ml__tags{display:flex;flex-wrap:wrap;gap:4px}",
      ".ml__tag{font-size:12px;padding:1px 6px;border-radius:4px;background:#F3F5F8;color:#333}",
      ".ml__empty{padding:40px;text-align:center;color:#555;border:1px dashed #D9DEE6;border-radius:6px}",
      "@media (prefers-reduced-motion:reduce){.ml__media video{display:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(it) {
    var fig = el("figure", "ml__card");
    fig.dataset.tags = it.tags.join(" ");
    fig.dataset.kind = it.kind;
    if (it.hero_candidate) fig.dataset.hero = "1";
    var media = el("div", "ml__media");
    var a = document.createElement("a");
    a.href = it.file;
    a.target = "_blank";
    a.rel = "noopener";
    var img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = it.kind === "video" ? it.poster_480 || it.poster : it.file_800 || it.file;
    img.alt = it.what || it.alt || "";
    a.appendChild(img);
    media.appendChild(a);
    if (it.hero_candidate) media.appendChild(el("span", "ml__badge", "hero-кандидат"));
    if (it.kind === "video") {
      media.appendChild(el("span", "ml__badge ml__badge--video",
        "видео " + it.loop_duration_s + " с · " + (it.tone === "dark" ? "тёмный" : "светлый")));
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
      v.setAttribute("aria-hidden", "true");
      v.src = it.file_480 || it.file;
      media.appendChild(v);
      var play = function () {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        fig.classList.add("is-playing");
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      };
      var stop = function () { fig.classList.remove("is-playing"); v.pause(); };
      fig.addEventListener("mouseenter", play);
      fig.addEventListener("mouseleave", stop);
      fig.addEventListener("focusin", play);
      fig.addEventListener("focusout", stop);
    }
    fig.appendChild(media);
    var cap = el("figcaption", "ml__cap");
    cap.appendChild(el("p", "ml__what", it.what || it.alt || ""));
    var meta = it.kind === "video"
      ? it.file + " · " + it.size_kb + " КБ (480: " + it.file_480 + ", " + it.size_480_kb + " КБ)"
      : it.file + " · " + it.width + "×" + it.height + (it.tone === "dark" ? " · тёмный" : "");
    cap.appendChild(el("p", "ml__path", meta));
    var tags = el("div", "ml__tags");
    it.tags.forEach(function (t) { tags.appendChild(el("span", "ml__tag", TAG_RU[t] || t)); });
    cap.appendChild(tags);
    fig.appendChild(cap);
    return fig;
  }

  function render(root, data) {
    var items = (data.photos || []).map(function (p) { p.kind = "photo"; return p; })
      .concat((data.videos || []).map(function (v) { v.kind = "video"; return v; }));
    root.textContent = "";
    var wrap = el("div", "ml");
    var head = el("div", "ml__head");
    head.appendChild(el("h2", "ml__title", "Медиатека"));
    var count = el("span", "ml__count");
    head.appendChild(count);
    wrap.appendChild(head);

    var counts = {};
    items.forEach(function (it) { it.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var filters = el("div", "ml__filters");
    filters.setAttribute("role", "toolbar");
    filters.setAttribute("aria-label", "Фильтр медиатеки");
    var state = { f: "all" };
    var defs = [["all", "все", items.length],
      ["hero", "hero-кандидаты", items.filter(function (i) { return i.hero_candidate; }).length],
      ["video", "видео", items.filter(function (i) { return i.kind === "video"; }).length]]
      .concat(Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })
        .map(function (t) { return ["tag:" + t, TAG_RU[t] || t, counts[t]]; }));
    var chips = defs.map(function (d) {
      var b = el("button", "ml__chip", d[1] + " · " + d[2]);
      b.type = "button";
      b.dataset.f = d[0];
      b.setAttribute("aria-pressed", d[0] === "all" ? "true" : "false");
      b.addEventListener("click", function () { state.f = d[0]; apply(); });
      filters.appendChild(b);
      return b;
    });
    wrap.appendChild(filters);

    var grid = el("div", "ml__grid");
    var cards = items.map(function (it) { var c = card(it); grid.appendChild(c); return c; });
    var empty = el("p", "ml__empty", "Ничего не найдено по этому фильтру");
    empty.hidden = true;
    wrap.appendChild(grid);
    wrap.appendChild(empty);
    root.appendChild(wrap);

    function apply() {
      var n = 0;
      cards.forEach(function (c) {
        var f = state.f, ok = f === "all" ||
          (f === "hero" && c.dataset.hero === "1") ||
          (f === "video" && c.dataset.kind === "video") ||
          (f.indexOf("tag:") === 0 && (" " + c.dataset.tags + " ").indexOf(" " + f.slice(4) + " ") >= 0);
        c.hidden = !ok;
        if (ok) n++;
      });
      chips.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.f === state.f ? "true" : "false"); });
      count.textContent = n + " из " + items.length + " (фото " + (data.photos || []).length +
        ", видео " + (data.videos || []).length + ") — только заглушки с водяным знаком";
      empty.hidden = n > 0;
    }
    apply();
  }

  function init() {
    var root = document.getElementById("media-library");
    if (!root) { root = document.createElement("section"); root.id = "media-library"; document.body.appendChild(root); }
    css();
    root.textContent = "Загрузка медиатеки…";
    fetch(MANIFEST).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) { render(root, d); })
      .catch(function (e) { root.textContent = "Медиатека недоступна: " + MANIFEST + " (" + e.message + ")"; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
