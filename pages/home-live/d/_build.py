# Генератор разметки home-live/d: _icons.json + _template.html → index.html (запуск: python3 _build.py)
import json, html
from pathlib import Path
HERE = Path(__file__).resolve().parent
I = json.load(open(HERE / '_icons.json'))
I['arrow'] = ["M8 24H40M28 12L40 24L28 36", None]
I['arrow-l'] = ["M40 24H8M20 12L8 24L20 36", None]
I['close'] = ["M13 13L35 35M35 13L13 35", None]
I['play'] = ["M17 10.5C17 9 18.6 8.1 19.9 8.9L38 21.5C39.2 22.3 39.2 24 38 24.8L19.9 37.1C18.6 38 17 37 17 35.5Z", None]
I['send'] = ["M42 6L20 28M42 6L28 42L20 28L6 20Z", None]

ROOT = "../../../"
def pg(key, cls="", dot=True):
    d, dt = I[key]
    c = f'<circle cx="{dt[0]}" cy="{dt[1]}" r="3"/>' if (dt and dot) else '<circle cx="24" cy="24" r="3" opacity="0"/>' if dot else ''
    return f'<svg class="pg {cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-pg="{key}"><path d="{d}"/>{c}</svg>'
def ui(key, cls=""):
    d, _ = I[key]
    return f'<svg class="pg pg--ui {cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="{d}"/></svg>'

def mix(c, t=0.2):
    c = c.lstrip('#'); r,g,b = [int(c[i:i+2],16) for i in (0,2,4)]
    return '#%02X%02X%02X' % tuple(round(x*t + 255*(1-t)) for x in (r,g,b))

N = "#0A1329"; W = "#FFFFFF"
# key, full name, short, colour, fg, about, media
F = [
 ("bio","Биологический факультет","Биологический","#46A94F",N,"Для тех, кому интересно, как устроена жизнь: от клетки до леса и пруда в Ботаническом саду.",
   ("photo","video/480/botsad-gashenie-marki-prud-park.jpg","Пруд в парке Ботанического сада")),
 ("hist","Исторический факультет","Исторический","#FE5C2B",N,"Для тех, кто любит источники, находки археологов и спор о том, как всё было на самом деле.",
   ("video","video/480/den-otkrytyh-dverey-2-arheologiya-ruki","День открытых дверей: руки археолога и находка")),
 ("geo","Факультет географии и геоэкологии","География и геоэкология","#1B9DB5",N,"Для тех, кого тянет в экспедиции, к картам и к вопросу, как сберечь природу вокруг.",
   ("photo","photos/800/nature-turisty-na-utese.jpg","Студенты на вершине утёса над долиной")),
 ("lang","Факультет иностранных языков и международной коммуникации","Иностранные языки","#F2708F",N,"Для тех, кто хочет говорить с миром на его языке и понимать людей из других стран.",
   ("photo","photos/800/students-inostrannye-slushayut.jpg","Иностранные студенты слушают выступление")),
 ("cyb","Факультет прикладной математики и кибернетики","Прикладная математика и кибернетика","#2A3DAD",W,"Для тех, кто пишет код, строит модели и хочет понимать, как думают машины.",
   ("stub","фото: студенты ПМиК за работой над проектом, крупно экран с кодом")),
 ("sport","Факультет физической культуры","Физическая культура","#E10447",W,"Для тех, кто живёт в движении и хочет тренировать других.",
   ("photo","photos/800/sport-voleybol-zhenskaya-komanda.jpg","Женская волейбольная команда")),
 ("phil","Филологический факультет","Филологический","#E6AA1F",N,"Для тех, кто читает внимательно и любит, когда каждое слово стоит на своём месте.",
   ("photo","photos/800/students-biblioteka-tablichki.jpg","Студентки в библиотеке с табличками")),
 ("chem","Химико-технологический факультет","Химико-технологический","#34C3A0",N,"Для тех, кому мало формул на бумаге: опыты, лаборатории, новые вещества и материалы.",
   ("photo","photos/800/lab-opyt-nauka-shou.jpg","Химический опыт на научном шоу")),
 ("math","Математический факультет","Математический","#3570C0",W,"Для тех, кто получает удовольствие от красивого доказательства и точной мысли.",
   ("photo","photos/800/portrait-professor-u-doski.jpg","Преподаватель у доски")),
 ("econ","Институт экономики и управления","Экономика и управление","#6545C8",W,"Для тех, кто хочет понимать деньги, рынки и то, как устроена работа команды.",
   ("stub","фото: семинар по экономике, работа в группах")),
 ("law","Юридический факультет","Юридический","#8E1F4E",W,"Для тех, кому важно, чтобы было по правилам и по справедливости.",
   ("stub","фото: учебный судебный процесс в аудитории")),
 ("ped","Институт педагогического образования и социальных технологий","Педагогика и социальные технологии","#A3BE34",N,"Для тех, кто хочет учить, поддерживать и помогать людям расти.",
   ("stub","фото: студенты-практиканты ведут урок в школе")),
 ("psy","Факультет психологии","Психология","#9D7CF2",N,"Для тех, кто хочет понимать себя и других и умеет по-настоящему слушать.",
   ("stub","фото: практическое занятие по психологии, работа в парах")),
 ("phys","Физико-технический факультет","Физико-технический","#64B4EE",N,"Для тех, кто хочет знать, как устроен мир, и проверить это на приборах.",
   ("stub","фото: лабораторная установка физтеха крупным планом")),
 ("ino","Институт непрерывного образования","Непрерывное образование","#FF9A57",N,"Для тех, кто уже учится или работает и хочет новую профессию или квалификацию.",
   ("stub","фото: слушатели курсов повышения квалификации")),
]
FD = {f[0]: f for f in F}
def vars_(k):
    f = FD[k]; return f'--fc:{f[3]};--fc-fg:{f[4]};--fc-tint:{mix(f[3])}'

