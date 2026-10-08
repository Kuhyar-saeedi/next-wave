#!/usr/bin/env python3
"""Build the Next Wave project site.

Sources live in src/, the finished static site is written to docs/
(GitHub Pages serves that folder). Run:  python3 build.py
Requires: Python 3.9+ and the 'markdown' package (pip install markdown).
"""
import html
import json
import re
import shutil
from datetime import date
from pathlib import Path

import markdown

ROOT = Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "docs"

TEAM = "Mahsa Shahi · Kuhyar Saeedi · Farida Safdari · Gelila Tsehaye Melesse · Md Nazmul Islam · Pranto Argha Sarker"
SITE = "Next Wave"
COURSE = "Hybrid Participation Innovation Lab · Tor Vergata · 2026"
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Small UI icons (24x24, stroke = currentColor)
I = {
    "slides": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    "paper": '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    "doc": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    "soon": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "play": '<path d="m6 3 14 9-14 9z"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "sim": '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
}


def icon(name):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + "</svg>")


def esc(s):
    return html.escape(s, quote=True)


def d_parts(iso):
    d = date.fromisoformat(iso)
    return d, MONTHS[d.month - 1], DAYS[d.weekday()]


def nice(iso):
    d, mo, dow = d_parts(iso)
    return f"{dow} {d.day} {mo}"


# ---------------------------------------------------------------- data
schedule = json.loads((SRC / "schedule.json").read_text())
DECK_DIR = SRC / "decks"
decks = {}
slide_files = {}
for ddir in sorted(DECK_DIR.iterdir()):
    meta = json.loads((ddir / "deck.json").read_text())
    decks[ddir.name] = meta
    for f in (ddir / "slides").glob("*.html"):
        slide_files.setdefault(f.stem, f)

DOCS = {}
for f in sorted((SRC / "documents").glob("*.md")):
    raw = f.read_text()
    fm, body = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S).groups()
    meta = dict(line.split(": ", 1) for line in fm.splitlines())
    meta["body"] = body
    DOCS[f.stem] = meta

DECK_LABEL = {
    "art1": "Article 1 slides", "art2": "Article 2 slides", "art3": "Article 3 slides",
    "full": "Full project deck", "pitch": "Final pitch",
}
for i in range(1, 11):
    DECK_LABEL[f"step{i}"] = f"Step {i} slides"


def deck_title(key):
    t = decks[key]["title"]
    return t.replace("Next Wave — ", "")


# Which date each deck belongs to (for back links)
deck_dates = {}
for item in schedule:
    for m in item["materials"]:
        if m["type"] == "slides":
            deck_dates.setdefault(m["deck"], item)
doc_dates = {}
for item in schedule:
    for m in item["materials"]:
        if m["type"] == "doc":
            doc_dates[m["doc"]] = item


def md(text):
    out = markdown.markdown(text, extensions=["tables", "sane_lists"])
    out = out.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    # "### Q: question" followed by a paragraph becomes a fold-out practice question
    out = re.sub(r"<h3>Q: (.*?)</h3>\s*<p>(.*?)</p>",
                 r'<details class="q"><summary>\1</summary><div>\2</div></details>', out, flags=re.S)
    out = out.replace('<a href="http', '<a target="_blank" rel="noopener" href="http')
    return out


# ---------------------------------------------------------------- layout
BRAND = ('<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="14" r="6.5" fill="#E8A33D"/>'
         '<path d="M3 23c3.5-3 6.5-3 10 0s6.5 3 10 0 4.5-2 6-1" stroke="#F7F5EF" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>')

SUN_ARC = """<svg class="sun-arc" viewBox="0 0 420 280" aria-hidden="true">
  <path d="M30 250 A185 205 0 0 1 400 250" fill="none" stroke="#F7F5EF" stroke-opacity=".22" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
  <g fill="#F7F5EF" fill-opacity=".35"><circle cx="58" cy="160" r="3"/><circle cx="108" cy="92" r="3"/><circle cx="215" cy="46" r="3"/><circle cx="372" cy="160" r="3"/></g>
  <circle cx="318" cy="88" r="46" fill="#E8A33D" fill-opacity=".14"/>
  <circle cx="318" cy="88" r="26" fill="#E8A33D"/>
  <path d="M10 250 H410" stroke="#F7F5EF" stroke-opacity=".18" stroke-width="2"/>
  <g fill="#2E6F95" fill-opacity=".55"><path d="M120 250 l14-22 h46 l-14 22z"/><path d="M190 250 l14-22 h46 l-14 22z"/><path d="M260 250 l14-22 h46 l-14 22z"/></g>
</svg>"""


