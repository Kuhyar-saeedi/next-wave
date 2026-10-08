/* Site behaviour: theme toggle, live countdowns and "next up", saved checklists. */
(function () {
  'use strict';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  /* Theme toggle: system by default, remembered per browser */
  var saved = store('nw-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function utc(iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }
  var now = new Date();
  var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  function rel(iso) {
    var n = Math.round((utc(iso) - today) / 864e5);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n > 1 && n < 14) return 'In ' + n + ' days';
    if (n >= 14) return 'In ' + Math.round(n / 7) + ' weeks';
    if (n === -1) return 'Yesterday';
    return 'Done';
  }
  function nice(iso) {
    var d = new Date(utc(iso));
    return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }

  document.addEventListener('DOMContentLoaded', function () {
    var tb = document.querySelector('.theme-toggle');
    if (tb) {
      var label = function () { tb.textContent = isDark() ? 'Light mode' : 'Dark mode'; };
      label();
      tb.addEventListener('click', function () {
        var next = isDark() ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        store('nw-theme', next);
        label();
      });
    }

    /* Timeline status */
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-date]'));
    var nextEl = null;
    items.forEach(function (el) {
      var iso = el.getAttribute('data-date');
      var w = el.querySelector('.when');
      if (w) w.textContent = rel(iso);
      if (utc(iso) < today) el.classList.add('is-past');
      else if (!nextEl && el.classList.contains('tl-item')) { nextEl = el; el.classList.add('is-next'); }
    });

    /* "Next up" banner on the home page */
    var nu = document.querySelector('.nextup');
    if (nu) {
      if (nextEl) {
        var iso = nextEl.getAttribute('data-date');
        var d = new Date(utc(iso));
        nu.href = nextEl.querySelector('a').getAttribute('href');
        nu.querySelector('.mo').textContent = MONTHS[d.getUTCMonth()];
        nu.querySelector('.dd').textContent = d.getUTCDate();
        nu.querySelector('.what').textContent = nextEl.querySelector('.tl-title').textContent;
        nu.querySelector('.countdown').textContent = nice(iso) + ' · ' + rel(iso).toLowerCase();
      } else {
        nu.querySelector('.label').textContent = 'Course complete';
        nu.querySelector('.what').textContent = 'All deadlines have passed';
      }
    }

    /* Date page countdown chip */
    var dc = document.querySelector('[data-countdown]');
    if (dc) dc.textContent = rel(dc.getAttribute('data-countdown'));

    /* Checklists: ticks saved in this browser only */
    document.querySelectorAll('.checklist input[type=checkbox]').forEach(function (cb) {
      var key = 'nw-check-' + cb.id;
      if (store(key) === '1') cb.checked = true;
      cb.addEventListener('change', function () { store(key, cb.checked ? '1' : '0'); });
    });
  });
})();