# shield layout (units: W 472, H 624)
LAYOUT = [
 ("bio",18,58),("math",130,58),("phil",242,58),("lang",354,58),
 ("hist",18,170),("phys",130,170),("law",242,170),("chem",354,170),
 ("psy",18,282),("sport",130,282),("geo",242,282),("econ",354,282),
 ("ped",130,394),("ino",242,394),
 ("cyb",186,506),
]
SHAPE = {"ped":"bl","ino":"br","cyb":"tip","psy":"","econ":""}
def plate():
    return ('<svg class="shield__plate" viewBox="0 0 472 624" aria-hidden="true" focusable="false">'
            '<path class="shield__roof" d="M152 27L180 7H292L320 27Z"/>'
            '<path class="shield__body" d="M4 44H468V370C468 506 332 620 236 620C140 620 4 506 4 370Z"/></svg>')
def shield(mini=False):
    out = [f'<div class="shield{" shield--mini" if mini else ""}"' + (' aria-hidden="true"' if mini else '') + '>', plate()]
    if not mini:
        out.append('<ul class="shield__tiles" role="list">')
    for i,(k,x,y) in enumerate(LAYOUT):
        f = FD[k]
        col = 1 if x==18 else 4 if x==354 else 2
        pos = f'style="{vars_(k)};--x:{x};--y:{y};--i:{i}"'
        shp = SHAPE.get(k,"")
        cls = f'tile{" tile--"+shp if shp else ""}{" tile--edge-l" if x==18 else ""}{" tile--edge-r" if x==354 else ""}'
        if mini:
            out.append(f'<span class="{cls}" data-fac="{k}" {pos}>{pg(k)}</span>')
        else:
            out.append(f'<li class="shield__cell"><button class="{cls}" type="button" data-fac="{k}" data-open="{k}" aria-haspopup="dialog" aria-controls="fac" aria-label="{html.escape(f[1])}" {pos}>{pg(k)}<span class="tile__name" aria-hidden="true">{f[2]}</span></button></li>')
    if not mini: out.append('</ul>')
    out.append('</div>')
    return "\n".join(out)