def page(title, body, depth, mast, active=""):
    r = "../" * depth
    nav = [("index.html", "Timeline"), ("project.html", "Whole project")]
    cur = ' aria-current="page"'
    links = "".join(
        f'<a href="{r}{h}"{cur if active == h else ""}>{t}</a>' for h, t in nav)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>{esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,{BRAND_FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400..700&display=swap">
<link rel="stylesheet" href="{r}assets/style.css">
<script src="{r}assets/app.js"></script>
</head>
<body>
<header class="mast">
  {SUN_ARC}
  <div class="wrap">
    <div class="topbar">
      <a class="brand" href="{r}index.html">{BRAND}<span>{SITE}</span></a>
      <nav class="topnav" aria-label="Main">{links}<button type="button" class="theme-toggle">Dark mode</button></nav>
    </div>
    {mast}
  </div>
</header>
{body}
<footer><div class="wrap"><span>{SITE} · {COURSE}</span><span>Articles shared under their CC BY 4.0 licences.</span></div></footer>
</body>
</html>
"""


BRAND_FAVICON = ("%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2314213D'/%3E"
                 "%3Ccircle cx='16' cy='14' r='6.5' fill='%23E8A33D'/%3E%3Cpath d='M3 23c3.5-3 6.5-3 10 0s6.5 3 10 0 4.5-2 6-1' "
                 "stroke='%23F7F5EF' stroke-width='2.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")


def page_head(crumb_href, crumb, title, sub="", chips=""):
    return f"""<div class="page-head">
      <a class="crumb" href="{crumb_href}">&larr; {esc(crumb)}</a>
      <h1>{esc(title)}</h1>
      {f'<p class="sub">{esc(sub)}</p>' if sub else ''}
      {f'<div class="meta-row">{chips}</div>' if chips else ''}
    </div>"""


def cal(iso):
    d, mo, _ = d_parts(iso)
    return f'<div class="cal" aria-hidden="true"><div class="mo">{mo}</div><div class="dd">{d.day}</div></div>'


# ---------------------------------------------------------------- material cards
def material_card(m, depth):
    r = "../" * depth
    t = m["type"]
    if t == "slides":
        n = len(decks[m["deck"]]["order"])
        return (f'<a class="card" href="{r}decks/{m["deck"]}.html"><span class="kind">{icon("slides")}Slides · {n}</span>'
                f'<h3>{esc(deck_title(m["deck"]))}</h3><p>{esc(m.get("note", ""))}</p></a>')
    if t == "paper":
        return (f'<a class="card" href="{r}papers/{m["file"]}" target="_blank" rel="noopener"><span class="kind">{icon("paper")}Article PDF</span>'
                f'<h3>{esc(m["title"])}</h3><p>{esc(m.get("note", ""))}</p></a>')
    if t == "doc":
        d = DOCS[m["doc"]]
        return (f'<a class="card" href="{r}documents/{m["doc"]}.html"><span class="kind">{icon("doc")}Deliverable {d["code"]}</span>'
                f'<h3>{esc(d["short"])}</h3><p>Written document, readable online</p></a>')
    if t == "soon":
        return (f'<div class="card soon"><span class="kind">{icon("soon")}Coming soon</span>'
                f'<h3>{esc(m["title"])}</h3><p>{esc(m.get("note", ""))}</p></div>')
    raise ValueError(t)


def tag_list(item):
    tags = []
    for m in item["materials"]:
        if m["type"] == "slides":
            tags.append(DECK_LABEL[m["deck"]])
        elif m["type"] == "paper":
            tags.append("Article PDF")
        elif m["type"] == "doc":
            tags.append(f'Deliverable {DOCS[m["doc"]]["code"]}')
        elif m["type"] == "soon":
            tags.append(m["title"] + " (soon)")
    return "".join(f'<span class="tag">{esc(t)}</span>' for t in tags)


# ---------------------------------------------------------------- pages
def build_index():
    items = []
    for it in schedule:
        items.append(f"""<li class="tl-item" data-date="{it['date']}">
  {cal(it['date'])}
  <a class="tl-card" href="dates/{it['date']}.html">
    <div class="tl-top"><span class="tl-title">{esc(it['title'])}</span><span class="when">{nice(it['date'])}</span></div>
    <p class="tl-sub">{esc(it['summary'])}</p>
    <div class="tags">{tag_list(it)}</div>
  </a>
</li>""")
    mast = f"""<div class="hero">
      <p class="eyebrow">{COURSE}</p>
      <h1>Fair Share: an AI energy assistant designed with its tenants</h1>
      <p>Our group project for a solar energy community in Tor Bella Monaca, Rome. Click a date to open everything due that day: slides, articles, documents, a study guide and a checklist.</p>
      <p class="team">{TEAM}</p>
    </div>"""
    body = f"""<main>
  <div class="wrap">
    <a class="nextup" href="#timeline">
      <div class="cal"><div class="mo">—</div><div class="dd">—</div></div>
      <div><div class="label">Next up</div><div class="what">Loading…</div></div>
      <div class="countdown"></div>
    </a>

    <section id="timeline" style="margin-top:40px">
      <div class="sec-head"><h2 class="sec-title">Timeline</h2><p class="sec-note">Every class deadline from the noticeboard, in order.</p></div>
      <ol class="timeline">{''.join(items)}</ol>
    </section>

    <section>
      <div class="sec-head"><h2 class="sec-title">Quick links</h2></div>
      <div class="grid">
        <a class="card" href="project.html"><span class="kind">{icon("arrow")}Overview</span><h3>The whole project</h3><p>Deliverables A to H, the professor's questions, and how we are graded.</p></a>
        <a class="card" href="decks/full.html"><span class="kind">{icon("slides")}Slides · {len(decks['full']['order'])}</span><h3>Full project deck</h3><p>All ten steps in one deck.</p></a>
        <a class="card" href="decks/pitch.html"><span class="kind">{icon("play")}Slides · {len(decks['pitch']['order'])}</span><h3>Final pitch</h3><p>The 10-minute presentation for 9 December.</p></a>
        <div class="card soon"><span class="kind">{icon("sim")}Coming soon</span><h3>Fair Share Simulator</h3><p>The interactive prototype (deliverable F).</p></div>
      </div>
    </section>
  </div>
</main>"""
    return page("Next Wave · Project", body, 0, mast, "index.html")


def build_date(i, it):
    iso = it["date"]
    study = (SRC / "study" / f"{iso}.md").read_text()
    checks = "".join(
        f'<li><label><input type="checkbox" id="c-{iso}-{n}"><span>{esc(c)}</span></label></li>'
        for n, c in enumerate(it["checklist"]))
    asks = ""
    if it.get("asks"):
        asks = ('<section><div class="sec-head"><h2 class="sec-title">What the professor asks</h2>'
                '<p class="sec-note">From the project brief.</p></div><div class="study"><div class="prose"><ul>'
                + "".join(f"<li>{esc(a)}</li>" for a in it["asks"]) + "</ul></div></div></section>")
    prev_l = next_l = ""
    if i > 0:
        p = schedule[i - 1]
        prev_l = f'<a class="btn" href="{p["date"]}.html">&larr; {nice(p["date"])}</a>'
    if i < len(schedule) - 1:
        n = schedule[i + 1]
        next_l = f'<a class="btn" href="{n["date"]}.html">{nice(n["date"])} &rarr;</a>'
    chips = (f'<span class="chip sun">{nice(iso)}</span><span class="chip" data-countdown="{iso}"></span>'
             f'<span class="chip">{esc(it["kind"])}</span>')
    mast = page_head("../index.html", "Timeline", it["title"], it["summary"], chips)
    body = f"""<main>
  <div class="wrap">
    <section>
      <div class="sec-head"><h2 class="sec-title">Materials</h2><p class="sec-note">Everything for this date. Slides open in the browser; press Present for full screen.</p></div>
      <div class="grid">{''.join(material_card(m, 1) for m in it['materials'])}</div>
    </section>
    <section>
      <div class="sec-head"><h2 class="sec-title">What to do</h2></div>
      <ul class="checklist">{checks}</ul>
      <p class="check-note">Ticks are saved in your own browser only.</p>
    </section>
    {asks}
    <section>
      <div class="sec-head"><h2 class="sec-title">Study guide</h2></div>
      <div class="study"><div class="prose">{md(study)}</div></div>
    </section>
    <section><div class="deck-tools" style="justify-content:space-between">{prev_l}<span></span>{next_l}</div></section>
  </div>
</main>"""
    return page(f"{nice(iso)} · {it['title']}", body, 1, mast)


def build_deck(key):
    meta = decks[key]
    order = meta["order"]
    slides = []
    for n, sid in enumerate(order):
        own = DECK_DIR / key / "slides" / f"{sid}.html"
        raw = (own if own.exists() else slide_files[sid]).read_text()
        m = re.search(r"<aside>(.*?)</aside>", raw, re.S)
        notes = m.group(1).strip() if m else ""
        sec = re.sub(r"\s*<aside>.*?</aside>", "", raw, flags=re.S).strip()
        slides.append(f"""<div class="slide" id="s{n + 1}">
  <div class="slide-num"><span>{n + 1} / {len(order)}</span><button type="button" data-present="{n}">Present from here</button></div>
  <div class="slide-frame">{sec}</div>
  {f'<p class="notes">{notes}</p>' if notes else ''}
</div>""")
    back = deck_dates.get(key)
    crumb_href, crumb = ("../index.html", "Timeline") if not back or key in ("full",) else (f"../dates/{back['date']}.html", f"{nice(back['date'])} · {back['title']}")
    if key == "full":
        crumb_href, crumb = "../project.html", "Whole project"
    chips = f'<span class="chip sun">{len(order)} slides</span>'
    if back and key != "full":
        chips += f'<span class="chip">{nice(back["date"])}</span>'
    mast = page_head(crumb_href, crumb, deck_title(key), "", chips)
    body = f"""<main>
  <div class="wrap">
    <div class="deck-tools">
      <button type="button" class="btn primary" data-present="0">{icon("play")}Present</button>
      <span class="sec-note" style="margin:0">Arrow keys to move, Esc to exit, N for notes.</span>
    </div>
    <div class="deck">{''.join(slides)}</div>
  </div>
</main>
<script src="../assets/slides.js"></script>"""
    return page(deck_title(key), body, 1, mast)


def build_doc(key):
    d = DOCS[key]
    back = doc_dates.get(key)
    crumb_href, crumb = (f"../dates/{back['date']}.html", f"{nice(back['date'])} · {back['title']}") if back else ("../project.html", "Whole project")
    mast = page_head(crumb_href, crumb, d["title"], "", f'<span class="chip sun">Deliverable {d["code"]}</span>')
    body_md = re.sub(r"^# .*\n", "", d["body"], count=1)
    body = f"""<main><div class="wrap"><article class="doc-card"><div class="prose">{md(body_md)}</div></article></div></main>"""
    return page(d["title"], body, 1, mast)


QUESTIONS = [
    ("Who defined the problem?", "At first the developers did. In Step 3 we rewrote it with the voices on our stakeholder map, and at Gate 1 tenants choose which issues are co-designed first. The listening phase confirms or corrects our assumptions."),
    ("Who is missing from your process?", "Usually women carers, young people, shift workers, migrants, tenants without a contract and neighbours outside the community. Step 9 names how we reach each one: doorstep visits, mediators, evening and weekend slots, childcare, ambassadors and trusted third-sector groups."),
    ("What can participants really change?", "The fairness rule, the data charter, whether the assistant advises or automates, its channels, and whether the pilot continues. These are four binding gates that developers sign in advance."),
    ("Why did you choose these methods?", "Each performs a task: interviews explore, Open Space opens the agenda, the lottery assembly and fishbowl deliberate, World Café generates ideas, citizen science produces knowledge, the living lab tests. The Open Space, World Café, fishbowl sequence was tested in REGACE (Article 1)."),
    ("What happens if stakeholders disagree with the developers?", "The gate decision binds: the provider adapts or the pilot pauses. Disagreements are logged publicly, explored in a fishbowl and tested with data, and an external mediator is called before any override."),
    ("How does citizen-generated knowledge enter a decision?", "Data, then a data evening where tenants and researchers interpret it, then a written proposal, then an answer from the assembly or provider within a month, recorded in a public change log."),
    ("What would count as evidence that participation worked?", "At least one design element changed and is traced to tenants; the assembly mirrored the complex; vulnerable households were not worse off than under the default; tenants can explain the rule; a group keeps monitoring after the pilot."),
]


def build_project():
    deliv = [
        ("A", "Context Brief", "2 pages: technology, context, benefits, uncertainties", '<a href="documents/a.html">Read online</a>', "2026-10-14"),
        ("B", "Ecosystem Map", "Actors, knowledge, interests, power, vulnerabilities, missing voices", '<a href="decks/step2.html#s8">Step 2 slides, map</a>', "2026-10-14"),
        ("C", "Participation Blueprint", "5–7 pages: objectives, phases, methods, inclusion, decision points", '<a href="documents/c.html">Read online</a>', "2026-11-04"),
        ("D", "Citizen Science", "2 pages: questions, roles, data, interpretation, ethics, feedback", '<a href="documents/d.html">Read online</a>', "2026-11-18"),
        ("E", "Journey Map", "Visual sequence of online and on-site participation", '<a href="decks/step6.html#s5">Step 6 slides, journey</a>', "2026-11-04"),
        ("F", "Prototype", "One concrete participatory tool", 'Fair Share Simulator (coming soon)', "2026-11-24"),
        ("G", "Evaluation", "1–2 pages: indicators and before/after logic", '<a href="documents/g.html">Read online</a>', "2026-12-09"),
        ("H", "Final Pitch", "10-minute presentation plus critical questions", '<a href="decks/pitch.html">Pitch slides</a>', "2026-12-09"),
    ]
    rows = "".join(
        f'<tr><td class="mono" style="color:var(--accent);font-weight:600">{c}</td><td><b>{esc(n)}</b><br><span style="color:var(--muted)">{esc(desc)}</span></td>'
        f'<td>{link}</td><td class="mono" style="white-space:nowrap">{nice(dd)}</td></tr>'
        for c, n, desc, link, dd in deliv)
    qs = "".join(f'<details class="q"><summary>{esc(q)}</summary><div>{esc(a)}</div></details>' for q, a in QUESTIONS)
    grading = [("30%", "Participation Blueprint and theoretical coherence"), ("15%", "Stakeholder, vulnerability and knowledge analysis"),
               ("15%", "Citizen science integration"), ("15%", "Hybrid method design and feasibility"),
               ("10%", "Prototype / participation tool"), ("10%", "Final pitch and answers to critical questions"), ("5%", "Evaluation framework")]
    grade_rows = "".join(f'<tr><td class="mono" style="font-weight:600">{w}</td><td>{esc(t)}</td></tr>' for w, t in grading)
    mast = page_head("index.html", "Timeline", "The whole project",
                     "One question runs through everything: what will be different because people participated?",
                     '<span class="chip sun">Deliverables A–H</span>')
    body = f"""<main><div class="wrap">
  <section>
    <div class="grid">
      <a class="card" href="decks/full.html"><span class="kind">{icon("slides")}Slides · {len(decks['full']['order'])}</span><h3>Full project deck</h3><p>All ten steps in order, with a divider per step.</p></a>
      <a class="card" href="decks/pitch.html"><span class="kind">{icon("play")}Slides · {len(decks['pitch']['order'])}</span><h3>Final pitch</h3><p>10 minutes, following the professor's structure. Timing in the speaker notes.</p></a>
    </div>
  </section>
  <section>
    <div class="sec-head"><h2 class="sec-title">Deliverables</h2><p class="sec-note">What the professor asks for, and where each one lives.</p></div>
    <div class="table-wrap"><table><tr><th>Code</th><th>Deliverable</th><th>Where</th><th>Due</th></tr>{rows}</table></div>
  </section>
  <section>
    <div class="sec-head"><h2 class="sec-title">The professor's seven questions</h2><p class="sec-note">He will ask these during the presentation. Open each one to see our answer.</p></div>
    <div class="study">{qs}</div>
  </section>
  <section>
    <div class="sec-head"><h2 class="sec-title">How we are graded</h2></div>
    <div class="table-wrap"><table><tr><th>Weight</th><th>Criterion</th></tr>{grade_rows}</table></div>
  </section>
</div></main>"""
    return page("Next Wave · Whole project", body, 0, mast, "project.html")


# ---------------------------------------------------------------- write
def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "dates").mkdir(parents=True)
    (OUT / "decks").mkdir()
    (OUT / "documents").mkdir()
    shutil.copytree(SRC / "assets", OUT / "assets")
    shutil.copytree(SRC / "papers", OUT / "papers")
    (OUT / "index.html").write_text(build_index())
    (OUT / "project.html").write_text(build_project())
    for i, it in enumerate(schedule):
        (OUT / "dates" / f"{it['date']}.html").write_text(build_date(i, it))
    for key in decks:
        (OUT / "decks" / f"{key}.html").write_text(build_deck(key))
    for key in DOCS:
        (OUT / "documents" / f"{key}.html").write_text(build_doc(key))
    (OUT / ".nojekyll").write_text("")
    n = sum(1 for _ in OUT.rglob("*.html"))
    print(f"Built {n} pages into {OUT}")


if __name__ == "__main__":
    main()
