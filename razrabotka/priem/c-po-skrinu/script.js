/* priem/c-po-skrinu: календарь (день → его события), вкладки ленты новостей, лесенка ромбов. */
(function () {
  "use strict";

  /* ромбы появляются по очереди */
  document.querySelectorAll("[data-rhombs] .r").forEach(function (r, i) { r.style.setProperty("--i", String(i)); });

  /* календарь: нажатый день оставляет в списке только свои события; повторное нажатие или «Показать все» — все */
  var cal = document.querySelector("[data-cal]");
  if (cal) {
    var days = Array.prototype.slice.call(cal.querySelectorAll("button[data-day]"));
    var items = Array.prototype.slice.call(cal.querySelectorAll(".c-cal__list li"));
    var title = cal.querySelector("[data-cal-title]");
    var reset = cal.querySelector("[data-cal-reset]");
    var pick = function (d) {
      days.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.day === d)); });
      items.forEach(function (li) { li.hidden = !!d && li.dataset.day !== d; });
      title.textContent = d ? d + " сентября" : "Все события месяца";
      reset.hidden = !d;
    };
    days.forEach(function (b) {
      b.addEventListener("click", function () { pick(b.getAttribute("aria-pressed") === "true" ? "" : b.dataset.day); });
    });
    reset.addEventListener("click", function () { pick(""); });
  }

  /* вкладки ленты новостей */
  var tabs = document.querySelector("[data-tabs-news]");
  var news = document.querySelector("[data-news]");
  if (tabs && news) {
    var buttons = Array.prototype.slice.call(tabs.querySelectorAll("button"));
    var cards = Array.prototype.slice.call(news.querySelectorAll("[data-cat]"));
    var list = news.querySelector(".c-mag__list");
    var empty = document.querySelector("[data-news-empty]");
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.dataset.filter, shown = 0;
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        cards.forEach(function (c) {
          var on = f === "all" || c.dataset.cat === f;
          c.hidden = !on;
          if (on) shown++;
        });
        if (list) list.hidden = !list.querySelector("li:not([hidden])");
        if (empty) empty.hidden = shown > 0;
      });
    });
  }
})();