def media_attr(k):
    m = FD[k][6]
    if m[0]=="photo": return f'data-media="photo" data-src="{ROOT}assets/stub/{m[1]}" data-alt="{html.escape(m[2])}"'
    if m[0]=="video": return f'data-media="video" data-src="{ROOT}assets/stub/{m[1]}" data-alt="{html.escape(m[2])}"'
    return f'data-media="stub" data-alt="{html.escape(m[1])}"'

# ---------- sections ----------
events = [
 ("ped","День открытых дверей","[дата], главный корпус и онлайн"),
 ("hist","Старт приёма документов","с [дата], лично и через Госуслуги"),
 ("lang","Консультация приёмной комиссии","[дата], вопросы в прямом эфире"),
]
ev_html = "\n".join(f'<li><a class="event" href="#" style="{vars_(k)}"><span class="event__dot" aria-hidden="true">{pg(k)}</span><span class="event__t">{t}</span><span class="event__d">{d}</span></a></li>' for k,t,d in events)

chips = [
 ("nature","bio","Природа и живое",["bio","geo","chem"]),
 ("lab","chem","Опыты и лаборатории",["chem","phys","bio"]),
 ("numbers","math","Числа и логика",["math","cyb","econ"]),
 ("code","cyb","Код и роботы",["cyb","math","phys"]),
 ("books","phil","Книги и прошлое",["phil","hist"]),
 ("languages","lang","Языки и страны",["lang","geo"]),
 ("people","psy","Люди и общество",["psy","ped","law"]),
 ("sport","sport","Спорт и движение",["sport","ped"]),
]
chip_html = "\n".join(f'<li><button class="qchip" type="button" aria-pressed="false" data-chip="{c}" data-match="{",".join(m)}" style="{vars_(k)}"><span class="qchip__icon">{pg(k)}</span><span>{t}</span></button></li>' for c,k,t,m in chips)

fac_cards = []
for n,f in enumerate(F):
    k = f[0]
    fac_cards.append(f'''<li class="fcard" data-fac="{k}" style="{vars_(k)}" {media_attr(k)}>
  <span class="fcard__badge" aria-hidden="true">{pg(k)}</span>
  <div class="fcard__body">
    <p class="fcard__num" aria-hidden="true">{n+1:02d}</p>
    <h3 class="fcard__title" data-name>{f[1]}</h3>
    <p class="fcard__about" data-about>{f[5]}</p>
    <p class="fcard__meta"><span>Программ: <b>[N]</b></span><span>Бюджетных мест: <b>[N]</b></span></p>
  </div>
  <button class="fcard__open" type="button" data-open="{k}" aria-haspopup="dialog" aria-controls="fac"><span class="visually-hidden">Открыть: {f[2]}</span>{ui("arrow")}</button>
</li>''')

aud = [
 ("#FE5C2B",N,"a-abit","Абитуриенту",["Программы и направления","Сроки и правила приёма","Общежитие и переезд в Тверь"]),
 ("#2A3DAD",W,"a-stud","Студенту",["Расписание занятий","Электронная библиотека","Стипендии и поддержка"]),
 ("#E6AA1F",N,"a-staff","Сотруднику",["Личный кабинет сотрудника","Документы и приказы","Повышение квалификации"]),
 ("#34C3A0",N,"a-part","Партнёру",["Заказать исследование","Практика и стажировки студентов","Совместные программы"]),
]
aud_html = "\n".join(f'''<li class="aud" style="--fc:{c};--fc-fg:{fg}" data-m="up">
  <div class="aud__head"><h3 class="aud__title">{t}</h3>{pg(ic,"aud__icon")}</div>
  <ul class="aud__links" role="list">{"".join(f'<li><a href="#">{l}{ui("arrow")}</a></li>' for l in links)}</ul>
</li>''' for c,fg,ic,t,links in aud)

