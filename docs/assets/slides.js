/* Slide renderer for Next Wave decks.
   Each slide is a 1920x1080 <section> authored in the Slides format.
   This file scales slides to fit, draws <x-icon> and <x-connector>,
   and provides a full-screen "Present" mode. No dependencies. */
(function () {
  'use strict';
  var W = 1920, H = 1080, NS = 'http://www.w3.org/2000/svg';

  /* ---- Icons (24x24 stroke icons, drawn in currentColor) ---- */
  var ICONS = {
    Activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    Book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    Chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    Chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    Check: '<path d="M20 6 9 17l-5-5"/>',
    CheckCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    Clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    Cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    Globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    GraduationCap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    Key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    Lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    Lightning: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    Link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    Lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    PaperPlane: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    Settings: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    Star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    Tool: '<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>',
    Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    Verified: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    Warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    Wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
  };
  window.NW_ICONS = ICONS;

  function drawIcons(root) {
    root.querySelectorAll('x-icon').forEach(function (el) {
      if (el.firstChild) return;
      var body = ICONS[el.getAttribute('name')] || ICONS.Star;
      el.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    });
  }

  /* ---- Connectors ---- */
  function connStyle(el) {
    var cs = el.style;
    var w = parseFloat(cs.borderWidth || cs.borderTopWidth) || 2;
    var style = (cs.borderStyle || '').split(' ')[0];
    var dash = style === 'dashed' ? (w * 3) + ' ' + (w * 2) : style === 'dotted' ? '0.1 ' + (w * 2) : '';
    return { color: cs.color || 'currentColor', w: w, dash: dash, cap: style === 'dotted' ? 'round' : 'butt' };
  }
  function line(svg, x1, y1, x2, y2, s, head) {
    var hl = Math.max(14, s.w * 3.5), hw = hl * 0.6;
    var ang = Math.atan2(y2 - y1, x2 - x1), ca = Math.cos(ang), sa = Math.sin(ang);
    var hasEnd = head === 'end' || head === 'both', hasStart = head === 'both';
    var ax1 = x1 + (hasStart ? ca * hl * 0.8 : 0), ay1 = y1 + (hasStart ? sa * hl * 0.8 : 0);
    var ax2 = x2 - (hasEnd ? ca * hl * 0.8 : 0), ay2 = y2 - (hasEnd ? sa * hl * 0.8 : 0);
    var p = document.createElementNS(NS, 'line');
    p.setAttribute('x1', ax1); p.setAttribute('y1', ay1); p.setAttribute('x2', ax2); p.setAttribute('y2', ay2);
    p.setAttribute('stroke', s.color); p.setAttribute('stroke-width', s.w); p.setAttribute('stroke-linecap', s.cap);
    if (s.dash) p.setAttribute('stroke-dasharray', s.dash);
    svg.appendChild(p);
    function arrow(tx, ty, a) {
      var c = Math.cos(a), sn = Math.sin(a);
      var bx = tx - c * hl, by = ty - sn * hl;
      var t = document.createElementNS(NS, 'polygon');
      t.setAttribute('points', tx + ',' + ty + ' ' + (bx - sn * hw) + ',' + (by + c * hw) + ' ' + (bx + sn * hw) + ',' + (by - c * hw));
      t.setAttribute('fill', s.color);
      svg.appendChild(t);
    }
    if (hasEnd) arrow(x2, y2, ang);
    if (hasStart) arrow(x1, y1, ang + Math.PI);
  }
  function drawConnectors(root) {
    root.querySelectorAll('x-connector').forEach(function (el) {
      if (el.dataset.drawn) return;
      el.dataset.drawn = '1';
      var s = connStyle(el), head = el.getAttribute('head') || 'end';
      if (el.hasAttribute('x1')) {
        /* Pinned connector in its parent's coordinates */
        var parent = el.parentElement;
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'xc-layer');
        svg.setAttribute('width', parent.offsetWidth || W);
        svg.setAttribute('height', parent.offsetHeight || H);
        line(svg, +el.getAttribute('x1'), +el.getAttribute('y1'), +el.getAttribute('x2'), +el.getAttribute('y2'), s, head);
        el.replaceWith(svg);
      } else {
        /* Flow connector: a straight arrow across its own box */
        var w = parseFloat(el.style.width) || 64, h = Math.max(s.w * 6, 24);
        var box = document.createElementNS(NS, 'svg');
        box.setAttribute('width', w); box.setAttribute('height', h);
        box.setAttribute('style', el.getAttribute('style') + ';overflow:visible;flex:none;border:none');
        line(box, 0, h / 2, w, h / 2, s, head);
        el.replaceWith(box);
      }
    });
  }

  /* ---- Scaling ---- */
  function fit(frame) {
    var sec = frame.querySelector('section');
    if (!sec) return;
    var r = frame.getBoundingClientRect();
    var k = Math.min(r.width / W, r.height / H);
    sec.style.transform = 'translate(' + ((r.width - W * k) / 2) + 'px,' + ((r.height - H * k) / 2) + 'px) scale(' + k + ')';
  }
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (es) { es.forEach(function (e) { fit(e.target); }); }) : null;
  function prepare(frame) {
    drawIcons(frame);
    drawConnectors(frame);
    fit(frame);
    if (ro) ro.observe(frame); else window.addEventListener('resize', function () { fit(frame); });
  }
  window.NW_prepareSlides = function (root) { (root || document).querySelectorAll('.slide-frame').forEach(prepare); };

  /* ---- Present mode ---- */
  function present(start) {
    var frames = Array.prototype.slice.call(document.querySelectorAll('.deck .slide-frame'));
    if (!frames.length) return;
    var i = Math.max(0, Math.min(start || 0, frames.length - 1));
    var stage = document.createElement('div');
    stage.className = 'present';
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-label', 'Presentation');
    stage.innerHTML = '<div class="present-frame slide-frame"></div>' +
      '<div class="present-bar"><button type="button" class="pb-prev" aria-label="Previous slide">&#8592;</button>' +
      '<span class="pb-count"></span><button type="button" class="pb-next" aria-label="Next slide">&#8594;</button>' +
      '<button type="button" class="pb-notes">Notes</button><button type="button" class="pb-close">Close (Esc)</button></div>' +
      '<div class="present-notes" hidden></div>';
    document.body.appendChild(stage);
    document.body.classList.add('is-presenting');
    var pf = stage.querySelector('.present-frame'), count = stage.querySelector('.pb-count'), notes = stage.querySelector('.present-notes');
    function show(n) {
      i = Math.max(0, Math.min(n, frames.length - 1));
      pf.innerHTML = '';
      var clone = frames[i].querySelector('section').cloneNode(true);
      clone.style.transform = '';
      pf.appendChild(clone);
      fit(pf);
      count.textContent = (i + 1) + ' / ' + frames.length;
      var n2 = frames[i].parentElement.querySelector('.notes');
      notes.textContent = n2 ? n2.textContent : '';
    }
    function close() {
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onResize);
      stage.remove();
      document.body.classList.remove('is-presenting');
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      var target = frames[i].closest('.slide');
      if (target) target.scrollIntoView({ block: 'center' });
    }
    function key(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
      else if (e.key === 'Escape') close();
      else if (e.key === 'n') notes.hidden = !notes.hidden;
    }
    function onResize() { fit(pf); }
    stage.querySelector('.pb-prev').onclick = function () { show(i - 1); };
    stage.querySelector('.pb-next').onclick = function () { show(i + 1); };
    stage.querySelector('.pb-close').onclick = close;
    stage.querySelector('.pb-notes').onclick = function () { notes.hidden = !notes.hidden; };
    pf.addEventListener('click', function (e) { show(e.clientX > window.innerWidth / 3 ? i + 1 : i - 1); });
    var sx = null;
    pf.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    pf.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1); sx = null; });
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onResize);
    if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
    show(i);
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.NW_prepareSlides();
    document.querySelectorAll('[data-present]').forEach(function (b) {
      b.addEventListener('click', function () { present(+b.getAttribute('data-present') || 0); });
    });
  });
})();
