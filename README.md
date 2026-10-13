# Next Wave · Hybrid Participation Innovation Lab

Project site for team **Next Wave** (Tor Vergata, 2026): an AI energy assistant for a solar energy community, designed with its tenants.

The live site has a timeline of every class deadline. Each date opens its slides (viewable and presentable in the browser), the original articles, the written deliverables, a study guide and a checklist.

## How it is built

Plain HTML, CSS and JavaScript, no framework and no server. A small Python script turns the sources into the site.

```
src/
  schedule.json      dates, titles, materials and checklists
  study/<date>.md    study guide for each date
  documents/*.md     deliverables A, C, D, G
  decks/<deck>/      slides (one HTML <section> per slide) + deck.json
  papers/            original articles (CC BY 4.0)
  assets/            style.css, app.js, slides.js, images
build.py             builds the site into docs/
docs/                the published site (GitHub Pages serves this folder)
```

## Slide downloads (PDF and PowerPoint)

Each deck can be downloaded as a PDF and a PowerPoint file, slides only (no speaker notes).
The slides are rendered exactly as on the site; the PowerPoint holds one full-size picture per slide.
After changing any slides, regenerate them (needs Playwright with Chromium and python-pptx):

```
python3 export_slides.py
```

## Update the site

```
pip install markdown
python3 build.py
git add -A && git commit -m "Update site" && git push
```

GitHub Pages republishes within a minute or two.