dirs = [
 ("IT и математика",["cyb","math","phys"],"Программирование, анализ данных, математическое моделирование."),
 ("Естественные науки",["bio","chem","geo","phys"],"Биология, химия, география, экология и физика."),
 ("Гуманитарные науки",["phil","hist","lang","psy"],"Язык и литература, история, перевод, психология."),
 ("Педагогика",["ped","psy","ino"],"Будущие учителя, социальные педагоги, переподготовка."),
 ("Экономика и право",["econ","law"],"Экономика, управление, юриспруденция."),
 ("Спорт",["sport","ped"],"Физическая культура, тренерская работа, адаптивный спорт."),
]
dirs_html = "\n".join(f'''<li class="dir" style="{vars_(ks[0])}" data-m="up">
  <a class="dir__link" href="#">
    <span class="dir__stack" aria-hidden="true">{"".join(f'<span class="dir__mini" style="{vars_(k)}">{pg(k, dot=False)}</span>' for k in ks)}</span>
    <span class="dir__title">{t}</span>
    <span class="dir__text">{txt}</span>
    <span class="dir__count"><b>[N]</b> программ {ui("arrow")}</span>
  </a>
</li>''' for t,ks,txt in dirs)

news = [
 ("geo","video/480/den-otkrytyh-dverey-2-mikroskop-mineraly.jpg","Посетительница смотрит в микроскоп на минералы","День открытых дверей: минералы под микроскопом","[дата]"),
 ("lang","photos/800/students-inostrannye-u-pamyatnika.jpg","Иностранные студенты у памятника в Твери","Иностранные студенты знакомятся с Тверью","[дата]"),
 ("sport","photos/800/sport-turslet-estafeta.jpg","Эстафета на турслёте в лесу","Турслёт: эстафета факультетов в лесу","[дата]"),
 ("cyb","photos/800/students-za-noutbukom.jpg","Школьники за ноутбуком и карточками на интенсиве","Интенсив для школьников: первые шаги в анализе данных","[дата]"),
]
news_html = "\n".join(f'''<li class="news" style="{vars_(k)}" data-m="up">
  <span class="news__ear">{FD[k][2]}</span>
  <article class="news__card">
    <div class="news__media"><img src="{ROOT}assets/stub/{src}" alt="{alt}" width="800" height="533" decoding="async"></div>
    <div class="news__body">
      <p class="news__date">{date} · пример</p>
      <h3 class="news__title"><a href="#">{t}</a></h3>
    </div>
  </article>
</li>''' for k,src,alt,t,date in news)

people = [
 ("hist","hist","Николай Кун","[годы]","Автор книги «Мифы Древней Греции», которую читают поколения школьников."),
 ("psy","note","Александр Александров","[годы]","Автор гимна России."),
 ("phil","quill","Андрей Дементьев","[годы]","Поэт, чьи стихи стали песнями."),
 ("sport","medal","Наталья Непряева","[годы]","Олимпийская чемпионка."),
]
def stamp(k, ic, name):
    return f'<div class="stamp" style="{vars_(k)}" role="img" aria-label="Иллюстрация-марка: {name}">{pg(ic)}<span class="stamp__tag" aria-hidden="true">портрета нет · марка</span></div>'
hist_items = []
hist_items.append(f'''<li class="hcard">
  <div class="hcard__media"><img src="{ROOT}assets/stub/photos/800/archive-uchenicy-v-klasse.jpg" alt="Архивный снимок: ученицы в классе" width="800" height="614" loading="lazy" decoding="async"></div>
  <p class="hcard__year"><span data-count data-count-from="1700" data-count-dur="1400">1870</span></p>
  <h3 class="hcard__title">Основание</h3><p class="hcard__text">С этого года ведёт свою историю Тверской университет.</p>
</li>''')
for i,(k,ic,name,yrs,txt) in enumerate(people):
    hist_items.append(f'''<li class="hcard">
  {stamp(k,ic,name)}
  <p class="hcard__year">{yrs}</p>
  <h3 class="hcard__title">{name}</h3><p class="hcard__text">{txt}</p>
</li>''')
    if i == 1:
        hist_items.append(f'''<li class="hcard">
  <div class="hcard__media"><img src="{ROOT}assets/stub/photos/800/archive-studenty-frontoviki.jpg" alt="Архивный снимок: студенты-фронтовики" width="672" height="544" loading="lazy" decoding="async"></div>
  <p class="hcard__year">[годы]</p>
  <h3 class="hcard__title">Студенты-фронтовики</h3><p class="hcard__text">Вернулись с войны и сели за парты.</p>
</li>''')
hist_items.append(f'''<li class="hcard hcard--now">
  <div class="hcard__now" aria-hidden="true">{shield(mini=True)}</div>
  <p class="hcard__year"><span data-count data-count-from="2000" data-count-dur="1200">2026</span></p>
  <h3 class="hcard__title">Сегодня</h3><p class="hcard__text">93-е место в России в Round University Ranking и топ-200 Национального агрегированного рейтинга.</p>
</li>''')
hist_html = "\n".join(hist_items)

