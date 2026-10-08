/* Fair Share Simulator · Next Wave
   A deliberation tool: tenants try fairness rules on six household types
   before they vote. Every number comes from the assumptions listed on the page.
   No dependencies, no server. */
(function () {
  'use strict';

  /* ---------------- Assumptions (all editable here) ---------------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Approximate monthly yield of a south-facing roof in Rome, kWh per kWp (illustrative, ~1,500 kWh/kWp per year)
  var YIELD = [75, 90, 125, 140, 160, 170, 180, 165, 135, 110, 80, 70];
  // Approximate sunrise and sunset in Rome, local clock time (hours)
  var SUN = [[7.6, 17.0], [7.2, 17.6], [6.5, 18.2], [6.6, 19.8], [5.9, 20.3], [5.6, 20.8], [5.8, 20.7], [6.3, 20.2], [6.9, 19.3], [7.5, 18.4], [7.0, 16.9], [7.5, 16.7]];
  var HOUSEHOLDS_PER_TYPE = 10;   // the complex: 60 households, 10 of each type
  var ARERA = 8;                  // € per MWh of shared energy, approx. (grid benefit refund)
  var ZONE_CENTRE = 4;            // € per MWh, photovoltaic correction for Lazio
  var TIP_BASE = 80, TIP_CAP = 120; // plants up to 200 kW (DM 414/2023)

  // Six fictional household types. profile = relative use per hour (0..23)
  var P = [
    { id: 'rosa', name: 'Rosa', who: 'Pensioner, 78, lives alone', size: 1, low: true, kwh: 4.5, flex: 0.2,
      story: 'Home all day; cooks at lunchtime.', data: 'Uses energy through the day, so she already helps share solar energy.',
      profile: [1, 1, 1, 1, 1, 1, 2, 4, 4, 3, 3, 4, 5, 3, 2, 2, 2, 3, 4, 4, 3, 3, 2, 1] },
    { id: 'karim', name: 'Karim', who: 'Night-shift worker, family of 3', size: 3, low: false, kwh: 7, flex: 0.05,
      story: 'Works nights and sleeps until early afternoon.', data: 'Almost never at home awake when the sun is strongest.',
      profile: [2, 1, 1, 1, 1, 2, 3, 2, 1, 1, 1, 1, 1, 1, 3, 4, 4, 4, 5, 5, 4, 3, 2, 2] },
    { id: 'bianchi', name: 'The Bianchis', who: 'Large family of 6', size: 6, low: true, kwh: 13, flex: 0.25,
      story: 'One parent at home; busy mornings and evenings.', data: 'Uses a lot of energy, much of it in the evening.',
      profile: [2, 1, 1, 1, 1, 1, 4, 6, 4, 3, 3, 4, 6, 5, 3, 3, 3, 4, 6, 7, 7, 6, 4, 3] },
    { id: 'elena', name: 'Elena', who: 'Single parent, 2 children', size: 3, low: true, kwh: 7.5, flex: 0.1,
      story: 'Works 8 to 17; laundry and cooking after work.', data: 'Most of her use is after sunset.',
      profile: [1, 1, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 6, 7, 6, 5, 3, 2] },
    { id: 'mario', name: 'Mario & Lucia', who: 'Retired couple', size: 2, low: false, kwh: 8.5, flex: 0.5,
      story: 'Run the washing machine and dishwasher at midday on timers.', data: 'Very flexible: easy to move use into sunny hours.',
      profile: [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 3, 4, 4, 3, 2, 2, 1] },
    { id: 'luca', name: 'Luca', who: 'Remote worker, 29, lives alone', size: 1, low: false, kwh: 5.5, flex: 0.3,
      story: 'Works from home on a laptop.', data: 'Steady daytime use.',
      profile: [1, 1, 1, 1, 1, 1, 1, 2, 4, 4, 4, 4, 5, 4, 4, 4, 4, 3, 4, 5, 4, 3, 2, 1] }
  ];
  P.forEach(function (p) {
    var s = p.profile.reduce(function (a, b) { return a + b; }, 0);
    p.hourly = p.profile.map(function (v) { return v / s * p.kwh; });
    p.need = p.size + (p.low ? 2 : 0);
  });

  var PARTS = [
    { key: 'floor', label: 'Floor', color: 'var(--s-floor)' },
    { key: 'equal', label: 'Equal', color: 'var(--s-equal)' },
    { key: 'need', label: 'Need', color: 'var(--s-need)' },
    { key: 'effort', label: 'Effort', color: 'var(--s-effort)' }
  ];

  var PRESETS = {
    dev: { equal: 0, need: 0, effort: 100, floor: 0 },
    equal: { equal: 100, need: 0, effort: 0, floor: 0 },
    mix: { equal: 30, need: 30, effort: 40, floor: 50 }
  };

  /* ---------------- Model ---------------- */
  function solarDay(month, kwp) {
    var sr = SUN[month][0], ss = SUN[month][1];
    var shape = [];
    for (var h = 0; h < 24; h++) {
      var mid = h + 0.5, x = (mid - sr) / (ss - sr);
      shape.push(x > 0 && x < 1 ? Math.pow(Math.sin(Math.PI * x), 1.3) : 0);
    }
    var sum = shape.reduce(function (a, b) { return a + b; }, 0);
    var daily = YIELD[month] * kwp / DAYS_IN[month];
    return shape.map(function (v) { return v / sum * daily; });
  }

  // When effort is rewarded, flexible households move part of their evening use to midday
  function shiftedHourly(p, effortShare) {
    var h = p.hourly.slice();
    var moveFrac = p.flex * effortShare * 0.3;
    if (moveFrac <= 0) return h;
    var moved = 0;
    for (var i = 17; i <= 22; i++) { var m = h[i] * moveFrac; h[i] -= m; moved += m; }
    for (var j = 10; j <= 14; j++) h[j] += moved / 5;
    return h;
  }

  function tariff(pz) {
    return Math.min(TIP_CAP, TIP_BASE + Math.max(0, 180 - pz)) + ZONE_CENTRE + ARERA;
  }

  function simulateMonth(s, month) {
    var w = weights(s);
    var solar = solarDay(month, s.kwp);
    var hh = P.map(function (p) { return shiftedHourly(p, s.respond ? w.effort : 0); });
    var demand = [], shared = [], effortDay = P.map(function () { return 0; });
    for (var h = 0; h < 24; h++) {
      var d = 0;
      hh.forEach(function (x) { d += x[h] * HOUSEHOLDS_PER_TYPE; });
      var sh = Math.min(solar[h], d);
      demand.push(d); shared.push(sh);
      // each household's part of the shared energy, in proportion to its use that hour
      if (d > 0) hh.forEach(function (x, i) { effortDay[i] += sh * x[h] / d; });
    }
    var days = DAYS_IN[month];
    var sharedMWh = shared.reduce(function (a, b) { return a + b; }, 0) * days / 1000;
    var gross = sharedMWh * tariff(s.pz);
    var pot = gross * (1 - s.fund / 100);
    var N = P.length * HOUSEHOLDS_PER_TYPE;
    var floorEach = Math.min(pot / N, (s.floor / 100) * pot / N);
    var rest = pot - floorEach * N;
    var needTot = 0, effTot = 0;
    P.forEach(function (p, i) { needTot += p.need * HOUSEHOLDS_PER_TYPE; effTot += effortDay[i] * HOUSEHOLDS_PER_TYPE; });
    var res = P.map(function (p, i) {
      var parts = {
        floor: floorEach,
        equal: rest * w.equal / N,
        need: needTot ? rest * w.need * p.need / needTot : 0,
        effort: effTot ? rest * w.effort * effortDay[i] / effTot : 0
      };
      return { p: p, parts: parts, total: parts.floor + parts.equal + parts.need + parts.effort, sunKwh: effortDay[i] * days };
    });
    return { solar: solar, demand: demand, shared: shared, sharedMWh: sharedMWh, gross: gross, pot: pot, res: res, tariff: tariff(s.pz), N: N };
  }

  function weights(s) {
    var t = s.equal + s.need + s.effort;
    if (t <= 0) return { equal: 1, need: 0, effort: 0 };
    return { equal: s.equal / t, need: s.need / t, effort: s.effort / t };
  }

  function simulateYear(s) {
    var tot = P.map(function () { return 0; }), pot = 0, mwh = 0;
    for (var m = 0; m < 12; m++) {
      var r = simulateMonth(s, m);
      r.res.forEach(function (x, i) { tot[i] += x.total; });
      pot += r.pot; mwh += r.sharedMWh;
    }
    return { tot: tot, pot: pot, mwh: mwh };
  }

  /* ---------------- UI helpers ---------------- */
  var $ = function (sel) { return document.querySelector(sel); };
  var eur = function (v, d) { return '€' + v.toLocaleString('en-GB', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }); };
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var tip = null;
  function showTip(evt, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'sim-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.hidden = false;
    var x = evt.clientX + 14, y = evt.clientY + 14;
    var r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  /* ---------------- State ---------------- */
  var state = { month: 6, kwp: 100, pz: 110, fund: 10, equal: 30, need: 30, effort: 40, floor: 50, respond: true, sel: 0 };

  function read() {
    state.month = +$('#s-month').value;
    state.kwp = +$('#s-kwp').value;
    state.pz = +$('#s-pz').value;
    state.fund = +$('#s-fund').value;
    state.equal = +$('#s-equal').value;
    state.need = +$('#s-need').value;
    state.effort = +$('#s-effort').value;
    state.floor = +$('#s-floor').value;
    state.respond = $('#s-respond').checked;
  }
  function write() {
    ['month', 'kwp', 'pz', 'fund', 'equal', 'need', 'effort', 'floor'].forEach(function (k) { $('#s-' + k).value = state[k]; });
    $('#s-respond').checked = state.respond;
  }

  /* ---------------- Render: outputs ---------------- */
  function render() {
    var r = simulateMonth(state, state.month);
    var y = simulateYear(state);
    var base = simulateMonth(Object.assign({}, state, PRESETS.equal, { respond: false }), state.month);
    var w = weights(state);

    // slider readouts
    $('#o-kwp').textContent = state.kwp + ' kWp';
    $('#o-pz').textContent = state.pz + ' €/MWh';
    $('#o-fund').textContent = state.fund + '%';
    $('#o-floor').textContent = state.floor + '% of an equal share';
    $('#o-equal').textContent = Math.round(w.equal * 100) + '%';
    $('#o-need').textContent = Math.round(w.need * 100) + '%';
    $('#o-effort').textContent = Math.round(w.effort * 100) + '%';

    // headline numbers
    $('#k-month').textContent = MONTHS[state.month];
    $('#k-shared').textContent = (r.sharedMWh * 1000).toLocaleString('en-GB', { maximumFractionDigits: 0 }) + ' kWh';
    $('#k-pot').textContent = eur(r.pot, 0);
    $('#k-year').textContent = eur(y.pot, 0);
    $('#k-tariff').textContent = r.tariff.toFixed(0) + ' €/MWh';
    $('#k-avg').textContent = eur(r.pot / r.N);

    // privacy chips
    $('#pv-need').classList.toggle('on', w.need > 0);
    $('#pv-effort').classList.toggle('on', w.effort > 0);
    $('#pv-none').classList.toggle('on', w.need === 0 && w.effort === 0);

    // active preset
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      var p = PRESETS[b.getAttribute('data-preset')];
      var on = p.floor === state.floor && Math.abs(weights(p).equal - w.equal) < 1e-9 && Math.abs(weights(p).need - w.need) < 1e-9 && Math.abs(weights(p).effort - w.effort) < 1e-9;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    drawDay(r);
    drawShares(r, base, y);
    drawWhy(r, base, y);
    drawTable(r, base, y);
  }

  /* Day chart: solar production vs community use, one average day */
  function drawDay(r) {
    var svg = $('#day-chart'); svg.innerHTML = '';
    var W = Math.round(Math.max(320, Math.min(720, svg.getBoundingClientRect().width || 720))), H = W < 500 ? 220 : 260, L = 40, R = 26, T = 14, B = 30;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var max = Math.max.apply(null, r.solar.concat(r.demand)) * 1.1 || 1;
    var step = niceStep(max);
    max = Math.ceil(max / step) * step;
    var x = function (h) { return L + (W - L - R) * h / 24; };
    var yv = function (v) { return T + (H - T - B) * (1 - v / max); };
    for (var g = 0; g <= max + 1e-9; g += step) {
      el('line', { x1: L, x2: W - R, y1: yv(g), y2: yv(g), class: g === 0 ? 'axis' : 'grid' }, svg);
      var t = el('text', { x: L - 8, y: yv(g) + 4, 'text-anchor': 'end', class: 'tick' }, svg); t.textContent = g;
    }
    [0, 6, 12, 18, 24].forEach(function (h) {
      var t = el('text', { x: x(h), y: H - 8, 'text-anchor': 'middle', class: 'tick' }, svg); t.textContent = (h < 10 ? '0' : '') + h + ':00';
    });
    function path(arr, close) {
      var d = '';
      arr.forEach(function (v, h) { d += (h ? 'L' : 'M') + x(h + 0.5).toFixed(1) + ' ' + yv(v).toFixed(1); });
      if (close) d += 'L' + x(23.5) + ' ' + yv(0) + 'L' + x(0.5) + ' ' + yv(0) + 'Z';
      return d;
    }
    el('path', { d: path(r.shared, true), class: 'a-shared' }, svg);
    el('path', { d: path(r.solar), class: 'l-solar' }, svg);
    el('path', { d: path(r.demand), class: 'l-demand' }, svg);
    var cross = el('line', { y1: T, y2: H - B, class: 'cross', visibility: 'hidden' }, svg);
    var hit = el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }, svg);
    function move(e) {
      var pt = svg.getBoundingClientRect();
      var hx = (e.clientX - pt.left) / pt.width * W;
      var h = Math.max(0, Math.min(23, Math.floor((hx - L) / (W - L - R) * 24)));
      cross.setAttribute('x1', x(h + 0.5)); cross.setAttribute('x2', x(h + 0.5)); cross.setAttribute('visibility', 'visible');
      showTip(e, '<b>' + h + ':00 to ' + (h + 1) + ':00</b><br><span class="sw sw-solar"></span>Solar: ' + r.solar[h].toFixed(1) + ' kW' +
        '<br><span class="sw sw-demand"></span>Use (60 homes): ' + r.demand[h].toFixed(1) + ' kW' +
        '<br><span class="sw sw-shared"></span>Shared: ' + r.shared[h].toFixed(1) + ' kW');
    }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchstart', function (e) { move(e.touches[0]); }, { passive: true });
    hit.addEventListener('mouseleave', function () { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }
  function niceStep(max) {
    var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /* Shares chart: one stacked bar per household type */
  function drawShares(r, base, y) {
    var box = $('#shares'); box.innerHTML = '';
    var max = Math.max.apply(null, r.res.map(function (x) { return x.total; }).concat(base.res.map(function (x) { return x.total; }))) || 1;
    r.res.forEach(function (x, i) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'share-row' + (i === state.sel ? ' sel' : '');
      row.setAttribute('aria-label', x.p.name + ': ' + eur(x.total) + ' per month. Show why.');
      var diff = x.total - base.res[i].total;
      var diffTxt = Math.abs(diff) < 0.005 ? 'same as equal split' : (diff > 0 ? '+' : '−') + eur(Math.abs(diff)) + ' vs equal';
      row.innerHTML = '<span class="sr-name"><b>' + x.p.name + '</b><small>' + x.p.who + '</small></span>' +
        '<span class="sr-bar"></span>' +
        '<span class="sr-val"><b>' + eur(x.total) + '</b><small class="' + (diff > 0.005 ? 'up' : diff < -0.005 ? 'down' : '') + '">' + diffTxt + '</small></span>';
      var bar = row.querySelector('.sr-bar');
      var marker = document.createElement('span');
      marker.className = 'sr-base';
      marker.style.left = (base.res[i].total / max * 100) + '%';
      marker.title = 'Equal split: ' + eur(base.res[i].total);
      PARTS.forEach(function (part) {
        var v = x.parts[part.key];
        if (v <= 0.0001) return;
        var seg = document.createElement('span');
        seg.className = 'seg';
        seg.style.width = (v / max * 100) + '%';
        seg.style.background = part.color;
        seg.addEventListener('mousemove', function (e) { showTip(e, '<b>' + x.p.name + '</b><br><span class="sw" style="background:' + part.color + '"></span>' + part.label + ' part: ' + eur(v)); });
        seg.addEventListener('mouseleave', hideTip);
        bar.appendChild(seg);
      });
      bar.appendChild(marker);
      row.addEventListener('click', function () { state.sel = i; render(); });
      box.appendChild(row);
    });
  }

  function drawWhy(r, base, y) {
    var x = r.res[state.sel], p = x.p, w = weights(state);
    var lines = [];
    if (x.parts.floor > 0) lines.push(['floor', eur(x.parts.floor), 'guaranteed to every household, whatever the mix (' + state.floor + '% of an equal share).']);
    if (x.parts.equal > 0) lines.push(['equal', eur(x.parts.equal), 'the same for every household.']);
    if (x.parts.need > 0) lines.push(['need', eur(x.parts.need), 'need points: ' + p.need + ' (' + p.size + (p.size === 1 ? ' person' : ' people') + (p.low ? ', +2 for low income' : '') + ').']);
    if (x.parts.effort > 0) lines.push(['effort', eur(x.parts.effort), 'used ' + x.sunKwh.toFixed(0) + ' kWh of shared solar energy this month. ' + p.data]);
    var html = '<div class="why-head"><div><h3>' + p.name + '</h3><p>' + p.who + '. ' + p.story + '</p></div>' +
      '<div class="why-total"><b>' + eur(x.total) + '</b><small>this month · about ' + eur(y.tot[state.sel], 0) + ' a year</small></div></div><ul class="why-list">';
    lines.forEach(function (l) {
      html += '<li><span class="sw sw-' + l[0] + '"></span><span><b>' + l[1] + ' ' + l[0] + ' part:</b> ' + l[2] + '</span></li>';
    });
    html += '</ul>';
    var diff = x.total - base.res[state.sel].total;
    html += '<p class="why-cmp">Under an equal split ' + p.name + ' would get ' + eur(base.res[state.sel].total) + '. ' +
      (Math.abs(diff) < 0.005 ? 'This mix gives the same.' : 'This mix gives ' + eur(Math.abs(diff)) + (diff > 0 ? ' more.' : ' less.')) + '</p>';
    $('#why').innerHTML = html;
  }

  function drawTable(r, base, y) {
    var rows = r.res.map(function (x, i) {
      return '<tr><td><b>' + x.p.name + '</b></td><td>' + eur(x.parts.floor) + '</td><td>' + eur(x.parts.equal) + '</td><td>' + eur(x.parts.need) + '</td><td>' + eur(x.parts.effort) +
        '</td><td><b>' + eur(x.total) + '</b></td><td>' + eur(base.res[i].total) + '</td><td>' + eur(y.tot[i], 0) + '</td></tr>';
    }).join('');
    $('#share-table').innerHTML = '<table><tr><th>Household</th><th>Floor</th><th>Equal</th><th>Need</th><th>Effort</th><th>Total / month</th><th>Equal split</th><th>Per year</th></tr>' + rows + '</table>';
  }

  /* ---------------- Paper cards ---------------- */
  function drawCards() {
    $('#cards').innerHTML = P.map(function (p) {
      var sunShare = p.hourly.slice(9, 16).reduce(function (a, b) { return a + b; }, 0) / p.kwh;
      return '<article class="pcard"><h3>' + p.name + '</h3><p class="pc-who">' + p.who + '</p><p>' + p.story + '</p>' +
        '<dl><dt>Daily use</dt><dd>' + p.kwh + ' kWh</dd><dt>Used 9:00–16:00</dt><dd>' + Math.round(sunShare * 100) + '%</dd>' +
        '<dt>Need points</dt><dd>' + p.need + '</dd><dt>Low income</dt><dd>' + (p.low ? 'Yes' : 'No') + '</dd></dl></article>';
    }).join('');
  }

  /* ---------------- Wire up ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var ms = $('#s-month');
    MONTHS.forEach(function (m, i) { var o = document.createElement('option'); o.value = i; o.textContent = m; ms.appendChild(o); });
    write();
    document.querySelectorAll('.sim input, .sim select').forEach(function (inp) {
      inp.addEventListener('input', function () { read(); render(); });
    });
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { Object.assign(state, PRESETS[b.getAttribute('data-preset')]); write(); render(); });
    });
    var tbtn = $('#toggle-table');
    tbtn.addEventListener('click', function () {
      var t = $('#share-table'); t.hidden = !t.hidden;
      tbtn.textContent = t.hidden ? 'Show as table' : 'Hide table';
    });
    $('#print').addEventListener('click', function () { window.print(); });
    drawCards();
    render();
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 150); });
  });
})();
