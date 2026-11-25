/* YoRHa Terminal -- calendar, weekly schedule, their alerts and the desktop agenda.
   QUESTS > CALENDAR and QUESTS > WEEKLY SCHEDULE keep entries on this PC; the wallpaper properties can add
   more as text. Wallpaper Engine forwards no keys to a wallpaper, so titles are typed on an on-screen
   keyboard (a real keyboard works too wherever keys arrive, such as a browser preview).
   Code stays ASCII: letters outside ASCII are written as \u escapes. */
(function () {
  'use strict';

  window.YoRHaPlanner = function (api) {
    const I18N = window.YoRHaI18N;
    const T = (k, v) => I18N.t(k, v);
    const K = (k) => k;
    const $ = (id) => document.getElementById(id);
    const cfg = api.cfg, store = api.store, setText = api.setText, nav = api.nav;
    const pad = (n) => String(n).padStart(2, '0');
    const HOUR = 3600000, DAY = 86400000;
    const MAX_TITLE = 48;
    const ALLDAY_AT = 9 * 60; // all-day entries are announced at 09:00
    const SNOOZE = 10 * 60000;

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    // ---------- dates ----------

    const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    function parseKey(k) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || '');
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    const midnight = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const atOf = (d, mins) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, mins).getTime(); // DST-safe
    const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
    function minsOf(s) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
      return m ? +m[1] * 60 + +m[2] : -1;
    }
    const hmOf = (mins) => (mins >= 1440 ? '24:00' : pad(Math.floor(mins / 60)) + ':' + pad(mins % 60));
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const DOW = [K('SUN'), K('MON'), K('TUE'), K('WED'), K('THU'), K('FRI'), K('SAT')];
    // A time of day in the user's 12/24 h style; 24:00 stays 24:00 on a 24 h clock.
    const hm = (mins) => (mins >= 1440 && cfg.clock24 ? '24:00' : api.timeHM(new Date(2000, 0, 1, 0, mins)));
    const shortDay = (d) => T('{wd} {day} {mon}', { wd: T(DOW[d.getDay()]), day: pad(d.getDate()), mon: T(api.MONTHS_SHORT[d.getMonth()]) });
    const longDay = (d) => T('{weekday}  {day} {month} {year}', { weekday: T(api.DAYS[d.getDay()]), day: pad(d.getDate()), month: T(api.MONTHS[d.getMonth()]), year: d.getFullYear() });

    // Month headings use the standalone month name from Intl (Russian has a separate form for dates).
    function monthTitle(y, m) {
      try {
        return new Intl.DateTimeFormat(I18N.html, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)).toUpperCase();
      } catch (e) {
        return T('{month} {year}', { month: T(api.MONTHS[m]), year: y });
      }
    }

    // First day of the week: the property, else the locale's own week (Intl), else Monday (Sunday for a few locales).
    function weekStart() {
      if (cfg.weekStart === 'monday') return 1;
      if (cfg.weekStart === 'sunday') return 0;
      if (cfg.weekStart === 'saturday') return 6;
      const lang = navigator.language || 'en-US';
      try {
        const loc = new Intl.Locale(lang);
        const wi = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
        if (wi && wi.firstDay) return wi.firstDay % 7; // Intl: 1 = Monday ... 7 = Sunday
      } catch (e) { /* older engine */ }
      return /^(en-us|en-ca|ja|ko|zh-tw|pt-br|he)/i.test(lang) ? 0 : 1;
    }

    // ---------- entries ----------
    // Calendar entry: { id, title, date: 'YYYY-MM-DD', time: 'HH:MM' or '' (all day), rep: none|week|month|year,
    //   rem: minutes before (0 = at the time, -1 = no alert) }.
    // Schedule activity: { id, title, days: [0..6] (0 = Sunday), start: 'HH:MM', end: 'HH:MM' (24:00 allowed;
    //   an end at or before the start runs past midnight), rem: minutes before the start or -1 }.

    const REPEATS = [['none', K('ONCE')], ['week', K('WEEKLY')], ['month', K('MONTHLY')], ['year', K('YEARLY')]];
    const CAL_REMIND = [[-1, K('OFF')], [0, K('AT THE TIME')], [10, K('10 MIN BEFORE')], [60, K('1 HOUR BEFORE')], [1440, K('1 DAY BEFORE')]];
    const SCH_REMIND = [[-1, K('OFF')], [0, K('AT THE START')], [5, K('5 MIN BEFORE')], [15, K('15 MIN BEFORE')]];
    const CAL_PRESETS = [K('Birthday'), K('Appointment'), K('Meeting'), K('Deadline'), K('Payment'), K('Call'), K('Exam'), K('Trip'), K('Event')];
    const SCH_PRESETS = [K('Work'), K('Study'), K('Class'), K('Gym'), K('Meal'), K('Sleep'), K('Gaming'), K('Free time'), K('Chores'), K('Commute')];

    const newId = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const cleanTitle = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);

    function okEvent(e) {
      return e && typeof e.id === 'string' && parseKey(e.date) && cleanTitle(e.title) &&
        (e.time === '' || minsOf(e.time) >= 0) && REPEATS.some((r) => r[0] === e.rep) && typeof e.rem === 'number';
    }
    function okItem(it) {
      return it && typeof it.id === 'string' && cleanTitle(it.title) && Array.isArray(it.days) && it.days.length &&
        minsOf(it.start) >= 0 && minsOf(it.end) >= 0 && typeof it.rem === 'number';
    }

    const data = {
      events: store.get('cal.events', []).filter(okEvent).slice(0, 400),
      items: store.get('sched.items', []).filter(okItem).slice(0, 200),
      propEvents: [],
      propItems: [],
      propText: null
    };
    const saveEvents = () => store.set('cal.events', data.events);
    const saveItems = () => store.set('sched.items', data.items);
    const allEvents = () => data.events.concat(data.propEvents);
    const allItems = () => data.items.concat(data.propItems);

    // Entries from the properties get ids from their text, so editing one line does not re-announce the others.
    function hashId(p, s) {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return p + (h >>> 0).toString(36);
    }

    // "2026-12-03 18:30 Dentist | 12-25 Christmas": a date without a year comes back every year.
    function parseCalProp(text) {
      const out = [];
      for (const raw of String(text || '').split('|')) {
        const m = /^\s*(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2})[:.](\d{2}))?\s+(.+?)\s*$/.exec(raw);
        if (!m) continue;
        const mo = +m[2], da = +m[3], h = m[4] !== undefined ? +m[4] : -1, mi = m[5] !== undefined ? +m[5] : 0;
        if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) continue;
        if (new Date(m[1] ? +m[1] : 2000, mo - 1, da).getDate() !== da) continue; // 2026-02-30 and the like
        out.push({ id: hashId('p', raw.trim()), prop: true, title: cleanTitle(m[6]),
          date: (m[1] || '2000') + '-' + pad(mo) + '-' + pad(da), time: h >= 0 ? pad(h) + ':' + pad(mi) : '',
          rep: m[1] ? 'none' : 'year', rem: 0 });
      }
      return out.slice(0, 80);
    }

    const DAY_WORDS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    // "Mon-Fri", "Tue,Thu", "Sat", "Daily", "Weekdays", "Weekend" -> sorted day numbers, or null.
    function parseDays(s) {
      s = s.toLowerCase();
      if (/^(daily|everyday|all)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
      if (s === 'weekdays') return [1, 2, 3, 4, 5];
      if (/^weekends?$/.test(s)) return [0, 6];
      const set = new Set();
      for (const part of s.split(',')) {
        const r = /^([a-z]{3})[a-z]*(?:-([a-z]{3})[a-z]*)?$/.exec(part.trim());
        if (!r || !(r[1] in DAY_WORDS) || (r[2] && !(r[2] in DAY_WORDS))) return null;
        let a = DAY_WORDS[r[1]];
        const b = r[2] ? DAY_WORDS[r[2]] : a;
        for (let i = 0; i < 7; i++) {
          set.add(a);
          if (a === b) break;
          a = (a + 1) % 7;
        }
      }
      return Array.from(set).sort();
    }

    // "Mon-Fri 09:00-17:00 Work | Tue,Thu 19:00 Gym": without an end time an activity lasts an hour.
    function parseSchedProp(text) {
      const out = [];
      for (const raw of String(text || '').split('|')) {
        const m = /^\s*([A-Za-z,-]+)\s+(\d{1,2})[:.](\d{2})(?:\s*-\s*(\d{1,2})[:.](\d{2}))?\s+(.+?)\s*$/.exec(raw);
        if (!m) continue;
        const days = parseDays(m[1]);
        const sh = +m[2], sm = +m[3], eh = m[4] !== undefined ? +m[4] : -1, em = m[5] !== undefined ? +m[5] : 0;
        if (!days || !days.length || sh > 23 || sm > 59 || eh > 24 || em > 59) continue;
        const s = sh * 60 + sm, e = eh >= 0 ? Math.min(1440, eh * 60 + em) : Math.min(1440, s + 60);
        out.push({ id: hashId('q', raw.trim()), prop: true, title: cleanTitle(m[6]), days: days, start: hmOf(s), end: hmOf(e), rem: -1 });
      }
      return out.slice(0, 80);
    }

    function syncProps() {
      const sig = String(cfg.calEntries) + '\n' + String(cfg.schedEntries);
      if (sig === data.propText) return false;
      data.propText = sig;
      data.propEvents = parseCalProp(cfg.calEntries);
      data.propItems = parseSchedProp(cfg.schedEntries);
      return true;
    }

    // ---------- occurrences ----------

    function occursOn(ev, d) {
      const s = parseKey(ev.date);
      if (!s || d < s) return false;
      if (ev.rep === 'none') return sameDay(d, s);
      if (ev.rep === 'week') return d.getDay() === s.getDay();
      // The 31st of a monthly entry falls on the last day of shorter months; 29 February on the 28th.
      if (ev.rep === 'month') return d.getDate() === Math.min(s.getDate(), daysIn(d.getFullYear(), d.getMonth()));
      if (ev.rep === 'year') return d.getMonth() === s.getMonth() && d.getDate() === Math.min(s.getDate(), daysIn(d.getFullYear(), s.getMonth()));
      return false;
    }
    const evMins = (ev) => (ev.time ? minsOf(ev.time) : -1);
    const byTime = (a, b) => evMins(a) - evMins(b) || a.title.localeCompare(b.title);
    const eventsOn = (d) => allEvents().filter((e) => occursOn(e, d)).sort(byTime);

    // Coming occurrences from now: [{ ev, day, at }]. All-day entries stay listed until their day is over.
    function upcoming(now, days, max) {
      const out = [];
      const today = midnight(now);
      for (let i = 0; i < days && out.length < max; i++) {
        const d = addDays(today, i);
        for (const ev of eventsOn(d)) {
          const m = evMins(ev);
          const at = atOf(d, Math.max(0, m));
          if (m < 0 ? atOf(d, 1440) <= now : at < now) continue;
          out.push({ ev: ev, day: d, at: at });
          if (out.length >= max) break;
        }
      }
      return out;
    }

    function itemSpan(it) {
      const s = minsOf(it.start);
      let e = minsOf(it.end);
      if (e <= s) e += 1440;
      return [s, e];
    }

    // What is on right now and what comes next (looking a week ahead): { cur: { it, a, z }, next: { it, a, z } }.
    function schedNow(now) {
      const today = midnight(now);
      let cur = null, next = null;
      for (let off = -1; off <= 7; off++) {
        const d = addDays(today, off);
        for (const it of allItems()) {
          if (!it.days.includes(d.getDay())) continue;
          const sp = itemSpan(it);
          const a = atOf(d, sp[0]), z = atOf(d, sp[1]);
          if (a <= now && now < z) {
            if (!cur || a > cur.a) cur = { it: it, a: a, z: z };
          } else if (a > now && (!next || a < next.a)) {
            next = { it: it, a: a, z: z };
          }
        }
      }
      return { cur: cur, next: next };
    }

    // ---------- alerts ----------
    // Reminders that fall due while the wallpaper runs raise a card (hub: above the panel; places: top corner)
    // and a short chime. Calendar cards stay until acknowledged, also across restarts; schedule cards close
    // when their activity ends. Time spent paused or switched off is caught up, up to 12 hours back.

    const alerts = {
      list: store.get('cal.pending', []).filter((a) => a && a.key && Date.now() - a.at < 2 * DAY),
      fired: store.get('cal.fired', {}),
      last: 0,
      check: 0,
      saved: 0,
      shown: ''
    };
    {
      const stored = Number(store.get('cal.last', 0)) || 0;
      alerts.last = stored ? Math.min(Date.now(), Math.max(stored, Date.now() - 12 * HOUR)) : Date.now();
    }
    const savePending = () => store.set('cal.pending', alerts.list);

    // Reminders due in (from, to].
    function dueBetween(from, to) {
      const out = [];
      const end = addDays(midnight(to), 2);
      for (let d = addDays(midnight(from), -1); d <= end; d = addDays(d, 1)) {
        for (const ev of allEvents()) {
          if (ev.rem < 0 || !occursOn(ev, d)) continue;
          const m = evMins(ev);
          const start = atOf(d, m < 0 ? ALLDAY_AT : m);
          const at = start - ev.rem * 60000;
          if (at > from && at <= to) out.push({ key: 'c:' + ev.id + '@' + keyOf(d), kind: 'cal', id: ev.id, title: ev.title, start: start, allDay: m < 0, at: at });
        }
        for (const it of allItems()) {
          if (it.rem < 0 || !it.days.includes(d.getDay())) continue;
          const sp = itemSpan(it);
          const start = atOf(d, sp[0]);
          const at = start - it.rem * 60000;
          if (at > from && at <= to) out.push({ key: 's:' + it.id + '@' + keyOf(d), kind: 'sched', id: it.id, title: it.title, start: start, end: atOf(d, sp[1]), at: at });
        }
      }
      return out.sort((a, b) => a.at - b.at);
    }

    let actx = null;
    function chime() {
      if (!cfg.calSound) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        const t0 = actx.currentTime + 0.03;
        [[987.8, 0], [1318.5, 0.14], [1975.5, 0.28]].forEach((n) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = 'sine';
          o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, t0 + n[1]);
          g.gain.exponentialRampToValueAtTime(0.16, t0 + n[1] + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.6);
          o.connect(g);
          g.connect(actx.destination);
          o.start(t0 + n[1]);
          o.stop(t0 + n[1] + 0.65);
        });
      } catch (e) { /* no audio */ }
    }

    function raise(a, now) {
      if (alerts.list.some((x) => x.key === a.key)) return;
      alerts.list.push(a);
      if (alerts.list.length > 20) alerts.list.shift();
      savePending();
      chime();
      const when = a.allDay ? T('today') : hm(new Date(a.start).getHours() * 60 + new Date(a.start).getMinutes());
      api.say('Alert', a.kind === 'cal' ? T('Calendar: {title}, {when}.', { title: a.title, when: when })
        : T('Schedule: {title} at {when}.', { title: a.title, when: when }));
      api.act('hop');
      api.emote('alert');
      renderCard(now, true);
    }

    function visibleAlerts(now) {
      return alerts.list.filter((a) => !(a.snooze > now));
    }

    function tick(now) {
      if (now - alerts.check < 1000) return;
      alerts.check = now;
      if (now < alerts.last) alerts.last = now; // the clock went back
      alerts.last = Math.max(alerts.last, now - 12 * HOUR); // a long pause catches up 12 hours at most
      if (cfg.calAlerts) {
        for (const a of dueBetween(alerts.last, now)) {
          if (alerts.fired[a.key]) continue;
          alerts.fired[a.key] = now;
          if (a.kind === 'sched' && a.end <= now) continue; // the activity is already over
          raise(a, now);
        }
      }
      alerts.last = now;
      // Schedule cards leave once the activity ends.
      const before = alerts.list.length;
      alerts.list = alerts.list.filter((a) => !(a.kind === 'sched' && a.end <= now));
      if (alerts.list.length !== before) savePending();
      if (now - alerts.saved > 15000) {
        alerts.saved = now;
        for (const k in alerts.fired) if (now - alerts.fired[k] > 3 * DAY) delete alerts.fired[k];
        store.set('cal.fired', alerts.fired);
        store.set('cal.last', now);
      }
      renderCard(now, false);
      renderAgenda(now, false);
    }

    function relWhen(a, now) {
      if (a.allDay) return T('ALL DAY');
      const left = a.start - now;
      if (left > 0) return api.fmtIn(left);
      if (a.kind === 'sched' || left > -5 * 60000) return T('NOW');
      return T('STARTED {time}', { time: hm(new Date(a.start).getHours() * 60 + new Date(a.start).getMinutes()) });
    }

    function renderCard(now, force) {
      const card = $('cal-card');
      const vis = visibleAlerts(now);
      const a = vis[0];
      const had = document.body.classList.contains('cal-alert');
      document.body.classList.toggle('cal-alert', !!a); // the card takes the agenda's place above the hub panel
      if (had && !a) renderAgenda(now, true); // shown again: measure its columns now that they are visible
      if (!a) {
        if (card.classList.contains('show')) card.classList.remove('show');
        alerts.shown = '';
        return;
      }
      const d = new Date(a.start);
      const sig = a.key + '|' + vis.length + '|' + relWhen(a, now) + '|' + I18N.code;
      if (!force && sig === alerts.shown) return;
      const fresh = !alerts.shown.startsWith(a.key + '|');
      alerts.shown = sig;
      card.dataset.kind = a.kind;
      setText($('cc-kind'), a.kind === 'cal' ? T('CALENDAR ALERT') : T('SCHEDULE'));
      setText($('cc-more'), vis.length > 1 ? T('+{n} MORE', { n: vis.length - 1 }) : '');
      setText($('cc-title'), a.title);
      const time = a.allDay ? '' : '  //  ' + hm(d.getHours() * 60 + d.getMinutes()) +
        (a.end ? ' - ' + hm(new Date(a.end).getHours() * 60 + new Date(a.end).getMinutes()) : '');
      setText($('cc-when'), shortDay(d) + time);
      setText($('cc-rel'), relWhen(a, now));
      setText($('cc-ok'), T('ACKNOWLEDGE'));
      setText($('cc-snooze'), T('SNOOZE {n} MIN', { n: SNOOZE / 60000 }));
      if (fresh || !card.classList.contains('show')) {
        card.classList.remove('show');
        void card.offsetWidth;
        card.classList.add('show');
      }
    }

    function dismiss(snooze) {
      const now = Date.now();
      const a = visibleAlerts(now)[0];
      if (!a) return;
      if (snooze) a.snooze = now + SNOOZE;
      else alerts.list = alerts.list.filter((x) => x !== a);
      savePending();
      renderCard(now, true);
    }
    $('cc-ok').addEventListener('click', () => dismiss(false));
    $('cc-snooze').addEventListener('click', () => dismiss(true));
    $('cc-title').addEventListener('click', () => {
      const a = visibleAlerts(Date.now())[0];
      if (a) openAt(a.kind === 'cal' ? 'calendar' : 'schedule', midnight(a.start));
    });

    const alertTitle = () => {
      const a = visibleAlerts(Date.now())[0];
      return a ? a.title : '';
    };

    // ---------- desktop agenda ----------

    const agenda = { sig: '', on: null, at: 0 };

    function agendaWanted(now) {
      if (cfg.calWidget === 'off') return false;
      if (cfg.calWidget === 'on') return true;
      const s = schedNow(now);
      return upcoming(now, 7, 1).length > 0 || !!s.cur || !!(s.next && sameDay(new Date(s.next.a), new Date(now)));
    }

    function weekDays(now) {
      const today = midnight(now);
      const first = addDays(today, -((today.getDay() - weekStart() + 7) % 7));
      return Array.from({ length: 7 }, (_, i) => addDays(first, i));
    }

    function renderAgenda(now, force) {
      if (!force && now - agenda.at < 5000) return; // nothing on it changes faster than that
      agenda.at = now;
      const want = agendaWanted(now);
      if (want !== agenda.on) {
        agenda.on = want;
        document.body.classList.toggle('agenda-on', want);
        force = true;
      }
      if (!want) return;
      const s = schedNow(now);
      // Four rows fit the space above the hub panel: what is on, what is next, then calendar entries.
      const up = upcoming(now, 30, Math.max(2, 4 - (s.cur ? 1 : 0) - (s.next ? 1 : 0)));
      const today = midnight(now);
      const week = weekDays(now);
      const nowLine = s.cur ? s.cur.it.title + '|' + s.cur.z : '';
      const nextLine = s.next ? s.next.it.title + '|' + s.next.a : '';
      const sig = [keyOf(today), I18N.code, cfg.clock24, weekStart(), nowLine, nextLine, data.events.length, data.propText,
        up.map((u) => u.ev.id + u.at).join(','), week.map((d) => eventsOn(d).length).join('')].join('/');
      if (!force && sig === agenda.sig) return;
      agenda.sig = sig;

      setText($('ag-date'), monthTitle(today.getFullYear(), today.getMonth()));
      const wk = $('ag-week');
      wk.textContent = '';
      for (const d of week) {
        const c = el('div', 'ag-day' + (sameDay(d, today) ? ' today' : '') + (d < today ? ' past' : ''));
        c.append(el('span', 'ag-dow', T(DOW[d.getDay()])), el('span', 'ag-num', String(d.getDate())));
        const marks = el('span', 'ag-marks');
        const n = eventsOn(d).length;
        for (let i = 0; i < Math.min(3, n); i++) marks.appendChild(el('i'));
        c.appendChild(marks);
        c.addEventListener('click', () => openAt('calendar', d));
        wk.appendChild(c);
      }

      const box = $('ag-now');
      box.textContent = '';
      const line = (tag, title, when, cls) => {
        const r = el('div', 'ag-row' + (cls ? ' ' + cls : ''));
        r.append(el('span', 'ag-tag', tag), el('span', 'ag-what', title), el('span', 'ag-when', when));
        r.addEventListener('click', () => openAt('schedule', today));
        box.appendChild(r);
      };
      const clockOf = (t) => { const d = new Date(t); return hm(d.getHours() * 60 + d.getMinutes()); };
      if (s.cur) line(T('NOW'), s.cur.it.title, T('UNTIL {time}', { time: clockOf(s.cur.z) }), 'cur');
      if (s.next) {
        const nd = new Date(s.next.a);
        line(T('UP NEXT'), s.next.it.title, (sameDay(nd, today) ? '' : T(DOW[nd.getDay()]) + ' ') + clockOf(s.next.a));
      }

      const ul = $('ag-list');
      ul.textContent = '';
      for (const u of up) {
        const li = el('li');
        const m = evMins(u.ev);
        li.append(el('span', 'ag-d', sameDay(u.day, today) ? T('TODAY') : T('{wd} {day}', { wd: T(DOW[u.day.getDay()]), day: pad(u.day.getDate()) })),
          el('span', 'ag-t', m < 0 ? T('ALL DAY') : hm(m)), el('span', 'ag-what', u.ev.title));
        li.addEventListener('click', () => openAt('calendar', u.day));
        ul.appendChild(li);
      }
      if (!up.length && !s.cur && !s.next) {
        const li = el('li', 'empty', T('NO ENTRIES // QUESTS > CALENDAR'));
        li.addEventListener('click', () => openAt('calendar', today));
        ul.appendChild(li);
      }
      // Words differ in length per language: each column takes its widest entry, so the rows stay aligned.
      alignCol(box.querySelectorAll('.ag-tag'));
      alignCol(ul.querySelectorAll('.ag-d'));
      alignCol(ul.querySelectorAll('.ag-t'));
    }

    function alignCol(cells) {
      let w = 0;
      for (const c of cells) {
        c.style.width = '';
        w = Math.max(w, c.scrollWidth);
      }
      if (w > 0) for (const c of cells) c.style.width = w + 'px';
    }
    $('ag-head').addEventListener('click', () => openAt('calendar', midnight(Date.now())));

    // Open a planner view on a given day.
    function openAt(view, day) {
      if (view === 'calendar') {
        cal.sel = keyOf(day);
        cal.y = day.getFullYear();
        cal.m = day.getMonth();
      }
      if (nav.place === 'quests' && nav.sel === view) refresh(view, Date.now(), true);
      else api.go('quests', view);
    }

    // The hub QUESTS panel line: the next calendar entry.
    const hub = { at: 0, text: '', sig: '' };
    function hubLine(now) {
      const sig = I18N.code + cfg.clock24 + agenda.sig;
      if (now - hub.at < 5000 && sig === hub.sig) return hub.text; // the QUESTS panel asks four times a second
      hub.at = now;
      hub.sig = sig;
      hub.text = hubText(now);
      return hub.text;
    }
    function hubText(now) {
      const u = upcoming(now, 60, 1)[0];
      if (!u) return T('NONE');
      const m = evMins(u.ev);
      const today = midnight(now);
      const day = sameDay(u.day, today) ? T('TODAY') : T('{wd} {day}', { wd: T(DOW[u.day.getDay()]), day: pad(u.day.getDate()) });
      return day + '  ' + (m < 0 ? '' : hm(m) + '  ') + u.ev.title;
    }

    // ---------- QUESTS > CALENDAR ----------

    const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: keyOf(new Date()), sig: '' };

    const calSig = (now) => [cal.y, cal.m, cal.sel, keyOf(midnight(now)), I18N.code, cfg.clock24, weekStart(), cfg.calAlerts, cfg.calWidget,
      data.propText, JSON.stringify(data.events)].join('/');

    function renderCalendar(now, force) {
      const today = midnight(now);
      const sig = calSig(now);
      if (!force && sig === cal.sig) return;
      cal.sig = sig;
      const ws = weekStart();
      setText($('cal-month'), monthTitle(cal.y, cal.m));
      setText($('cal-alerts'), cfg.calAlerts ? T('ALERTS ON') : T('ALERTS OFF'));
      $('cal-alerts').classList.toggle('ghost', !cfg.calAlerts);
      const wl = { auto: K('AUTO'), on: K('ON'), off: K('OFF') }[cfg.calWidget] || K('AUTO');
      setText($('cal-widget'), T('DESKTOP AGENDA // {mode}', { mode: T(wl) }));
      $('cal-widget').classList.toggle('ghost', cfg.calWidget === 'off');

      const dow = $('cal-dow');
      dow.textContent = '';
      for (let i = 0; i < 7; i++) dow.appendChild(el('span', '', T(DOW[(ws + i) % 7])));

      const grid = $('cal-grid');
      grid.textContent = '';
      const first = new Date(cal.y, cal.m, 1);
      const start = addDays(first, -((first.getDay() - ws + 7) % 7));
      const sel = parseKey(cal.sel);
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const evs = eventsOn(d);
        const c = el('div', 'cal-cell' + (d.getMonth() !== cal.m ? ' other' : '') + (sameDay(d, today) ? ' today' : '') +
          (sel && sameDay(d, sel) ? ' sel' : '') + (evs.length ? ' has' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' wkend' : ''));
        c.dataset.key = keyOf(d);
        c.appendChild(el('span', 'cd-num', String(d.getDate())));
        for (const ev of evs.slice(0, 3)) {
          const m = evMins(ev);
          c.appendChild(el('span', 'cd-ev' + (ev.rem >= 0 ? ' bell' : ''), (m < 0 ? '' : hm(m) + ' ') + ev.title));
        }
        if (evs.length > 3) c.appendChild(el('span', 'cd-more', T('+{n} MORE', { n: evs.length - 3 })));
        c.addEventListener('click', () => selectDay(d));
        c.addEventListener('dblclick', () => openEditor('cal', null, d));
        grid.appendChild(c);
      }

      renderDayPanel(today);
      const upBox = $('cal-up');
      upBox.textContent = '';
      const up = upcoming(now, 120, 6);
      if (!up.length) upBox.appendChild(el('div', 'empty', T('NOTHING IN THE NEXT 120 DAYS')));
      for (const u of up) {
        const r = el('div', 'cu-row');
        const m = evMins(u.ev);
        r.append(el('span', 'cu-d', sameDay(u.day, today) ? T('TODAY') : shortDay(u.day)), el('span', 'cu-t', m < 0 ? T('ALL DAY') : hm(m)), el('span', 'cu-n', u.ev.title));
        r.addEventListener('click', () => openAt('calendar', u.day));
        upBox.appendChild(r);
      }
    }

    // Picking a day of the shown month only moves the highlight, so a double-click lands on the same cell.
    function selectDay(d) {
      cal.sel = keyOf(d);
      if (d.getMonth() !== cal.m || d.getFullYear() !== cal.y) {
        cal.y = d.getFullYear();
        cal.m = d.getMonth();
        renderCalendar(Date.now(), true);
        return;
      }
      for (const c of $('cal-grid').children) c.classList.toggle('sel', c.dataset.key === cal.sel);
      renderDayPanel(midnight(Date.now()));
      cal.sig = calSig(Date.now());
    }

    function renderDayPanel(today) {
      const sel = parseKey(cal.sel) || today;
      setText($('cal-day'), longDay(sel));
      const list = $('cal-entries');
      list.textContent = '';
      const evs = eventsOn(sel);
      if (!evs.length) list.appendChild(el('div', 'empty', T('NO ENTRIES')));
      for (const ev of evs.slice(0, 7)) list.appendChild(entryRow(ev));
      if (evs.length > 7) list.appendChild(el('div', 'empty', T('+{n} MORE', { n: evs.length - 7 })));
    }

    const BELL = '<svg viewBox="0 0 24 24"><path d="M12 2.5a6 6 0 0 0-6 6v4.2L4 16.5h16l-2-3.8V8.5a6 6 0 0 0-6-6zM9.5 18.5a2.5 2.5 0 0 0 5 0z" fill="currentColor"/></svg>';

    function entryRow(ev) {
      const r = el('div', 'ce-row' + (ev.prop ? ' prop' : ''));
      const m = evMins(ev);
      r.appendChild(el('span', 'ce-t', m < 0 ? T('ALL DAY') : hm(m)));
      r.appendChild(el('span', 'ce-n', ev.title));
      const tags = el('span', 'ce-tags');
      if (ev.prop) tags.appendChild(el('span', 'ce-tag', T('PROPERTIES')));
      else if (ev.rep !== 'none') tags.appendChild(el('span', 'ce-tag', T((REPEATS.find((x) => x[0] === ev.rep) || REPEATS[0])[1])));
      if (ev.rem >= 0 && cfg.calAlerts) {
        const b = el('span', 'ce-bell');
        b.innerHTML = BELL;
        tags.appendChild(b);
      }
      r.appendChild(tags);
      r.addEventListener('click', () => {
        if (ev.prop) api.say('Report', T('That entry comes from the wallpaper properties. Edit it there.'));
        else openEditor('cal', ev);
      });
      return r;
    }

    $('cal-prev').addEventListener('click', () => stepMonth(-1));
    $('cal-next').addEventListener('click', () => stepMonth(1));
    $('cal-today').addEventListener('click', () => {
      const d = new Date();
      cal.y = d.getFullYear();
      cal.m = d.getMonth();
      cal.sel = keyOf(d);
      renderCalendar(Date.now(), true);
    });
    $('cal-add').addEventListener('click', () => openEditor('cal', null, parseKey(cal.sel) || midnight(Date.now())));
    $('cal-alerts').addEventListener('click', () => api.setOverride('calAlerts', !cfg.calAlerts));
    $('cal-widget').addEventListener('click', () => {
      const order = ['auto', 'on', 'off'];
      api.setOverride('calWidget', order[(order.indexOf(cfg.calWidget) + 1) % order.length]);
    });

    function stepMonth(n) {
      const d = new Date(cal.y, cal.m + n, 1);
      cal.y = d.getFullYear();
      cal.m = d.getMonth();
      const sel = parseKey(cal.sel);
      if (sel) cal.sel = keyOf(new Date(cal.y, cal.m, Math.min(sel.getDate(), daysIn(cal.y, cal.m))));
      renderCalendar(Date.now(), true);
    }

    // ---------- QUESTS > WEEKLY SCHEDULE ----------

    const sch = { sig: '', range: [360, 1440] };

    // Day columns: each activity on its own days, plus the part after midnight of one from the day before.
    function daySegments(dow) {
      const segs = [];
      for (const it of allItems()) {
        const sp = itemSpan(it);
        if (it.days.includes(dow)) segs.push({ it: it, s: sp[0], e: Math.min(sp[1], 1440), cont: false });
        if (sp[1] > 1440 && it.days.includes((dow + 6) % 7)) segs.push({ it: it, s: 0, e: sp[1] - 1440, cont: true });
      }
      segs.sort((a, b) => a.s - b.s || b.e - a.e);
      // Activities that overlap share the column side by side; each group of overlaps is split on its own,
      // so a short lunch inside a work block does not halve every other activity that day.
      let group = [], groupEnd = -1;
      const flush = () => {
        const lanes = [];
        for (const g of group) {
          let i = lanes.findIndex((end) => end <= g.s);
          if (i < 0) {
            i = lanes.length;
            lanes.push(0);
          }
          lanes[i] = g.e;
          g.lane = i;
        }
        for (const g of group) g.lanes = lanes.length;
        group = [];
        groupEnd = -1;
      };
      for (const g of segs) {
        if (group.length && g.s >= groupEnd) flush();
        group.push(g);
        groupEnd = Math.max(groupEnd, g.e);
      }
      if (group.length) flush();
      return segs;
    }

    function renderSchedule(now, force) {
      const today = midnight(now);
      const nowMin = Math.floor((now - today.getTime()) / 60000);
      const ws = weekStart();
      const sig = [keyOf(today), I18N.code, cfg.clock24, ws, data.propText, JSON.stringify(data.items)].join('/');
      const s = schedNow(now);
      setText($('sch-now'), s.cur ? T('NOW // {what} UNTIL {time}', { what: s.cur.it.title, time: hm(minuteOf(s.cur.z)) }) : T('NOW // FREE'));
      setText($('sch-next'), s.next ? T('NEXT // {what} {when}', { what: s.next.it.title,
        when: (sameDay(new Date(s.next.a), today) ? '' : T(DOW[new Date(s.next.a).getDay()]) + ' ') + hm(minuteOf(s.next.a)) }) : '');
      if (force || sig !== sch.sig) {
        sch.sig = sig;
        buildSchedule(today, ws);
      }
      // The current-time line on today's column.
      const line = $('sch-nowline');
      const r = sch.range;
      if (line) {
        const on = nowMin >= r[0] && nowMin <= r[1];
        line.style.display = on ? '' : 'none';
        if (on) line.style.top = ((nowMin - r[0]) / (r[1] - r[0]) * 100).toFixed(3) + '%';
      }
    }
    const minuteOf = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };

    function buildSchedule(today, ws) {
      const cols = $('sch-cols'), axis = $('sch-axis');
      cols.textContent = '';
      axis.textContent = '';
      const days = Array.from({ length: 7 }, (_, i) => (ws + i) % 7);
      const segsBy = {};
      let lo = 360;
      for (const dow of days) {
        segsBy[dow] = daySegments(dow);
        for (const g of segsBy[dow]) lo = Math.min(lo, Math.floor(g.s / 60) * 60);
      }
      const r = sch.range = [lo, 1440];
      const span = r[1] - r[0];
      const step = span > 12 * 60 ? 120 : 60;
      axis.appendChild(el('div', 'sch-axhead'));
      const axBody = el('div', 'sch-axbody');
      for (let m = r[0]; m <= r[1]; m += step) {
        const t = el('span', 'sch-tick', hm(m));
        t.style.top = ((m - r[0]) / span * 100).toFixed(3) + '%';
        axBody.appendChild(t);
      }
      axis.appendChild(axBody);
      const curDow = today.getDay();
      // This week's dates under the day names.
      const off = (curDow - ws + 7) % 7;
      days.forEach((dow, i) => {
        const date = addDays(today, i - off);
        const col = el('div', 'sch-col' + (dow === curDow ? ' today' : '') + (dow === 0 || dow === 6 ? ' wkend' : ''));
        const head = el('div', 'sch-head');
        head.append(el('span', 'sh-dow', T(DOW[dow])), el('span', 'sh-num', String(date.getDate())));
        col.appendChild(head);
        const body = el('div', 'sch-body');
        for (let m = r[0] + step; m < r[1]; m += step) {
          const gl = el('i', 'sch-grid');
          gl.style.top = ((m - r[0]) / span * 100).toFixed(3) + '%';
          body.appendChild(gl);
        }
        for (const g of segsBy[dow]) {
          if (g.e <= r[0]) continue;
          const b = el('div', 'sch-blk' + (g.it.prop ? ' prop' : '') + (g.cont ? ' cont' : ''));
          const top = (Math.max(g.s, r[0]) - r[0]) / span * 100, h = (g.e - Math.max(g.s, r[0])) / span * 100;
          b.style.top = top.toFixed(3) + '%';
          b.style.height = 'calc(' + h.toFixed(3) + '% - 2px)';
          // The first of overlapping activities keeps the full width; later ones sit inset on top of it.
          const left = g.lane / g.lanes * 100;
          b.style.left = 'calc(' + left.toFixed(2) + '% + 2px)';
          b.style.width = 'calc(' + (100 - left).toFixed(2) + '% - 4px)';
          b.style.zIndex = String(1 + g.lane);
          if (g.lane) b.classList.add('over');
          if ((g.e - Math.max(g.s, r[0])) / span < 0.07) b.classList.add('short'); // one line: title and time
          const sp = itemSpan(g.it);
          b.append(el('span', 'sb-n', g.it.title), el('span', 'sb-t', hm(sp[0]) + ' - ' + hm(sp[1] % 1440 || (sp[1] ? 1440 : 0))));
          if (g.it.rem >= 0 && cfg.calAlerts) {
            const bell = el('span', 'sb-bell');
            bell.innerHTML = BELL;
            b.appendChild(bell);
          }
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (g.it.prop) api.say('Report', T('That entry comes from the wallpaper properties. Edit it there.'));
            else openEditor('sched', g.it);
          });
          body.appendChild(b);
        }
        if (dow === curDow) {
          const nl = el('div', 'sch-nowline');
          nl.id = 'sch-nowline';
          body.appendChild(nl);
        }
        // An empty slot starts a new activity there, on the half hour.
        body.addEventListener('click', (e) => {
          const rect = body.getBoundingClientRect();
          const m = r[0] + Math.round(((e.clientY - rect.top) / rect.height * span) / 30) * 30;
          const startM = Math.max(0, Math.min(1410, m));
          openEditor('sched', null, null, { days: [dow], start: hmOf(startM), end: hmOf(Math.min(1440, startM + 60)) });
        });
        col.appendChild(body);
        cols.appendChild(col);
      });
    }

    $('sch-add').addEventListener('click', () => openEditor('sched', null, null, { days: [midnight(Date.now()).getDay()], start: '18:00', end: '19:00' }));

    // ---------- editor with on-screen keyboard ----------

    const ed = { open: false, kind: '', rec: null, title: '', shift: false, kata: false, layout: 'abc', armDel: 0, tip: '', waiting: false,
      py: '', pyPage: 0, hc: false };

    const u = (codes) => codes.map((c) => (c ? String.fromCharCode(c) : ''));
    const KB = {
      abc: { label: 'ABC', rows: ['1234567890', 'qwertyuiop', 'asdfghjkl\'', 'zxcvbnm,.-'].map((r) => r.split('')) },
      sym: { label: '#+=', rows: ['1234567890', '!?@#&()/:;', '+=*%"_~<>', '[]{}$^|\\`'].map((r) => r.split('')) },
      acc: { label: '\u00c0\u00c9\u00ce', rows: [
        u([0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9]),
        u([0xea, 0xeb, 0xec, 0xed, 0xee, 0xef, 0xf1, 0xf2, 0xf3, 0xf4]),
        u([0xf5, 0xf6, 0xf8, 0x153, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xff]),
        u([0xdf, 0xbf, 0xa1, 0xaa, 0xba, 0x20ac, 0xab, 0xbb, 0xb0, 0xb7])] },
      cyr: { label: '\u0410\u0411\u0412', rows: [
        u([0x439, 0x446, 0x443, 0x43a, 0x435, 0x43d, 0x433, 0x448, 0x449, 0x437, 0x445, 0x44a]),
        u([0x444, 0x44b, 0x432, 0x430, 0x43f, 0x440, 0x43e, 0x43b, 0x434, 0x436, 0x44d]),
        u([0x44f, 0x447, 0x441, 0x43c, 0x438, 0x442, 0x44c, 0x431, 0x44e, 0x451, 0x2c, 0x2e])] },
      // Hiragana in the gojuon order, a column per consonant; SHIFT switches to katakana.
      kana: { label: '\u304b\u306a', rows: [
        u([0x3042, 0x304b, 0x3055, 0x305f, 0x306a, 0x306f, 0x307e, 0x3084, 0x3089, 0x308f, 0x3099, 0x3041]),
        u([0x3044, 0x304d, 0x3057, 0x3061, 0x306b, 0x3072, 0x307f, 0x3086, 0x308a, 0x3092, 0x309a, 0x3043]),
        u([0x3046, 0x304f, 0x3059, 0x3064, 0x306c, 0x3075, 0x3080, 0x3088, 0x308b, 0x3093, 0x30fc, 0x3045]),
        u([0x3048, 0x3051, 0x305b, 0x3066, 0x306d, 0x3078, 0x3081, 0x3083, 0x308c, 0x3063, 0x3001, 0x3047]),
        u([0x304a, 0x3053, 0x305d, 0x3068, 0x306e, 0x307b, 0x3082, 0x3085, 0x308d, 0x3087, 0x3002, 0x3049])] }
    };
    // Korean: the standard 2-set layout (jamo where QWERTY has its letters). Jamo join into syllables as
    // they are typed (Hangul below); SHIFT gives the tense consonants and yae/ye.
    KB.ko = { label: u([0xd55c, 0xae00]).join(''), rows: [
      '1234567890'.split(''),
      u([0x3142, 0x3148, 0x3137, 0x3131, 0x3145, 0x315b, 0x3155, 0x3151, 0x3150, 0x3154]),
      u([0x3141, 0x3134, 0x3147, 0x3139, 0x314e, 0x3157, 0x3153, 0x314f, 0x3163]),
      u([0x314b, 0x314c, 0x314a, 0x314d, 0x3160, 0x315c, 0x3161]).concat([',', '.', '?'])] };
    const KO_SHIFT = { 0x3142: 0x3143, 0x3148: 0x3149, 0x3137: 0x3138, 0x3131: 0x3132, 0x3145: 0x3146, 0x3150: 0x3152, 0x3154: 0x3156 };
    // Chinese: pinyin. Letters collect in a buffer and the row above the keys offers characters for it
    // (Pinyin below). The apostrophe splits syllables by hand (xi'an); SHIFT types a Latin capital.
    KB.zh = { label: u([0x62fc, 0x97f3]).join(''), rows: [
      '1234567890'.split(''), 'qwertyuiop'.split(''), 'asdfghjkl\''.split(''),
      'zxcvbnm'.split('').concat(u([0xff0c, 0x3002, 0xff1f]))] };
    const KB_ORDER = ['abc', 'acc', 'cyr', 'kana', 'ko', 'zh', 'sym'];
    const KB_DEFAULT = { ru: 'cyr', ja: 'kana', ko: 'ko', zh: 'zh' };

    // ---- Hangul. ed.hc marks the last character as still being composed: the next jamo may join it, and
    // ERASE takes it apart one jamo at a time, as a Korean IME does. Any other key ends the syllable.
    const HG = 0xac00, HG_END = 0xd7a3, VOW0 = 0x314f; // the 21 vowel jamo follow VOW0 in syllable order
    const CHO = [0x3131, 0x3132, 0x3134, 0x3137, 0x3138, 0x3139, 0x3141, 0x3142, 0x3143, 0x3145, 0x3146, 0x3147, 0x3148, 0x3149, 0x314a,
      0x314b, 0x314c, 0x314d, 0x314e];
    const JONG = [0, 0x3131, 0x3132, 0x3133, 0x3134, 0x3135, 0x3136, 0x3137, 0x3139, 0x313a, 0x313b, 0x313c, 0x313d, 0x313e, 0x313f,
      0x3140, 0x3141, 0x3142, 0x3144, 0x3145, 0x3146, 0x3147, 0x3148, 0x314a, 0x314b, 0x314c, 0x314d, 0x314e];
    // Double finals [first final, second consonant] and double vowels [first vowel, second vowel], by index.
    const JONG2 = { 3: [1, 0x3145], 5: [4, 0x3148], 6: [4, 0x314e], 9: [8, 0x3131], 10: [8, 0x3141], 11: [8, 0x3142], 12: [8, 0x3145],
      13: [8, 0x314c], 14: [8, 0x314d], 15: [8, 0x314e], 18: [17, 0x3145] };
    const VOW2 = { 9: [8, 0], 10: [8, 1], 11: [8, 20], 14: [13, 4], 15: [13, 5], 16: [13, 20], 19: [18, 20] };
    const isJamo = (ch) => ch >= String.fromCharCode(0x3131) && ch <= String.fromCharCode(0x3163);
    const hsyl = (l, v, t) => String.fromCharCode(HG + (l * 21 + v) * 28 + t);
    const hparts = (c) => ({ l: Math.floor((c - HG) / 588), v: Math.floor((c - HG) / 28) % 21, t: (c - HG) % 28 });
    function joinOf(table, a, b) {
      for (const k in table) if (table[k][0] === a && table[k][1] === b) return +k;
      return -1;
    }

    function typeJamo(ch) {
      const c = ch.charCodeAt(0), t = ed.title;
      const last = ed.hc && t ? t.charCodeAt(t.length - 1) : 0;
      const room = t.length < MAX_TITLE;
      const put = (s) => {
        ed.title = t.slice(0, -1) + s;
        ed.hc = true;
      };
      if (c < VOW0) {
        if (last >= HG && last <= HG_END) {
          const p = hparts(last);
          const nt = p.t ? joinOf(JONG2, p.t, c) : JONG.indexOf(c);
          if (nt > 0) return put(hsyl(p.l, p.v, nt));
        }
      } else {
        const v = c - VOW0;
        if (CHO.indexOf(last) >= 0) return put(hsyl(CHO.indexOf(last), v, 0));
        if (last >= HG && last <= HG_END) {
          const p = hparts(last);
          if (!p.t) {
            const nv = joinOf(VOW2, p.v, v);
            if (nv >= 0) return put(hsyl(p.l, nv, 0));
          } else if (room) {
            // The final moves on to start the new syllable (of a double final, only its second consonant).
            const sp = JONG2[p.t];
            return put(hsyl(p.l, p.v, sp ? sp[0] : 0) + hsyl(CHO.indexOf(sp ? sp[1] : JONG[p.t]), v, 0));
          }
        } else if (last >= VOW0 && last <= 0x3163) {
          const nv = joinOf(VOW2, last - VOW0, v);
          if (nv >= 0) return put(String.fromCharCode(VOW0 + nv));
        }
      }
      if (!room) return;
      ed.title = t + ch;
      ed.hc = true;
    }

    // ERASE inside the syllable being composed; false when there is none (the caller erases a character).
    function eraseJamo() {
      const t = ed.title, last = ed.hc && t ? t.charCodeAt(t.length - 1) : 0;
      const put = (s) => { ed.title = t.slice(0, -1) + s; };
      if (last >= HG && last <= HG_END) {
        const p = hparts(last);
        if (p.t) put(hsyl(p.l, p.v, JONG2[p.t] ? JONG2[p.t][0] : 0));
        else if (VOW2[p.v]) put(hsyl(p.l, VOW2[p.v][0], 0));
        else put(String.fromCharCode(CHO[p.l]));
        return true;
      }
      if (last >= VOW0 && VOW2[last - VOW0]) {
        put(String.fromCharCode(VOW0 + VOW2[last - VOW0][0]));
        return true;
      }
      ed.hc = false;
      return false;
    }

    // ---- Pinyin. ed.py holds the letters typed so far. The candidates are for its first syllable: the
    // longest whole syllable it starts with, else the unfinished one (zh, xio), which offers the most used
    // characters of every syllable it could become. pinyin.js (tools/build_pinyin.ps1) loads on first use.
    const PY_PAGE = 8;
    let PY = window.YoRHaPinyin || null, pyFailed = false, pyLoading = false;
    function needPinyin() {
      if (PY || pyFailed || pyLoading) return;
      pyLoading = true;
      const s = document.createElement('script');
      s.src = 'pinyin.js';
      s.onload = s.onerror = () => {
        pyLoading = false;
        PY = window.YoRHaPinyin || null;
        pyFailed = !PY;
        if (ed.open) renderCand();
      };
      document.head.appendChild(s);
    }

    function pySeg() {
      const body = ed.py.replace(/^'+/, ''), lead = ed.py.length - body.length, head = body.split('\'')[0];
      if (PY && head) {
        for (const table of [PY.syl, PY.pre]) {
          for (let n = Math.min(6, head.length); n > 0; n--) {
            if (table[head.slice(0, n)]) return { len: lead + n, chars: table[head.slice(0, n)] };
          }
        }
      }
      return { len: 0, chars: '' };
    }

    function pickCand(ch) {
      if (ed.title.length >= MAX_TITLE) return false;
      ed.title += ch;
      ed.py = ed.py.slice(pySeg().len).replace(/^'+/, '');
      ed.pyPage = 0;
      return true;
    }

    // The letters as typed, when no character is wanted (a name, or a syllable the table lacks).
    function commitRaw() {
      const s = ed.py.replace(/'/g, '');
      ed.title += s.slice(0, Math.max(0, MAX_TITLE - ed.title.length));
      ed.py = '';
      ed.pyPage = 0;
    }

    // SPACE: the first candidate for the first syllable.
    function pickFirst() {
      const sg = pySeg();
      if (!sg.len) commitRaw();
      else if (!pickCand(sg.chars[0])) commitRaw();
    }

    // Everything still in the buffer, before another key types (punctuation, digits, SAVE, a new layout).
    function commitPy() {
      for (let guard = 0; ed.py && guard < 40; guard++) pickFirst();
      ed.py = '';
      ed.pyPage = 0;
    }

    function endCompose() {
      ed.py = '';
      ed.pyPage = 0;
      ed.hc = false;
    }

    // The candidate row (Chinese layout only): the typed letters (click: keep them as letters), a page of
    // characters, and page keys. Rebuilt after every key.
    function renderCand() {
      const row = $('kb').querySelector('.kb-cand');
      if (!row) return;
      row.textContent = '';
      row.classList.toggle('idle', !ed.py);
      if (!ed.py) return;
      needPinyin();
      const list = pySeg().chars, pages = Math.max(1, Math.ceil(list.length / PY_PAGE));
      ed.pyPage = Math.max(0, Math.min(ed.pyPage, pages - 1));
      const raw = el('span', 'key raw', ed.py);
      raw.dataset.op = 'raw';
      row.appendChild(raw);
      for (let i = 0; i < PY_PAGE; i++) {
        const ch = list[ed.pyPage * PY_PAGE + i] || '';
        const k = el('span', 'key cand' + (ch ? '' : ' blank'), ch);
        if (ch) k.dataset.op = 'cand:' + ch;
        row.appendChild(k);
      }
      for (const d of [-1, 1]) {
        const k = el('span', 'key pg' + ((d < 0 ? ed.pyPage > 0 : ed.pyPage < pages - 1) ? '' : ' off'));
        k.appendChild(el('span', 'chev' + (d < 0 ? ' l' : '')));
        k.dataset.op = 'pg:' + d;
        row.appendChild(k);
      }
    }
    const DAKU = '\u3099', HANDAKU = '\u309a';
    const toKata = (ch) => (ch >= '\u3041' && ch <= '\u3096' ? String.fromCharCode(ch.charCodeAt(0) + 0x60) : ch);
    const KEY_LABEL = { [DAKU]: '\u309b', [HANDAKU]: '\u309c' }; // spacing marks show on the keys

    function keyChar(ch) {
      if (ed.layout === 'kana') return ed.kata ? toKata(ch) : ch;
      if (ed.layout === 'ko') return ed.shift && KO_SHIFT[ch.charCodeAt(0)] ? String.fromCharCode(KO_SHIFT[ch.charCodeAt(0)]) : ch;
      if (ed.layout === 'zh') return ed.shift ? ch.toUpperCase() : ch; // pinyin is typed in lower case
      if (ed.layout === 'sym' || ch === '\u00df') return ch; // no capital form wanted
      return ed.shift || !ed.title ? ch.toUpperCase() : ch;
    }

    function typeChar(ch) {
      if (ch === DAKU || ch === HANDAKU) {
        // Voicing marks join the kana before them (ka -> ga, ha -> pa); elsewhere they do nothing.
        const joined = (ed.title + ch).normalize('NFC');
        if (joined.length === ed.title.length) ed.title = joined;
        return;
      }
      if (ed.title.length >= MAX_TITLE) return;
      ed.title += ch;
      if (ed.layout !== 'kana') ed.shift = false;
    }

    // Labels follow what a key will type: capitals for the first letter of a title (like a phone
    // keyboard) and after SHIFT, katakana after the kana SHIFT. Updated in place so a held key stays put.
    function relabelKeys() {
      for (const k of $('kb').querySelectorAll('.key[data-ch]')) setText(k, KEY_LABEL[k.dataset.ch] || keyChar(k.dataset.ch));
      const sh = $('kb').querySelector('.key[data-op="shift"]');
      if (!sh) return;
      sh.classList.toggle('on', ed.layout === 'kana' ? ed.kata : ed.shift);
      if (ed.layout === 'kana') setText(sh, ed.kata ? '\u30ab\u30ca' : '\u304b\u306a');
    }

    function renderKeyboard() {
      const kb = $('kb');
      kb.textContent = '';
      kb.dataset.layout = ed.layout;
      if (ed.layout === 'zh') {
        kb.appendChild(el('div', 'kb-row kb-cand idle'));
        needPinyin();
      }
      for (const row of KB[ed.layout].rows) {
        const r = el('div', 'kb-row');
        for (const ch of row) {
          const k = el('span', 'key' + (ch ? '' : ' blank'), ch ? (KEY_LABEL[ch] || keyChar(ch)) : '');
          if (ch) k.dataset.ch = ch;
          r.appendChild(k);
        }
        kb.appendChild(r);
      }
      const r = el('div', 'kb-row kb-ctl');
      const shift = el('span', 'key wide' + (ed.layout === 'kana' ? (ed.kata ? ' on' : '') : (ed.shift ? ' on' : '')),
        ed.layout === 'kana' ? (ed.kata ? '\u30ab\u30ca' : '\u304b\u306a') : T('SHIFT'));
      shift.dataset.op = 'shift';
      if (ed.layout === 'sym') shift.classList.add('off');
      r.appendChild(shift);
      for (const id of KB_ORDER) {
        const t = el('span', 'key tab' + (id === ed.layout ? ' on' : ''), KB[id].label);
        t.dataset.op = 'layout:' + id;
        r.appendChild(t);
      }
      const sp = el('span', 'key space', T('SPACE'));
      sp.dataset.op = 'space';
      const bs = el('span', 'key wide', T('ERASE'));
      bs.dataset.op = 'back';
      const cl = el('span', 'key wide', T('CLEAR ALL'));
      cl.dataset.op = 'clear';
      r.append(sp, bs, cl);
      kb.appendChild(r);
    }

    // One typed character: pinyin letters go to the buffer, jamo into the syllable, the rest as they are.
    function typeKey(ch) {
      if (ed.layout === 'zh' && /^[a-z']$/.test(ch)) {
        if (ch === '\'' && (!ed.py || ed.py.endsWith('\''))) return;
        if (ed.py.length < 24) ed.py += ch;
        ed.pyPage = 0;
        return;
      }
      commitPy();
      if (ed.layout === 'ko' && isJamo(ch)) {
        typeJamo(ch);
        ed.shift = false;
        return;
      }
      ed.hc = false;
      typeChar(ch);
    }

    // A key from the on-screen keyboard or a real one: a character, or an op.
    function press(ch, op) {
      if (ch) {
        typeKey(ch);
      } else if (op === 'shift') {
        if (ed.layout === 'kana') ed.kata = !ed.kata;
        else ed.shift = !ed.shift;
      } else if (op === 'space') {
        if (ed.py) {
          pickFirst();
        } else {
          ed.hc = false;
          if (ed.title && !ed.title.endsWith(' ') && ed.title.length < MAX_TITLE) ed.title += ' ';
        }
      } else if (op === 'back') {
        if (ed.py) {
          ed.py = ed.py.slice(0, -1);
          ed.pyPage = 0;
        } else if (!eraseJamo()) {
          ed.title = Array.from(ed.title).slice(0, -1).join('');
        }
      } else if (op === 'clear') {
        ed.title = '';
        endCompose();
      } else if (op.startsWith('layout:')) {
        commitPy();
        ed.hc = false;
        ed.layout = op.slice(7);
        ed.shift = false;
        renderKeyboard();
      } else if (op.startsWith('cand:')) {
        pickCand(op.slice(5));
      } else if (op === 'raw') {
        commitRaw();
      } else if (op.startsWith('pg:')) {
        ed.pyPage += +op.slice(3);
      }
      ed.tip = '';
      renderTitle();
      relabelKeys();
    }

    const keyOp = (k) => press(k.dataset.ch ? keyChar(k.dataset.ch) : '', k.dataset.op || '');

    // Keys respond on press; BACK repeats while held.
    let holdT = 0, holdI = 0;
    const stopHold = () => {
      clearTimeout(holdT);
      clearInterval(holdI);
    };
    $('kb').addEventListener('pointerdown', (e) => {
      const k = e.target.closest('.key');
      if (!k || k.classList.contains('blank') || k.classList.contains('off') || e.button !== 0) return;
      k.classList.add('down');
      setTimeout(() => k.classList.remove('down'), 120);
      keyOp(k);
      stopHold();
      if (k.dataset.op === 'back') holdT = setTimeout(() => { holdI = setInterval(() => keyOp(k), 70); }, 420);
    });
    document.addEventListener('pointerup', stopHold);

    // What is still being composed (pinyin letters, or the Hangul syllable) shows underlined after the title.
    function renderTitle() {
      let text = ed.title, comp = ed.py;
      if (!comp && ed.hc && text) {
        comp = text.slice(-1);
        text = text.slice(0, -1);
      }
      setText($('ed-text'), text);
      setText($('ed-comp'), comp);
      renderCand();
      $('ed-input').classList.toggle('empty', !ed.title && !ed.py);
      setText($('ed-count'), ed.title.length + ' / ' + MAX_TITLE);
      setText($('ed-tip'), ed.tip);
    }

    // A stepper: [<] value [>], repeating while held. One shared release handler for all of them.
    let stepT1 = 0, stepT2 = 0;
    const stepStop = () => {
      clearTimeout(stepT1);
      clearInterval(stepT2);
    };
    document.addEventListener('pointerup', stepStop);
    function stepper(get, step, fmt) {
      const box = el('span', 'stp');
      const v = el('span', 'stp-v');
      const mk = (dir) => {
        const b = el('span', 'stp-b' + (dir < 0 ? ' l' : ''));
        b.appendChild(el('span', 'chev'));
        const fire = () => {
          step(dir);
          setText(v, fmt(get()));
          refreshRows();
        };
        b.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          stepStop();
          fire();
          stepT1 = setTimeout(() => { stepT2 = setInterval(fire, 90); }, 420);
        });
        b.addEventListener('pointerleave', stepStop);
        return b;
      };
      v.textContent = fmt(get());
      box.append(mk(-1), v, mk(1));
      box._sync = () => setText(v, fmt(get()));
      return box;
    }

    // A row of chips; multi = toggles (days of the week).
    function chips(opts, isOn, pick) {
      const box = el('span', 'ed-chips');
      for (const o of opts) {
        const c = el('span', 'chip', o[2] ? o[1] : T(o[1]));
        c.dataset.v = String(o[0]);
        c.addEventListener('click', () => {
          pick(o[0]);
          refreshRows();
        });
        box.appendChild(c);
      }
      box._sync = () => {
        for (const c of box.children) {
          const o = opts.find((x) => String(x[0]) === c.dataset.v);
          c.classList.toggle('on', !!o && isOn(o[0]));
        }
      };
      return box;
    }

    let rowSyncs = [];
    function refreshRows() {
      for (const f of rowSyncs) f();
    }

    function edRow(label, ctl, cls) {
      const r = el('div', 'ed-row' + (cls ? ' ' + cls : ''));
      r.append(el('span', 'ed-lbl', T(label)), ctl);
      if (ctl._sync) rowSyncs.push(ctl._sync);
      return r;
    }

    const clampMin = (m) => Math.max(0, Math.min(1435, m));
    const fmtH = (m) => (cfg.clock24 ? pad(Math.floor(m / 60)) : hm(Math.floor(m / 60) * 60).replace(/:00/, ''));

    function timeCtl(get, set, allowEnd) {
      const box = el('span', 'ed-time');
      const max = allowEnd ? 1440 : 1435;
      // Hours wrap round the clock; an end time can also be 24:00 (midnight at the end of the day).
      const hh = stepper(get, (d) => {
        let m = get() + d * 60;
        if (allowEnd) m = m > 1440 ? m - 1440 : m < 0 ? m + 1440 : m;
        else m = (m + 1440) % 1440;
        set(Math.min(max, m));
      }, (m) => (m >= 1440 ? '24' : fmtH(m)));
      const mm = stepper(get, (d) => {
        const m = get(), h = Math.floor(m / 60);
        set(Math.min(max, h * 60 + (((m % 60) + d * 5) % 60 + 60) % 60));
      }, (m) => pad(m % 60));
      box.append(hh, el('span', 'ed-colon', ':'), mm);
      box._sync = () => {
        hh._sync();
        mm._sync();
        box.classList.toggle('dim', !!box._dim && box._dim());
      };
      return box;
    }

    function openEditor(kind, rec, day, preset) {
      const lang = I18N.code;
      ed.open = true;
      ed.kind = kind;
      ed.rec = rec;
      ed.armDel = 0;
      ed.shift = false;
      ed.kata = false;
      ed.tip = '';
      ed.layout = KB_DEFAULT[lang] || 'abc';
      endCompose();
      if (kind === 'cal') {
        const d = day || midnight(Date.now());
        ed.v = rec ? JSON.parse(JSON.stringify(rec)) : { id: '', title: '', date: keyOf(d), time: '', rep: 'none', rem: 0 };
      } else {
        ed.v = rec ? JSON.parse(JSON.stringify(rec)) : Object.assign({ id: '', title: '', days: [1, 2, 3, 4, 5], start: '09:00', end: '10:00', rem: -1 }, preset || {});
      }
      ed.title = ed.v.title;
      setText($('ed-head'), rec ? (kind === 'cal' ? T('EDIT ENTRY') : T('EDIT ACTIVITY')) : (kind === 'cal' ? T('NEW ENTRY') : T('NEW ACTIVITY')));
      setText($('ed-kind'), kind === 'cal' ? T('CALENDAR') : T('WEEKLY SCHEDULE'));
      $('ed-del').style.display = rec ? '' : 'none';
      setText($('ed-del'), T('DELETE'));
      syncKb();
      api.pingHelper(); // its answer shows or hides the on-screen keyboard (helperChanged); nothing while switched off

      const pre = $('ed-presets');
      pre.textContent = '';
      for (const p of kind === 'cal' ? CAL_PRESETS : SCH_PRESETS) {
        const c = el('span', 'chip', T(p));
        c.addEventListener('click', () => {
          ed.title = T(p);
          endCompose();
          ed.tip = '';
          renderTitle();
        });
        pre.appendChild(c);
      }

      const rows = $('ed-rows');
      rows.textContent = '';
      rowSyncs = [];
      const v = ed.v;
      if (kind === 'cal') {
        const dateBox = el('span', 'ed-date');
        const dayStep = stepper(() => v.date, (d) => { v.date = keyOf(addDays(parseKey(v.date), d)); }, (k) => longDay(parseKey(k)));
        const monStep = stepper(() => v.date, (d) => {
          const s = parseKey(v.date);
          const t = new Date(s.getFullYear(), s.getMonth() + d, 1);
          v.date = keyOf(new Date(t.getFullYear(), t.getMonth(), Math.min(s.getDate(), daysIn(t.getFullYear(), t.getMonth()))));
        }, () => T('MONTH'));
        monStep.classList.add('small');
        dateBox.append(dayStep, monStep);
        dateBox._sync = () => {
          dayStep._sync();
          monStep._sync();
        };
        rows.appendChild(edRow(K('DATE'), dateBox, 'span2'));
        let lastTime = v.time || '18:00';
        const allDay = chips([[1, K('ALL DAY')]], () => !v.time, () => {
          if (v.time) {
            lastTime = v.time;
            v.time = '';
          } else {
            v.time = lastTime;
          }
        });
        const tm = timeCtl(() => minsOf(v.time || lastTime), (m) => { v.time = hmOf(clampMin(m)); }, false);
        tm._dim = () => !v.time;
        const timeBox = el('span', 'ed-pair');
        timeBox.append(allDay, tm);
        timeBox._sync = () => {
          allDay._sync();
          tm._sync();
        };
        rows.appendChild(edRow(K('TIME'), timeBox));
        rows.appendChild(edRow(K('REPEAT'), chips(REPEATS, (x) => v.rep === x, (x) => { v.rep = x; })));
        rows.appendChild(edRow(K('ALERT'), chips(CAL_REMIND, (x) => v.rem === x, (x) => { v.rem = x; }), 'span2'));
      } else {
        const ws = weekStart();
        const dayOpts = Array.from({ length: 7 }, (_, i) => [(ws + i) % 7, DOW[(ws + i) % 7]]);
        const daysBox = el('span', 'ed-pair');
        const dayChips = chips(dayOpts, (x) => v.days.includes(x), (x) => {
          v.days = v.days.includes(x) ? v.days.filter((y) => y !== x) : v.days.concat([x]).sort();
        });
        const quick = chips([['wd', K('WEEKDAYS')], ['we', K('WEEKEND')], ['all', K('EVERY DAY')]], (x) => {
          const s = v.days.slice().sort().join('');
          return (x === 'wd' && s === '12345') || (x === 'we' && s === '06') || (x === 'all' && s === '0123456');
        }, (x) => { v.days = x === 'wd' ? [1, 2, 3, 4, 5] : x === 'we' ? [0, 6] : [0, 1, 2, 3, 4, 5, 6]; });
        quick.classList.add('quick');
        daysBox.append(dayChips, quick);
        daysBox._sync = () => {
          dayChips._sync();
          quick._sync();
        };
        rows.appendChild(edRow(K('DAYS'), daysBox, 'span2'));
        rows.appendChild(edRow(K('START TIME'), timeCtl(() => minsOf(v.start), (m) => { v.start = hmOf(clampMin(m)); }, false)));
        rows.appendChild(edRow(K('END TIME'), timeCtl(() => minsOf(v.end), (m) => { v.end = hmOf(Math.max(0, Math.min(1440, m))); }, true)));
        rows.appendChild(edRow(K('ALERT'), chips(SCH_REMIND, (x) => v.rem === x, (x) => { v.rem = x; }), 'span2'));
      }
      refreshRows();
      renderKeyboard();
      renderTitle();
      $('place-main').classList.add('editing');
      const box = $('pl-edit');
      box.classList.remove('show');
      void box.offsetWidth;
      box.classList.add('show');
    }

    // The on-screen keyboard: always, never, or (auto) only while YoRHa Helper is not running to offer the real one.
    const kbShown = () => cfg.oskb === 'on' || (cfg.oskb !== 'off' && !api.helperOnline());
    function syncKb() {
      const show = kbShown();
      $('pl-edit').classList.toggle('no-kb', !show);
      $('pl-edit').classList.toggle('helper', api.helperOnline());
      let hint = '';
      if (!show && !api.helperOnline()) hint = T('The on-screen keyboard is hidden. Turn it on in SYSTEM > QUICK SETTINGS, or set up YoRHa Helper (SYSTEM > YORHA HELPER).');
      setText($('ed-ime'), hint);
    }

    function closeEditor() {
      if (!ed.open) return;
      ed.open = false;
      stopHold();
      $('pl-edit').classList.remove('show');
      $('place-main').classList.remove('editing');
    }

    function saveEditor() {
      commitPy();
      ed.hc = false;
      const v = ed.v;
      v.title = cleanTitle(ed.title);
      if (!v.title) {
        ed.tip = T('Type a title, or pick one of the suggestions.');
        renderTitle();
        return;
      }
      if (ed.kind === 'sched') {
        if (!v.days.length) {
          ed.tip = T('Choose at least one day.');
          renderTitle();
          return;
        }
        if (minsOf(v.end) === minsOf(v.start)) {
          ed.tip = T('The end time must differ from the start.');
          renderTitle();
          return;
        }
      }
      const list = ed.kind === 'cal' ? data.events : data.items;
      if (!v.id) {
        v.id = newId(ed.kind === 'cal' ? 'e' : 's');
        list.push(v);
      } else {
        const i = list.findIndex((x) => x.id === v.id);
        if (i >= 0) list[i] = v;
        else list.push(v);
        // An edited reminder may come round again today.
        for (const k in alerts.fired) if (k.indexOf(':' + v.id + '@') > 0) delete alerts.fired[k];
        alerts.list = alerts.list.filter((a) => a.id !== v.id);
        savePending();
      }
      if (ed.kind === 'cal') {
        saveEvents();
        cal.sel = v.date;
        const d = parseKey(v.date);
        cal.y = d.getFullYear();
        cal.m = d.getMonth();
        api.say('Confirmation', T('Calendar entry saved: {title}.', { title: v.title }));
      } else {
        saveItems();
        api.say('Confirmation', T('Activity saved: {title}.', { title: v.title }));
      }
      closeEditor();
      afterChange();
    }

    function deleteEditor() {
      const now = Date.now();
      if (now > ed.armDel) {
        ed.armDel = now + 4000;
        setText($('ed-del'), T('CONFIRM?'));
        setTimeout(() => { if (ed.open && Date.now() > ed.armDel) setText($('ed-del'), T('DELETE')); }, 4100);
        return;
      }
      const id = ed.v.id;
      if (ed.kind === 'cal') {
        data.events = data.events.filter((x) => x.id !== id);
        saveEvents();
      } else {
        data.items = data.items.filter((x) => x.id !== id);
        saveItems();
      }
      alerts.list = alerts.list.filter((a) => a.id !== id);
      savePending();
      api.say('Report', T('Entry deleted: {title}.', { title: ed.v.title }));
      closeEditor();
      afterChange();
    }

    // TYPE ON PC KEYBOARD: YoRHa Helper opens a text box on this PC and hands back what was typed there.
    // With the helper running, clicking the title field does the same.
    $('ed-input').addEventListener('click', () => { if (api.helperOnline()) $('ed-pc').click(); });
    $('ed-pc').addEventListener('click', () => {
      if (!ed.open || ed.waiting) return;
      commitPy();
      ed.hc = false;
      ed.waiting = true;
      $('ed-pc').classList.add('off');
      ed.tip = T('Type in the window that opened, then press Enter.');
      renderTitle();
      api.ask(T(ed.kind === 'cal' ? 'CALENDAR' : 'WEEKLY SCHEDULE') + ' // ' + T('TITLE'), ed.title, MAX_TITLE).then((res) => {
        ed.waiting = false;
        $('ed-pc').classList.remove('off');
        if (!ed.open) return;
        ed.tip = res.off ? T('YoRHa Helper is off. Setup steps and the switch: SYSTEM > YORHA HELPER.')
          : res.offline ? T('YoRHa Helper is not running. Setup steps: SYSTEM > YORHA HELPER.') : '';
        if (typeof res.text === 'string') {
          ed.title = cleanTitle(res.text);
          endCompose();
        }
        renderTitle();
        relabelKeys();
      });
    });

    $('ed-save').addEventListener('click', saveEditor);
    $('ed-cancel').addEventListener('click', closeEditor);
    $('ed-del').addEventListener('click', deleteEditor);

    // Typing on a real keyboard, where keys arrive (a browser preview). Runs before the page's own Esc handler.
    // The Korean and Chinese layouts work as their IMEs do: QWERTY letters type jamo (2-set) or pinyin;
    // while pinyin is pending, 1-8 pick a candidate, - and = turn the page, Enter keeps the letters.
    const QWERTY = 'qwertyuiopasdfghjklzxcvbnm';
    const ZH_PUNCT = { ',': 0xff0c, '.': 0x3002, '?': 0xff1f, '!': 0xff01, ':': 0xff1a, ';': 0xff1b };
    window.addEventListener('keydown', (e) => {
      if (!ed.open) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key;
      if (key === 'Escape') closeEditor();
      else if (key === 'Enter' && ed.py) press('', 'raw');
      else if (key === 'Enter') saveEditor();
      else if (key === 'Backspace') press('', 'back');
      else if (key === ' ') press('', 'space');
      else if (ed.py && /^[1-8]$/.test(key)) {
        const ch = pySeg().chars[ed.pyPage * PY_PAGE + (+key - 1)];
        if (ch) press('', 'cand:' + ch);
      } else if (ed.py && (key === '-' || key === '=')) press('', key === '-' ? 'pg:-1' : 'pg:1');
      else if (ed.layout === 'ko' && QWERTY.includes(key.toLowerCase()) && key.length === 1) {
        const jamo = KB.ko.rows.slice(1).flat()[QWERTY.indexOf(key.toLowerCase())];
        const c = jamo.charCodeAt(0);
        press(key !== key.toLowerCase() && KO_SHIFT[c] ? String.fromCharCode(KO_SHIFT[c]) : jamo, '');
      } else if (ed.layout === 'zh' && ZH_PUNCT[key]) press(String.fromCharCode(ZH_PUNCT[key]), '');
      else if (key.length === 1) press(key, '');
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    function afterChange() {
      cal.sig = '';
      sch.sig = '';
      agenda.sig = '';
      if (nav.place === 'quests') refresh(nav.sel, Date.now(), true);
      renderAgenda(Date.now(), true);
    }

    // ---------- glue ----------

    function refresh(sel, now, force) {
      if (sel === 'calendar') renderCalendar(now, force);
      else if (sel === 'schedule') renderSchedule(now, force);
    }

    function apply() {
      if (ed.open) syncKb();
      syncProps();
      cal.sig = '';
      sch.sig = '';
      agenda.sig = '';
      if (!cfg.calAlerts && alerts.list.length) {
        alerts.list = [];
        savePending();
      }
      renderAgenda(Date.now(), true);
      renderCard(Date.now(), true);
    }

    function relabel() {
      apply();
      if (ed.open) {
        renderKeyboard();
        renderTitle();
      }
    }

    syncProps();

    return {
      tick: tick,
      refresh: refresh,
      apply: apply,
      relabel: relabel,
      hubLine: hubLine,
      alertTitle: alertTitle,
      editing: () => ed.open,
      leave: closeEditor,
      helperChanged: () => { if (ed.open) syncKb(); },
      showHub: () => renderAgenda(Date.now(), true) // back on the desktop: lay the agenda out while it is visible
    };
  };
})();