partners = ["Промышленное предприятие","Школа-партнёр","Зарубежный университет","Научный институт","IT-компания","Банк","Музей","Областная больница","Издательство","Технопарк"]
partners_html = "\n".join(f'<a class="partner" href="#"><span class="partner__logo">лого</span><span class="partner__name">{p} · [название]</span></a>' for p in partners)

faq = [
 ("econ","Сколько бюджетных мест в этом году?","Бюджетных мест в 2026 году: [N] на [N] программах. Число мест по каждой программе будет на её странице и в разделе «Абитуриенту» после публикации контрольных цифр приёма."),
 ("hist","Есть ли общежитие для иногородних?","Места в общежитиях для иногородних студентов: [N]. Как заселиться, сколько стоит проживание ([N] ₽ в месяц) и какие документы нужны, расскажем в разделе «Общежитие и переезд в Тверь»."),
 ("phil","Сколько стоит платное обучение?","Стоимость зависит от программы и формы обучения: от [N] ₽ в год. Есть скидки и рассрочка на [условия]. Точная цена указана на странице программы."),
 ("chem","Какие баллы ЕГЭ нужны для поступления?","Минимальные баллы по предметам: [N]. Проходные баллы прошлых лет по каждой программе: [N]. Их можно сравнить со своими в подборе программ."),
 ("cyb","Можно подать документы через Госуслуги?","Да, заявление подаётся через суперсервис «Поступление в вуз онлайн» на Госуслугах, если программа участвует в нём ([список программ]). Лично и почтой тоже можно, адрес: 170100, Тверь, ул. Желябова, 33."),
 ("ped","Когда день открытых дверей?","Ближайший день открытых дверей: [дата]. Можно прийти в главный корпус или смотреть трансляцию. Регистрация откроется за [N] дней."),
]
faq_html = "\n".join(f'''<details class="accordion__item" name="faq" style="{vars_(k)}">
  <summary class="accordion__summary">{q}</summary>
  <div class="accordion__body"><p>{a}</p></div>
</details>''' for k,q,a in faq)

hero_tiles = shield()

page = open(HERE / '_template.html').read()
for key,val in {
  "{{EVENTS}}": ev_html, "{{SHIELD}}": hero_tiles, "{{SHIELD_MINI}}": shield(mini=True), "{{CHIPS}}": chip_html,
  "{{FACS}}": "\n".join(fac_cards), "{{AUD}}": aud_html, "{{DIRS}}": dirs_html, "{{NEWS}}": news_html,
  "{{HIST}}": hist_html, "{{PARTNERS}}": partners_html, "{{FAQ}}": faq_html,
  "{{LENS}}": pg("bio","lens__pg"), "{{FAC_ICON}}": pg("bio","fac__icon"),
  "{{I_ARROW}}": ui("arrow"), "{{I_ARROW_L}}": ui("arrow-l"), "{{I_CLOSE}}": ui("close"), "{{I_PLAY}}": ui("play"), "{{I_SEND}}": ui("send"),
}.items():
    page = page.replace(key, val)
assert "{{" not in page, page[page.index("{{")-50:page.index("{{")+50]
open(HERE / 'index.html','w').write(page)
print("ok", len(page))
