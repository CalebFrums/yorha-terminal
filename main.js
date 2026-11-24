/* YoRHa Terminal -- fan-made NieR:Automata style web wallpaper for Wallpaper Engine.
   Everything is drawn procedurally (CSS + canvas); no game assets are used. */
(function () {
  'use strict';

  // ---------- config ----------

  const I18N = window.YoRHaI18N;
  const T = (k, v) => I18N.t(k, v); // translate (English text is the key)
  const TN = (n, k, v) => I18N.n(n, k, v); // translate with a plural form: TN(3, '{n} DAY|{n} DAYS')
  const K = (k) => k; // marks text for the translation catalog; it is translated where it is shown

  const cfg = {
    language: 'auto',
    theme: 'light',
    layout: 'left',
    unitName: '2B',
    footerText: 'Glory to Mankind',
    clock24: true,
    showSeconds: true,
    uiScale: 100,
    showMenu: true,
    autoCycle: 12,
    startPanel: 'map',
    showLog: true,
    logInterval: 40,
    showViz: true,
    vizHeight: 12,
    particles: 70,
    scanlines: true,
    glitch: true,
    parallax: true,
    imagePath: '',
    videoPath: '',
    imagePlacement: 'both',
    imageFilter: 'nier',
    bgWash: 30,
    charInterval: 20,
    charShuffle: false,
    charMode: 'stand',
    showcaseSize: 100,
    emoteFreq: 5,
    emoteLines: 'Glory to Mankind.|...|Hm.|Systems nominal.|Is something wrong?|Proceeding with the mission.',
    hubReturn: 120,
    dailyOrders: 'Drink some water|Stretch for five minutes|Back up your save data|Finish one task you have been avoiding',
    audioLog: 'keep',
    dayStart: 7,
    nightStart: 19,
    audioGain: 100,
    audioAuto: true,
    wellness: false,
    eyesEvery: 20,
    waterEvery: 60,
    stretchEvery: 45,
    postureEvery: 0,
    mealTimes: '08:00|12:30|18:30',
    calAlerts: true,
    calSound: true,
    calWidget: 'auto',
    weekStart: 'auto',
    calEntries: '',
    schedEntries: '',
    helper: false, // YoRHa Helper: off until the user reads the disclaimer and switches it on
    oskb: 'auto'
  };
  // Shipped defaults. Default text (footer, lines, orders) is shown translated until the user edits it.
  const DEFAULTS = Object.assign({}, cfg);
  K('Glory to Mankind'); K('Glory to Mankind.'); K('Hm.'); K('Systems nominal.'); K('Is something wrong?');
  K('Proceeding with the mission.'); K('Drink some water'); K('Stretch for five minutes');
  K('Back up your save data'); K('Finish one task you have been avoiding');

  // project.json property key -> cfg field
  const PROP_MAP = {
    language: 'language',
    audiolog: 'audioLog',
    daystart: 'dayStart',
    nightstart: 'nightStart',
    theme: 'theme',
    layout: 'layout',
    unitname: 'unitName',
    footertext: 'footerText',
    clock24: 'clock24',
    showseconds: 'showSeconds',
    uiscale: 'uiScale',
    showmenu: 'showMenu',
    autocycle: 'autoCycle',
    startpanel: 'startPanel',
    showlog: 'showLog',
    loginterval: 'logInterval',
    showviz: 'showViz',
    vizheight: 'vizHeight',
    particles: 'particles',
    scanlines: 'scanlines',
    glitch: 'glitch',
    parallax: 'parallax',
    customimage: 'imagePath',
    customvideo: 'videoPath',
    imageplacement: 'imagePlacement',
    imagefilter: 'imageFilter',
    bgwash: 'bgWash',
    charinterval: 'charInterval',
    charshuffle: 'charShuffle',
    charmode: 'charMode',
    showcasesize: 'showcaseSize',
    emotefreq: 'emoteFreq',
    emotelines: 'emoteLines',
    hubreturn: 'hubReturn',
    dailyorders: 'dailyOrders',
    audiogain: 'audioGain',
    audioauto: 'audioAuto',
    wellness: 'wellness',
    eyesevery: 'eyesEvery',
    waterevery: 'waterEvery',
    stretchevery: 'stretchEvery',
    postureevery: 'postureEvery',
    mealtimes: 'mealTimes',
    calalerts: 'calAlerts',
    calsound: 'calSound',
    calwidget: 'calWidget',
    weekstart: 'weekStart',
    calendarentries: 'calEntries',
    scheduleentries: 'schedEntries',
    yorhahelper: 'helper',
    onscreenkeyboard: 'oskb'
  };

  const PANELS = ['map', 'quests', 'intel', 'archive', 'unit', 'hacking', 'garden', 'system'];
  const PANEL_SUB = {
    map: K('ORBITAL OVERVIEW'),
    quests: K('OPERATION PROGRESS'),
    intel: K('AUDIO LOG'),
    archive: K('VISUAL RECORD'),
    unit: K('MAINTENANCE BAY'),
    hacking: K('INTRUSION DRILLS'),
    garden: K('LUNAR TEAR FIELD'),
    system: K('UNIT DIAGNOSTICS')
  };
  const DAYS = [K('SUNDAY'), K('MONDAY'), K('TUESDAY'), K('WEDNESDAY'), K('THURSDAY'), K('FRIDAY'), K('SATURDAY')];
  const MONTHS = [K('JANUARY'), K('FEBRUARY'), K('MARCH'), K('APRIL'), K('MAY'), K('JUNE'), K('JULY'),
    K('AUGUST'), K('SEPTEMBER'), K('OCTOBER'), K('NOVEMBER'), K('DECEMBER')];
  const MONTHS_SHORT = [K('JAN'), K('FEB'), K('MAR'), K('APR'), K('MAY'), K('JUN'), K('JUL'),
    K('AUG'), K('SEP'), K('OCT'), K('NOV'), K('DEC')];
  // Canvas text follows the page font stack, which gains CJK fallbacks per language (style.css).
  let canvasFontFor = '', canvasFontStack = '';
  function canvasFont() {
    if (canvasFontFor !== I18N.code || !canvasFontStack) {
      canvasFontFor = I18N.code;
      canvasFontStack = getComputedStyle(document.body).getPropertyValue('--font').trim() ||
        '"Bahnschrift Light", "Bahnschrift", "Segoe UI", sans-serif';
    }
    return canvasFontStack;
  }
  const ORBIT_SPEED = 0.22; // rad/s of the Bunker marker

  // ---------- helpers ----------

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  const unit = () => (String(cfg.unitName || '').trim().slice(0, 24) || '2B');

  function setText(el, s) {
    if (el._t !== s) {
      el._t = s;
      el.textContent = s;
    }
  }

  // Fit a title to its box: shrink it on one line first (COMMANDER WHITE); names too long for that
  // (RED-HOODED RESISTANCE MEMBER) wrap onto two lines instead of shrinking to nothing.
  function fitText(el) {
    const key = el.textContent + '|' + el.clientWidth;
    if (el._fit === key) return;
    el._fit = key;
    el.style.fontSize = '';
    el.classList.remove('two-line');
    const w = el.clientWidth;
    if (!w || el.scrollWidth <= w) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    const one = Math.floor(size * w / el.scrollWidth * 0.97);
    if (one >= size * 0.62) {
      el.style.fontSize = one + 'px';
      return;
    }
    el.classList.add('two-line');
    for (let f = Math.floor(size * 0.75); f >= size * 0.4; f--) {
      el.style.fontSize = f + 'px';
      const lh = parseFloat(getComputedStyle(el).lineHeight) || f * 1.1;
      if (el.scrollWidth <= w && el.scrollHeight <= lh * 2 + 2) return;
    }
  }
  const fitNames = () => ['d-name', 'arc-name', 'loc-name'].forEach((id) => fitText($(id)));

  // maxW caps the backing store width (big full-screen canvases on 4K+ screens).
  function fitCanvas(c, maxW) {
    let k = dpr();
    if (maxW && c.clientWidth * k > maxW) k = maxW / c.clientWidth;
    const w = Math.max(1, Math.round(c.clientWidth * k));
    const h = Math.max(1, Math.round(c.clientHeight * k));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }

  // 12-hour times use the language's own AM/PM words and order (Japanese, Chinese and Korean put the
  // period first) from the browser's Intl data; plain English AM/PM if Intl is missing.
  let h12Fmt = null, h12For = null;
  function h12() {
    if (h12For !== I18N.html) {
      h12For = I18N.html;
      try {
        h12Fmt = new Intl.DateTimeFormat(I18N.html, { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch (e) {
        h12Fmt = null;
      }
    }
    return h12Fmt;
  }
  const ODD_SPACES = new RegExp('[' + String.fromCharCode(0xa0, 0x202f) + ']', 'g'); // no-break spaces some locales use
  const plainSpaces = (s) => s.replace(ODD_SPACES, ' ');

  function timeHM(d) {
    if (cfg.clock24) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    const f = h12();
    if (f) return plainSpaces(f.format(d));
    return (d.getHours() % 12 || 12) + ':' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM');
  }

  // The AM/PM word alone, for the big clock, and whether the language puts it before the hour.
  function dayPeriod(d) {
    const f = h12();
    if (f && f.formatToParts) {
      const parts = f.formatToParts(d);
      const i = parts.findIndex((x) => x.type === 'dayPeriod');
      if (i >= 0) return { text: plainSpaces(parts[i].value).trim(), lead: i < parts.findIndex((x) => x.type === 'hour') };
    }
    return { text: d.getHours() < 12 ? 'AM' : 'PM', lead: false };
  }

  function fmtDuration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return T('{d}D {h}H {m}M', { d: d, h: pad(h), m: pad(m) });
    return pad(h) + ':' + pad(m) + ':' + pad(s % 60);
  }

  function fmtTrack(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = pad(sec % 60);
    return h > 0 ? h + ':' + pad(m) + ':' + s : m + ':' + s;
  }

  // Wallpaper Engine can hand over paths that are already URL-encoded ("C%3A/Program%20Files/...",
  // seen for a character folder inside the wallpaper's own project). Decode those once, so they are
  // not mistaken for page-relative paths and encoded a second time.
  function plainPath(p) {
    p = String(p || '');
    if (!/%[0-9a-f]{2}/i.test(p) || /^(https?|file):/i.test(p)) return p;
    try {
      return decodeURIComponent(p);
    } catch (e) {
      return p;
    }
  }

  // Wallpaper Engine hands over a filesystem path; turn it into a file URL.
  // Paths without a drive or a leading slash (the bundled character set) stay relative to the page.
  function fileUrl(p) {
    if (!p) return '';
    if (/^(https?|file):/i.test(p)) return p;
    p = plainPath(p);
    if (!/^([a-z]:|[\\/])/i.test(p)) return encodeURI(String(p).replace(/\\/g, '/')).replace(/#/g, '%23');
    const norm = String(p).replace(/\\/g, '/').replace(/^\/+/, '');
    const enc = /%[0-9a-f]{2}/i.test(norm) ? norm : encodeURI(norm).replace(/#/g, '%23');
    return 'file:///' + enc;
  }

  function baseName(p) {
    let name = String(p).split(/[\\/]/).pop() || '';
    try { name = decodeURIComponent(name); } catch (e) { /* keep raw name */ }
    return name;
  }

  const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fmtMS = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  };
  const shortDate = (t) => {
    const d = new Date(t);
    return T('{day} {mon}', { day: pad(d.getDate()), mon: T(MONTHS_SHORT[d.getMonth()]) }) + '  ' + timeHM(d);
  };

  // localStorage can be missing or blocked; everything stored is optional.
  const store = {
    get(key, def) {
      try {
        const raw = window.localStorage.getItem('yorha.' + key);
        return raw === null ? def : JSON.parse(raw);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try { window.localStorage.setItem('yorha.' + key, JSON.stringify(val)); } catch (e) { /* not persisted */ }
    }
  };

  // Values from Wallpaper Engine (or defaults) live in base; quick settings made inside the
  // wallpaper are overrides on top, until the same property is changed in Wallpaper Engine.
  const base = Object.assign({}, cfg);
  const overrides = store.get('overrides', {});
  for (const f in overrides) if (f in cfg) cfg[f] = overrides[f];

  function setOverride(field, value) {
    if (value === undefined || value === base[field]) delete overrides[field];
    else overrides[field] = value;
    store.set('overrides', overrides);
    cfg[field] = field in overrides ? overrides[field] : base[field];
    applyConfig();
  }

  // ---------- state ----------

  const state = {
    paused: false,
    fpsLimit: 0,
    fps: 0,
    panel: '',
    manualUntil: 0,
    lastCycle: Date.now(),
    started: Date.now(),
    mouseX: 0,
    mouseY: 0,
    parX: 0,
    parY: 0,
    themeSet: false,
    themeCheck: 0,
    colors: { ink: '78, 75, 66', dust: '255, 253, 242', accent: '185, 83, 59', paper: '218, 212, 187', hl: '#dad4bb' }
  };

  const audio = {
    hasApi: typeof window.wallpaperRegisterAudioListener === 'function',
    raw: new Float32Array(128),
    smooth: new Float32Array(128),
    peaks: new Float32Array(128),
    lastSignal: 0,
    lastIn: 0,
    peak: 0, // slow-decaying peak of the incoming signal (auto boost)
    auto: 1, // current auto boost
    gain: 1, // total gain applied (sensitivity x auto boost)
    level: 0,
    history: new Float32Array(240), // 60 s sampled at 4 Hz
    histHead: 0
  };

  // Hub navigation: place '' is the hub; sel is the active sub-menu entry inside a place.
  const nav = { place: '', sel: '', sub: {}, items: [], lastInput: Date.now(), transit: 0 };

  const hasMediaApi = typeof window.wallpaperRegisterMediaPropertiesListener === 'function';
  const media = { enabled: null, title: '', artist: '', album: '', type: '', state: -1, pos: 0, dur: 0, at: 0 };

  function playbackConst(name, fallback) {
    const mi = window.wallpaperMediaIntegration;
    if (mi) {
      if (mi['PLAYBACK_' + name] !== undefined) return mi['PLAYBACK_' + name];
      if (mi.playback && mi.playback[name] !== undefined) return mi.playback[name];
    }
    return fallback;
  }
  const isPlaying = () => media.state === playbackConst('PLAYING', 1);

  // ---------- element refs ----------

  const els = {
    ui: $('ui'),
    grid: $('grid'),
    hm: $('clock-hm'),
    sec: $('clock-s'),
    ampm: $('clock-ampm'),
    date: $('date-text'),
    cursor: $('cursor'),
    panelBody: $('panel-body'),
    podBox: $('pod-lines')
  };
  const menuItems = Array.from(document.querySelectorAll('#menu li[data-panel]'));
  const questEls = {};
  for (const id of ['q-day', 'q-week', 'q-month', 'q-year']) {
    const q = $(id);
    questEls[id] = { pct: q.querySelector('.q-pct'), fill: q.querySelector('.fill'), rem: q.querySelector('.q-rem') };
  }

  // ---------- theme / config ----------

  function readColors() {
    const cs = getComputedStyle(document.body);
    state.colors.ink = cs.getPropertyValue('--ink-rgb').trim() || state.colors.ink;
    state.colors.dust = cs.getPropertyValue('--dust-rgb').trim() || state.colors.dust;
    state.colors.accent = cs.getPropertyValue('--accent-rgb').trim() || state.colors.accent;
    state.colors.paper = cs.getPropertyValue('--paper-rgb').trim() || state.colors.paper;
    state.colors.hl = cs.getPropertyValue('--hl-text').trim() || state.colors.hl;
  }

  // Theme 'auto' follows the clock: daylight from dayStart until nightStart.
  function isNight(d) {
    const h = d.getHours() + d.getMinutes() / 60;
    const a = clamp(cfg.dayStart, 0, 23), z = clamp(cfg.nightStart, 0, 24);
    if (a === z) return false;
    return a < z ? (h < a || h >= z) : (h >= z && h < a);
  }
  const effectiveTheme = () => (cfg.theme === 'auto' ? (isNight(new Date()) ? 'dark' : 'light') : (cfg.theme === 'dark' ? 'dark' : 'light'));

  function applyTheme(announce) {
    const b = document.body;
    const dark = effectiveTheme() === 'dark';
    if (state.themeSet && b.classList.contains('theme-dark') === dark) return;
    const switched = state.themeSet;
    state.themeSet = true;
    b.classList.toggle('theme-dark', dark);
    readColors();
    if (announce && switched && cfg.theme === 'auto') {
      say('Report', dark ? T('Night cycle engaged. Display dimmed.') : T('Day cycle engaged. Display brightened.'));
    }
  }

  // Language: 'auto' follows the browser's language list. A language file loads the first time it is used.
  let langWant = '';
  function syncLanguage() {
    const code = I18N.resolve(cfg.language);
    if (code === langWant) return;
    langWant = code;
    I18N.use(code, () => relabel());
  }

  const footerLabel = () => (cfg.footerText === DEFAULTS.footerText ? T(DEFAULTS.footerText) : String(cfg.footerText || '').slice(0, 80));

  function applyConfig() {
    const b = document.body;
    syncLanguage();
    applyTheme(false);
    syncAudioLog();
    syncWellness();
    planner.apply();
    syncHelper();
    b.classList.toggle('layout-right', cfg.layout === 'right');
    b.classList.toggle('no-seconds', !cfg.showSeconds);
    b.classList.toggle('no-menu', !cfg.showMenu);
    b.classList.toggle('no-log', !cfg.showLog);
    b.classList.toggle('no-viz', !cfg.showViz);
    b.classList.toggle('no-scanlines', !cfg.scanlines);
    document.documentElement.style.setProperty('--scale', String(clamp(cfg.uiScale, 50, 160) / 100));

    // vmin keeps the visualizer the same on landscape screens and sane on portrait ones.
    const vizH = clamp(cfg.vizHeight, 3, 40);
    $('viz').style.display = cfg.showViz ? '' : 'none';
    $('viz').style.height = vizH + 'vmin';
    $('rightcol').style.paddingBottom = cfg.showViz ? 'calc(' + vizH + 'vmin + 1.7rem)' : '';
    $('fx').style.display = cfg.particles > 0 ? '' : 'none';

    setText($('unit-label'), T('UNIT {u}', { u: unit().toUpperCase() }));
    setText($('footer-text'), footerLabel());
    if (!cfg.showLog) pod.queue.length = 0;
    if (!cfg.parallax) {
      els.ui.style.transform = '';
      els.grid.style.transform = '';
    }

    readColors();
    syncParticles();
    applyImages();
    applyGallery();
    positionCursor();
    fitNames();
    if (nav.place) {
      positionSideCursor();
      refreshPlace(Date.now(), true);
    }
  }

  function applyImages() {
    const img = fileUrl(cfg.imagePath);
    const vid = fileUrl(cfg.videoPath);
    const bgImgOn = !!img && !vid && cfg.imagePlacement !== 'archive';
    const archOn = !!img && cfg.imagePlacement !== 'background';
    const bgImage = $('bg-image');
    const bgVideo = $('bg-video');

    if (vid) {
      if (bgVideo.dataset.src !== vid) {
        bgVideo.dataset.src = vid;
        bgVideo.src = vid;
      }
      bgVideo.classList.add('on');
      const pr = bgVideo.play();
      if (pr && pr.catch) pr.catch(() => {});
    } else if (bgVideo.dataset.src) {
      bgVideo.pause();
      bgVideo.removeAttribute('src');
      bgVideo.load();
      delete bgVideo.dataset.src;
      bgVideo.classList.remove('on');
    }

    if (bgImgOn) {
      if (bgImage.dataset.src !== img) {
        bgImage.dataset.src = img;
        bgImage.src = img;
      }
      bgImage.classList.add('on');
    } else {
      bgImage.classList.remove('on');
    }
    document.body.classList.toggle('has-bg', !!vid || bgImgOn);

    const frame = $('archive-frame');
    for (const [imgId, frameId, capId] of [['archive-img', 'archive-frame', 'archive-caption'], ['pa-img', 'pa-frame', 'pa-caption']]) {
      const arch = $(imgId);
      if (archOn) {
        if (arch.dataset.src !== img) {
          arch.dataset.src = img;
          arch.src = img;
        }
        $(frameId).classList.add('has-img');
        setText($(capId), T('VISUAL RECORD // {name}', { name: baseName(cfg.imagePath).toUpperCase() }));
      } else {
        $(frameId).classList.remove('has-img');
        setText($(capId), T('VISUAL RECORD // NONE'));
      }
    }

    const filter = 'filter-' + (['nier', 'mono', 'original'].includes(cfg.imageFilter) ? cfg.imageFilter : 'nier');
    for (const el of [$('bg-layer'), frame, $('m-thumb-frame'), $('dossier-art'), $('showcase'),
      $('pa-frame'), $('pm-thumb-frame'), $('arc-art'), $('arc-grid'), $('un-mini'), $('bay-fig'), $('wd-fig'), $('wd-outfits'), $('wd-acc')]) {
      el.classList.remove('filter-nier', 'filter-mono', 'filter-original');
      el.classList.add(filter);
    }
    $('bg-wash').style.opacity = String(clamp(cfg.bgWash, 0, 90) / 100);
  }

  $('bg-image').addEventListener('error', () => {
    if (!cfg.imagePath) return;
    $('bg-image').classList.remove('on');
    document.body.classList.toggle('has-bg', !!cfg.videoPath);
    say('Alert', T('Visual record could not be loaded. Check the image path.'));
  });
  $('bg-video').addEventListener('error', () => {
    if (!cfg.videoPath) return;
    say('Alert', T('Video record could not be decoded. Only .webm is supported.'));
  });

  const hasArchiveImage = () => gallery.files.length > 0 || (!!cfg.imagePath && cfg.imagePlacement !== 'background');

  // ---------- panels ----------

  function setPanel(name, manual) {
    if (!PANELS.includes(name)) name = 'map';
    state.lastCycle = Date.now();
    if (manual) state.manualUntil = Date.now() + 60000;
    if (name === state.panel) return;
    const first = !state.panel;
    state.panel = name;
    for (const li of menuItems) li.classList.toggle('active', li.dataset.panel === name);
    for (const p of PANELS) $('view-' + p).classList.toggle('active', p === name);
    setText($('panel-title'), T(PLACES[name].title));
    setText($('panel-sub'), T(PANEL_SUB[name]));
    const body = els.panelBody;
    body.classList.remove('switching');
    if (!first) {
      void body.offsetWidth; // restart the flicker animation
      body.classList.add('switching');
    }
    positionCursor();
    refreshPanel(Date.now());
  }

  function positionCursor() {
    const li = menuItems.find((l) => l.dataset.panel === state.panel);
    if (!li) return;
    els.cursor.style.top = (li.offsetTop + (li.offsetHeight - els.cursor.offsetHeight) / 2) + 'px';
  }

  function cycleTick(now) {
    if (cfg.autoCycle <= 0 || !cfg.showMenu || now < state.manualUntil) return;
    if (now - state.lastCycle < cfg.autoCycle * 1000) return;
    const order = PANELS.filter((p) => p !== 'archive' || hasArchiveImage());
    const i = order.indexOf(state.panel);
    setPanel(order[(i + 1) % order.length], false);
  }

  function refreshPanel(now) {
    if (nav.place) return;
    if (state.panel === 'map') updateMapReadout();
    else if (state.panel === 'quests') updateQuests(now);
    else if (state.panel === 'intel') updateIntel();
    else if (state.panel === 'archive') updateDossierNext(now);
    else if (state.panel === 'unit') updateUnitPreview();
    else if (state.panel === 'hacking') updateHackingPreview();
    else if (state.panel === 'garden') updateGardenPreview();
    else if (state.panel === 'system') updateSystem(now);
  }

  // Hover previews a destination in the panel; click (or ENTER) goes there.
  for (const li of menuItems) {
    li.addEventListener('mouseenter', () => setPanel(li.dataset.panel, true));
    li.addEventListener('click', () => go(li.dataset.panel));
  }
  $('enter-btn').addEventListener('click', () => go(state.panel));
  for (const card of document.querySelectorAll('.hk-card')) {
    card.addEventListener('click', () => go('hacking', card.dataset.go));
  }

  // ---------- clock ----------

  function updateClock(d) {
    let h = d.getHours();
    let ampm = '', lead = false;
    if (!cfg.clock24) {
      const p = dayPeriod(d);
      ampm = p.text;
      lead = p.lead;
      h = h % 12 || 12;
    }
    if (lead !== els.ampm.classList.contains('lead')) {
      els.ampm.classList.toggle('lead', lead);
      els.ampm.parentNode.insertBefore(els.ampm, lead ? els.hm : null);
    }
    setText(els.hm, (cfg.clock24 ? pad(h) : String(h)) + ':' + pad(d.getMinutes()));
    setText(els.sec, pad(d.getSeconds()));
    setText(els.ampm, ampm);
    setText(els.date, T('{weekday}  {day} {month} {year}', {
      weekday: T(DAYS[d.getDay()]), day: pad(d.getDate()), month: T(MONTHS[d.getMonth()]), year: d.getFullYear()
    }));
  }

  // ---------- quests (time progress) ----------

  function setQuest(q, range, now) {
    const p = clamp((now - range[0]) / (range[1] - range[0]), 0, 1);
    setText(q.pct, (p * 100).toFixed(1) + '%');
    q.fill.style.width = (p * 100).toFixed(2) + '%';
    setText(q.rem, T('REMAINING {time}', { time: fmtDuration(range[1] - now) }));
  }

  function questRanges(now) {
    const d = new Date(now);
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), h = d.getHours();
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    return {
      hour: [new Date(y, m, day, h).getTime(), new Date(y, m, day, h + 1).getTime()],
      day: [new Date(y, m, day).getTime(), new Date(y, m, day + 1).getTime()],
      week: [new Date(y, m, day - dow).getTime(), new Date(y, m, day - dow + 7).getTime()],
      month: [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()],
      year: [new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime()]
    };
  }

  function updateQuests(now) {
    const r = questRanges(now);
    setQuest(questEls['q-day'], r.day, now);
    setQuest(questEls['q-week'], r.week, now);
    setQuest(questEls['q-month'], r.month, now);
    setQuest(questEls['q-year'], r.year, now);
    const list = orderList();
    const st = ordersState();
    setText($('hq-orders'), list.length ? T('{done} / {total} COMPLETE', { done: list.filter((t) => st.items[t]).length, total: list.length }) : T('NONE ASSIGNED'));
    setText($('hq-cal'), planner.hubLine(now));
    const soon = cfg.wellness ? wellSoonest(now) : null;
    setText($('hq-well'), !cfg.wellness ? T('OFF') : soon ? T('{name} {when}', { name: T(soon.w.name), when: fmtIn(soon.at - now) }) : T('DONE TODAY'));
  }

  // ---------- intel (media integration) ----------

  // Fills either the hub panel (prefix 'm-') or the INTEL place (prefix 'pm-').
  function updateIntel(prefix) {
    const p = prefix || 'm-';
    const has = !!media.title;
    setText($(p + 'title'), media.title || '--');
    setText($(p + 'artist'), media.artist || '--');
    setText($(p + 'album'), media.album || '--');

    let st = '--';
    if (media.state === playbackConst('PLAYING', 1)) st = K('PLAYING');
    else if (media.state === playbackConst('PAUSED', 2)) st = K('PAUSED');
    else if (media.state === playbackConst('STOPPED', 0)) st = K('STOPPED');
    setText($(p + 'state'), T(st));

    let pos = media.pos;
    if (isPlaying() && media.at) pos += (performance.now() - media.at) / 1000;
    if (media.dur > 0) pos = Math.min(pos, media.dur);
    setText($(p + 'pos'), fmtTrack(pos));
    setText($(p + 'dur'), fmtTrack(media.dur));
    $(p + 'fill').style.width = media.dur > 0 ? (pos / media.dur * 100).toFixed(2) + '%' : '0%';

    let note = '';
    if (Date.now() < link.noteUntil) note = link.note;
    else if (!hasMediaApi) note = K('MEDIA LINK UNAVAILABLE OUTSIDE WALLPAPER ENGINE');
    else if (media.enabled === false) note = K('MEDIA LINK OFFLINE // ENABLE MEDIA INTEGRATION IN WALLPAPER ENGINE SETTINGS');
    else if (!has) note = K('AWAITING AUDIO SIGNAL // PLAY SOMETHING IN SPOTIFY, A BROWSER, ETC.');
    setText($(p + 'note'), note ? T(note) : '');
    $(p + 'ctl').classList.toggle('playing', isPlaying());
  }

  // Tracks heard by the terminal, newest first. Property audiolog: keep (saved on this PC), music (saved,
  // but videos such as YouTube are skipped when the player reports them), session (forgotten on restart), off.
  const audioLog = store.get('audiolog', []);
  const AUDIO_MODES = ['keep', 'music', 'session', 'off'];
  const audioMode = () => (AUDIO_MODES.includes(cfg.audioLog) ? cfg.audioLog : 'keep');
  const audioSaved = () => audioMode() === 'keep' || audioMode() === 'music';

  // Runs with every config change, so switching to a stricter mode also removes what was saved before.
  function syncAudioLog() {
    const mode = audioMode();
    for (let i = audioLog.length - 1; i >= 0; i--) {
      const r = audioLog[i];
      if (mode === 'off' || (mode === 'music' && r.type === 'video') || (mode === 'session' && r.t < state.started)) audioLog.splice(i, 1);
    }
    store.set('audiolog', audioSaved() ? audioLog : []);
  }

  function logTrack(title, artist, type) {
    const mode = audioMode();
    if (mode === 'off' || (mode === 'music' && type === 'video')) return;
    if (audioLog.length && audioLog[0].title === title && audioLog[0].artist === artist) return;
    audioLog.unshift({ t: Date.now(), title: title.slice(0, 120), artist: (artist || '').slice(0, 80), type: type || '' });
    audioLog.length = Math.min(audioLog.length, 60);
    if (audioSaved()) store.set('audiolog', audioLog);
    if (nav.place === 'intel' && nav.sel === 'audio') renderAudioLog();
  }

  function clearAudioLog() {
    audioLog.length = 0;
    store.set('audiolog', []);
    say('Report', T('Audio log cleared. No record of past signals remains.'));
    if (nav.place === 'intel' && nav.sel === 'audio') renderAudioLog();
  }

  function onMediaStatus(e) {
    media.enabled = !!(e && e.enabled);
  }

  function onMediaProps(e) {
    media.title = (e && e.title) || '';
    media.artist = (e && (e.artist || e.albumArtist)) || '';
    media.album = (e && e.albumTitle) || '';
    media.type = (e && e.contentType) || '';
    if (!media.title) {
      $('m-thumb-frame').classList.remove('has-img');
      $('pm-thumb-frame').classList.remove('has-img');
    } else if (media.title !== pod.lastTitle) {
      pod.lastTitle = media.title;
      logTrack(media.title, media.artist, media.type);
      const by = media.artist ? ' // ' + media.artist.slice(0, 50) : '';
      if (!podSay(PE.track, { title: media.title.slice(0, 80), by: by })) {
        say('Report', T('Audio signal acquired: "{title}"{by}.', { title: media.title.slice(0, 80), by: by }));
      }
      act('surprise');
      emote('music');
    }
  }

  function onMediaThumb(e) {
    const on = !!(e && e.thumbnail);
    for (const p of ['m-', 'pm-']) {
      if (on) $(p + 'thumb').src = e.thumbnail;
      $(p + 'thumb-frame').classList.toggle('has-img', on);
    }
  }

  function onMediaPlayback(e) {
    const was = isPlaying();
    if (was && media.at) media.pos += (performance.now() - media.at) / 1000;
    media.state = e ? e.state : -1;
    media.at = performance.now();
    if (was && media.state === playbackConst('PAUSED', 2) && Date.now() - pod.lastPauseMsg > 30000) {
      pod.lastPauseMsg = Date.now();
      if (!podSay(PE.paused)) say('Report', T('Audio playback suspended.'));
    }
  }

  function onMediaTimeline(e) {
    media.pos = (e && e.position) || 0;
    media.dur = (e && e.duration) || 0;
    media.at = performance.now();
  }

  // ---------- music controls and keyboard typing (YoRHa Helper) ----------
  // Wallpaper Engine lets a wallpaper read what is playing but never control it, and sends it no key presses.
  // The optional YoRHa Helper (helper/ in the GitHub repository) listens on this PC only (127.0.0.1): it presses
  // the Windows media keys when a button here asks, and opens a text box for typing with the real keyboard.
  // Nothing goes anywhere else. Without it the buttons say where to get it.

  const LINK = 'http://127.0.0.1:47823/yorha/';
  const link = { online: false, next: 0, busy: null, asking: false, note: '', noteUntil: 0 };

  // Resolves to true when the helper answers.
  function linkPing() {
    if (!cfg.helper) return Promise.resolve(false);
    if (link.busy) return link.busy;
    if (typeof fetch !== 'function') return Promise.resolve(false);
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const to = setTimeout(() => { if (ctl) ctl.abort(); }, 1500);
    link.busy = fetch(LINK + 'ping', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then((r) => r.json())
      .then((j) => !!(j && j.ok && j.app === 'YoRHa Helper'))
      .catch(() => false)
      .then((ok) => {
        clearTimeout(to);
        link.busy = null;
        link.online = ok && cfg.helper;
        refreshLinkUi();
        return ok;
      });
    return link.busy;
  }

  // Looks for the helper once at start, then only while the controls are on screen
  // (every 20 s, or every minute while it is missing).
  function linkTick(now) {
    if (!cfg.helper || link.asking || now < link.next) return;
    const shown = nav.place ? nav.place === 'intel' && nav.sel === 'now' : state.panel === 'intel';
    if (!shown && link.next) return;
    link.next = now + (link.online ? 20000 : 60000);
    linkPing();
  }

  function linkNote(text, ms) {
    link.note = text;
    link.noteUntil = Date.now() + ms;
    refreshLinkUi();
  }

  const LINK_SENT = { next: K('SIGNAL SENT // NEXT TRACK'), prev: K('SIGNAL SENT // PREVIOUS TRACK'), playpause: K('SIGNAL SENT // PLAY / PAUSE') };

  function linkSend(cmd) {
    if (!cfg.helper) {
      linkNote(K('YORHA HELPER IS SWITCHED OFF // SWITCH IT ON IN SYSTEM > QUICK SETTINGS'), 9000);
      return;
    }
    const send = () => {
      fetch(LINK + 'media/' + cmd, { method: 'POST', mode: 'no-cors', cache: 'no-store' }).catch(() => {
        link.online = false;
        linkNote(K('YORHA HELPER LOST // IS YORHA HELPER STILL RUNNING?'), 7000);
      });
      linkNote(LINK_SENT[cmd], 2500);
    };
    if (link.online) {
      send();
      return;
    }
    linkPing().then((ok) => {
      if (ok) send();
      else linkNote(K('YORHA HELPER OFFLINE // GET YORHA HELPER FROM GITHUB.COM/CALEBFRUMS/YORHA-TERMINAL'), 12000);
    });
  }

  // Asks the helper for its text box: resolves to { text } when typed, { cancel: true } when closed,
  // or { offline: true } when the helper is not running.
  function linkAsk(prompt, text, max) {
    if (!cfg.helper) return Promise.resolve({ off: true });
    return (link.online ? Promise.resolve(true) : linkPing()).then((ok) => {
      if (!ok) return { offline: true };
      link.asking = true;
      const q = '?p=' + encodeURIComponent(prompt) + '&t=' + encodeURIComponent(text || '') + '&n=' + max +
        '&ok=' + encodeURIComponent(T('DONE')) + '&cancel=' + encodeURIComponent(T('CANCEL'));
      return fetch(LINK + 'input' + q, { method: 'POST', cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => (j && j.ok && typeof j.text === 'string' ? { text: j.text } : { cancel: true }))
        .catch(() => {
          link.online = false;
          return { offline: true };
        })
        .then((res) => {
          link.asking = false;
          if (res.offline) refreshLinkUi(); // brings back the on-screen keyboard it had replaced
          return res;
        });
    });
  }

  function refreshLinkUi() {
    planner.helperChanged();
    for (const p of ['m-', 'pm-']) {
      const box = $(p + 'ctl');
      box.classList.toggle('online', link.online);
      box.classList.toggle('playing', isPlaying());
      setText($(p + 'link'), !cfg.helper ? T('HELPER OFF') : link.online ? T('HELPER ONLINE') : T('HELPER OFFLINE'));
    }
    if (nav.place === 'intel') updateIntel('pm-');
    else if (state.panel === 'intel') updateIntel();
  }

  for (const b of document.querySelectorAll('.mbtn')) b.addEventListener('click', () => linkSend(b.dataset.cmd));

  // The switch (property 'yorhahelper', or SYSTEM > QUICK SETTINGS) starts off. While it is off the wallpaper
  // never contacts 127.0.0.1 at all; switching it off forgets the helper at once.
  function syncHelper() {
    if (!cfg.helper) link.online = false;
    if (cfg.helper && !link.wasOn) link.next = 0; // just switched on: look for it straight away
    link.wasOn = cfg.helper;
    refreshLinkUi();
  }

  // Switching it on from the quick settings first shows what it does and what it never does.
  function helperDisclaimer() {
    const d = $('helper-note');
    d.classList.remove('show');
    void d.offsetWidth;
    d.classList.add('show');
    $('place-main').classList.add('editing');
  }
  function closeHelperNote() {
    if (!$('helper-note').classList.contains('show')) return;
    $('helper-note').classList.remove('show');
    $('place-main').classList.remove('editing');
  }
  $('hn-on').addEventListener('click', () => {
    closeHelperNote();
    setOverride('helper', true);
    say('Report', T('YoRHa Helper switched on. It only talks to this PC.'));
  });
  $('hn-cancel').addEventListener('click', closeHelperNote);

  // ---------- system ----------

  // Fills the hub panel (prefix 'sys-') or the SYSTEM place (prefix 'ps-').
  function updateSystem(now, prefix) {
    const p = prefix || 'sys-';
    setText($(p + 'unit'), unit().toUpperCase());
    setText($(p + 'uptime'), fmtDuration(now - state.started));
    let tz = 'LOCAL';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* keep default */ }
    setText($(p + 'tz'), tz.toUpperCase());
    const k = window.devicePixelRatio || 1;
    setText($(p + 'display'), Math.round(window.innerWidth * k) + ' X ' + Math.round(window.innerHeight * k));
    setText($(p + 'fps'), T('{n} FPS', { n: state.fps }) + (state.fpsLimit > 0 ? ' // ' + T('CAP {n}', { n: state.fpsLimit }) : ''));
    let a = K('SIMULATED');
    if (audio.hasApi) a = performance.now() - audio.lastSignal < 2000 ? K('ACTIVE') : K('SILENT');
    const gain = Math.abs(audio.gain - 1) >= 0.05 ? '  //  ' + T('GAIN X{g}', { g: audio.gain.toFixed(1) }) : '';
    setText($(p + 'audio'), T(a) + gain);
    let m = K('UNAVAILABLE');
    if (hasMediaApi) m = media.enabled === false ? K('OFFLINE') : (media.title ? K('ONLINE') : K('STANDBY'));
    setText($(p + 'media'), T(m));
    if (p === 'ps-') {
      setText($('ps-chars'), !gallery.files.length ? T('NO FOLDER')
        : T('{n} LOADED', { n: gallery.files.length }) + (gallery.bundled ? '  //  ' + T('BUNDLED SET') : ''));
    }
  }

  // ---------- audio ----------

  // Sensitivity: the user's gain (audioGain %) times an automatic boost for quiet sources. The boost
  // follows a slow-decaying peak of the input, so a calm song fills the bars while loud music is left
  // alone. Below the noise gate nothing is boosted, so silence stays flat.
  const AUDIO_GATE = 0.004;
  // Values past 0.7 are pressed toward 1 instead of cut off, so loud bars still differ at high gain.
  const softClip = (x) => (x <= 0.7 ? x : 0.7 + 0.3 * (1 - Math.exp(-(x - 0.7) / 0.3)));

  function onAudio(arr) {
    const now = performance.now();
    const dt = audio.lastIn ? Math.min(0.5, (now - audio.lastIn) / 1000) : 0.033;
    audio.lastIn = now;
    let max = 0;
    for (let i = 0; i < 128; i++) {
      const v = arr[i] || 0;
      if (v > max) max = v;
    }
    audio.peak = Math.max(max, audio.peak * Math.pow(0.5, dt / 5)); // halves every 5 s
    const want = cfg.audioAuto && audio.peak > AUDIO_GATE ? clamp(0.7 / audio.peak, 1, 12) : 1;
    // Drop the boost quickly when the music gets louder, raise it slowly when it gets quieter.
    audio.auto += (want - audio.auto) * Math.min(1, dt * (want < audio.auto ? 8 : 0.6));
    const g = clamp(cfg.audioGain, 10, 1000) / 100 * audio.auto;
    audio.gain = g;
    for (let i = 0; i < 128; i++) audio.raw[i] = softClip(Math.max(0, arr[i] || 0) * g);
    if (max > AUDIO_GATE && max * g > 0.015) audio.lastSignal = now;
  }

  // Browser preview only: a gentle synthetic spectrum so the visualizer is not empty. It goes through
  // onAudio, so the sensitivity setting shows in a browser too.
  const fakeArr = new Float32Array(128);
  function fakeAudio(t) {
    for (let ch = 0; ch < 2; ch++) {
      for (let i = 0; i < 64; i++) {
        const f = i / 64;
        const beat = Math.pow(Math.max(0, Math.sin(t * 3.1)), 8) * (1 - f) * 0.55;
        const v = (0.22 + 0.18 * Math.sin(t * 1.7 + i * 0.35 + ch)) * (1 - f * 0.75) + beat + 0.06 * Math.sin(t * 7 + i);
        fakeArr[ch * 64 + i] = clamp(v, 0, 1);
      }
    }
    onAudio(fakeArr);
    audio.lastSignal = performance.now();
  }

  function updateAudio(dt) {
    const up = 1 - Math.pow(0.5, dt * 60);
    const down = 1 - Math.pow(0.88, dt * 60);
    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const r = audio.raw[i];
      const s = audio.smooth[i];
      const ns = s + (r - s) * (r > s ? up : down);
      audio.smooth[i] = ns;
      audio.peaks[i] = Math.max(audio.peaks[i] - dt * 0.4, ns);
      sum += ns;
    }
    audio.level = sum / 128;
  }

  function bass() {
    let s = 0;
    for (let i = 0; i < 6; i++) s += audio.smooth[i] + audio.smooth[64 + i];
    return Math.min(1, s / 12);
  }

  // ---------- particles ----------

  const fx = { canvas: $('fx'), parts: [] };
  fx.ctx = fx.canvas.getContext('2d');

  function spawn(anywhere) {
    const sq = Math.random() < 0.12;
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.04,
      s: sq ? 5 + Math.random() * 9 : 1 + Math.random() * 2.2,
      vy: 0.006 + Math.random() * 0.014,
      vx: (Math.random() - 0.5) * 0.004,
      a: sq ? 0.12 + Math.random() * 0.2 : 0.25 + Math.random() * 0.55,
      ph: Math.random() * Math.PI * 2,
      sq: sq
    };
  }

  function syncParticles() {
    const n = Math.round(clamp(cfg.particles, 0, 300));
    while (fx.parts.length < n) fx.parts.push(spawn(true));
    fx.parts.length = n;
  }

  function drawParticles(dt, t) {
    const c = fx.canvas, ctx = fx.ctx;
    fitCanvas(c, 2560);
    const k = c.width / Math.max(1, c.clientWidth);
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const boost = 1 + bass() * 1.5;
    ctx.lineWidth = k;
    for (const p of fx.parts) {
      p.y -= p.vy * dt * boost;
      p.x += (p.vx + Math.sin(t * 0.4 + p.ph) * 0.0025) * dt;
      if (p.y < -0.04 || p.x < -0.05 || p.x > 1.05) Object.assign(p, spawn(false));
      const a = p.a * (0.55 + 0.45 * Math.sin(t * 1.3 + p.ph));
      const x = p.x * W, y = p.y * H, s = p.s * k;
      if (p.sq) {
        ctx.strokeStyle = 'rgba(' + state.colors.ink + ',' + a.toFixed(3) + ')';
        ctx.strokeRect(x, y, s, s);
      } else {
        ctx.fillStyle = 'rgba(' + state.colors.dust + ',' + a.toFixed(3) + ')';
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  // ---------- bottom visualizer ----------

  const viz = { canvas: $('viz') };
  viz.ctx = viz.canvas.getContext('2d');

  function drawViz() {
    if (!cfg.showViz) return;
    const c = viz.canvas, ctx = viz.ctx, k = dpr();
    fitCanvas(c);
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const ink = state.colors.ink;
    const half = W / 2;
    const bars = Math.max(8, Math.min(64, Math.floor(half / (14 * k))));
    const step = half / bars;
    const bw = Math.max(1, Math.floor(step * 0.68));
    const segH = Math.max(2, Math.round(step * 0.3));
    const segStep = segH + Math.max(1, Math.round(step * 0.18));
    const maxSegs = Math.max(1, Math.floor((H - 2 - segH) / segStep));

    ctx.fillStyle = 'rgba(' + ink + ',0.35)';
    ctx.fillRect(0, H - k, W, k);

    for (let side = 0; side < 2; side++) {
      for (let b = 0; b < bars; b++) {
        const idx = side * 64 + Math.min(63, Math.floor(b * 64 / bars));
        const n = Math.min(maxSegs, Math.max(1, Math.round(Math.min(1, audio.smooth[idx] * 1.2) * maxSegs)));
        const x = side === 0
          ? Math.round(half - (b + 1) * step + (step - bw) / 2)
          : Math.round(half + b * step + (step - bw) / 2);
        ctx.fillStyle = 'rgba(' + ink + ',0.5)';
        for (let s = 0; s < n; s++) ctx.fillRect(x, H - 2 - s * segStep - segH, bw, segH);
        const pk = Math.min(maxSegs, Math.round(Math.min(1, audio.peaks[idx] * 1.2) * maxSegs));
        if (pk > n) {
          ctx.fillStyle = 'rgba(' + ink + ',0.25)';
          ctx.fillRect(x, H - 2 - pk * segStep - segH, bw, segH);
        }
      }
    }
  }

  // ---------- map globe ----------

  const globe = { canvas: $('globe'), rot: 0, orbit: 0.6, points: [], visible: 0 };
  globe.ctx = globe.canvas.getContext('2d');
  (function seedPoints() {
    let seed = 1337;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) globe.points.push({ lat: Math.asin(2 * rnd() - 1), lon: rnd() * Math.PI * 2 });
  })();
  const TARGET = { lat: 35.41, lon: 139.42 };

  function drawGlobe(dt, t) {
    globe.rot += dt * 0.12;
    globe.orbit += dt * ORBIT_SPEED;
    if (nav.place || state.panel !== 'map' || !cfg.showMenu) return;
    const r = renderGlobe(globe.canvas, {
      rot: globe.rot,
      tilt: 0.41,
      wf: 0.28,
      points: globe.points,
      markers: [{ id: 'target', lat: TARGET.lat, lon: TARGET.lon, label: T('SIGNAL'), sel: true }],
      bunkerLabel: true
    }, t);
    globe.visible = r.visible;
  }

  // Shared globe renderer for the hub preview and the MAP place.
  // o: { rot, tilt, wf (radius as a share of width), points, markers: [{ id, lat, lon (deg), label, sel, hover }],
  //      bunkerSel, bunkerLabel }. Returns marker screen positions (canvas px) for hit testing.
  function renderGlobe(c, o, t) {
    const ctx = c.getContext('2d'), k = dpr();
    fitCanvas(c);
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const ink = state.colors.ink, accent = state.colors.accent;
    const cx = W / 2, cy = H / 2;
    const R = Math.max(1, Math.min(W * o.wf, H * 0.4) * (1 + bass() * 0.04));
    const D = Math.PI / 180;
    const tilt = o.tilt, ct = Math.cos(tilt), st = Math.sin(tilt);
    const rot = o.rot;
    const hits = [];
    const proj = (lat, lon) => {
      const cl = Math.cos(lat);
      const x = cl * Math.sin(lon + rot), y = Math.sin(lat), z = cl * Math.cos(lon + rot);
      return [cx + x * R, cy - (y * ct - z * st) * R, y * st + z * ct];
    };

    ctx.lineWidth = k;
    ctx.font = (11 * k) + 'px ' + canvasFont();
    if ('letterSpacing' in ctx) ctx.letterSpacing = (2 * k) + 'px';

    // crosshair
    ctx.strokeStyle = 'rgba(' + ink + ',0.14)';
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(cx - R * 1.62, cy);
    ctx.moveTo(cx + R * 1.62, cy); ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - R * 1.22);
    ctx.moveTo(cx, cy + R * 1.22); ctx.lineTo(cx, H);
    ctx.stroke();

    // graticule: back faces faint, front faces solid
    for (let pass = 0; pass < 2; pass++) {
      const front = pass === 1;
      ctx.strokeStyle = 'rgba(' + ink + ',' + (front ? 0.55 : 0.12) + ')';
      ctx.beginPath();
      const seg = (a, b) => {
        if ((a[2] > 0) === front && (b[2] > 0) === front) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      };
      for (let lat = -60; lat <= 60; lat += 30) {
        let prev = proj(lat * D, 0);
        for (let lon = 6; lon <= 360; lon += 6) {
          const cur = proj(lat * D, lon * D);
          seg(prev, cur);
          prev = cur;
        }
      }
      for (let lon = 0; lon < 360; lon += 30) {
        let prev = proj(-90 * D, lon * D);
        for (let lat = -84; lat <= 90; lat += 6) {
          const cur = proj(lat * D, lon * D);
          seg(prev, cur);
          prev = cur;
        }
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(' + ink + ',0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(' + ink + ',0.35)';
    ctx.setLineDash([6 * k, 10 * k]);
    ctx.lineDashOffset = -t * 12 * k;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // signal points
    ctx.fillStyle = 'rgba(' + ink + ',0.7)';
    let visible = 0;
    for (const p of o.points || []) {
      const q = proj(p.lat, p.lon);
      if (q[2] > 0.05) {
        visible++;
        ctx.fillRect(q[0] - 2 * k, q[1] - 2 * k, 4 * k, 4 * k);
      }
    }

    // markers: selected ones pulse in the accent colour, the rest are hollow squares
    for (const m of o.markers) {
      const q = proj(m.lat * D, m.lon * D);
      if (q[2] <= 0) continue;
      hits.push({ id: m.id, x: q[0], y: q[1] });
      if (m.sel) {
        const pulse = (t * 0.8) % 1;
        ctx.strokeStyle = 'rgba(' + accent + ',' + (1 - pulse).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(q[0], q[1], (4 + pulse * 14) * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgb(' + accent + ')';
        ctx.fillRect(q[0] - 3 * k, q[1] - 3 * k, 6 * k, 6 * k);
      } else {
        const a = m.hover ? 1 : 0.4 + q[2] * 0.5;
        ctx.strokeStyle = 'rgba(' + ink + ',' + a.toFixed(3) + ')';
        ctx.fillStyle = ctx.strokeStyle;
        const s = (m.hover ? 6 : 4.5) * k;
        ctx.strokeRect(q[0] - s, q[1] - s, s * 2, s * 2);
        ctx.fillRect(q[0] - 1.5 * k, q[1] - 1.5 * k, 3 * k, 3 * k);
      }
      if (m.label && (m.sel || m.hover)) {
        drawLabel(ctx, q[0], q[1], m.label, m.sel ? 'rgba(' + accent + ',0.9)' : 'rgba(' + ink + ',0.85)', k, W);
      }
    }

    // Bunker orbit
    const inc = 1.18, ci = Math.cos(inc), si = Math.sin(inc);
    const sl = 0.38, cs = Math.cos(sl), ss = Math.sin(sl);
    const Ro = 1.42;
    const orbitPt = (a) => {
      const x = Math.cos(a) * Ro, z0 = Math.sin(a) * Ro;
      const y = -z0 * si, z = z0 * ci;
      const x2 = x * cs - y * ss, y2 = x * ss + y * cs;
      return [cx + x2 * R, cy - y2 * R, z, z < 0 && (x2 * x2 + y2 * y2) < 1];
    };
    for (let pass = 0; pass < 2; pass++) {
      const shown = pass === 1;
      ctx.strokeStyle = 'rgba(' + ink + ',' + (shown ? 0.6 : 0.15) + ')';
      ctx.setLineDash(shown ? [] : [3 * k, 5 * k]);
      ctx.beginPath();
      let prev = orbitPt(0);
      for (let i = 1; i <= 120; i++) {
        const cur = orbitPt(i / 120 * Math.PI * 2);
        if ((!prev[3] && !cur[3]) === shown) {
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(cur[0], cur[1]);
        }
        prev = cur;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const bp = orbitPt(globe.orbit);
    const ba = bp[3] ? 0.25 : 1;
    const bcol = o.bunkerSel ? accent : ink;
    if (o.bunkerSel && !bp[3]) {
      const pulse = (t * 0.8) % 1;
      ctx.strokeStyle = 'rgba(' + accent + ',' + (1 - pulse).toFixed(3) + ')';
      ctx.strokeRect(bp[0] - (6 + pulse * 12) * k, bp[1] - (6 + pulse * 12) * k, (12 + pulse * 24) * k, (12 + pulse * 24) * k);
    }
    ctx.strokeStyle = 'rgba(' + bcol + ',' + ba + ')';
    ctx.fillStyle = 'rgba(' + bcol + ',' + ba + ')';
    ctx.strokeRect(bp[0] - 5 * k, bp[1] - 5 * k, 10 * k, 10 * k);
    ctx.fillRect(bp[0] - 2 * k, bp[1] - 2 * k, 4 * k, 4 * k);
    if (!bp[3]) {
      hits.push({ id: 'bunker', x: bp[0], y: bp[1] });
      if (o.bunkerLabel || o.bunkerSel || o.bunkerHover) drawLabel(ctx, bp[0], bp[1], T('BUNKER'), 'rgba(' + bcol + ',0.85)', k, W);
    }
    return { hits: hits, visible: visible };
  }

  function drawLabel(ctx, x, y, text, color, k, W) {
    const tw = ctx.measureText(text).width;
    const dir = x + tw + 40 * k > W ? -1 : 1;
    const x1 = x + dir * 8 * k, y1 = y - 4 * k;
    const x2 = x + dir * 24 * k, y2 = y - 18 * k;
    const x3 = x2 + dir * Math.max(70 * k, tw + 6 * k);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y2);
    ctx.stroke();
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, x2 + dir * 2 * k, y2 - 3 * k);
  }

  function updateMapReadout() {
    setText($('map-target'), TARGET.lat.toFixed(2) + ' N  //  ' + TARGET.lon.toFixed(2) + ' E');
    setText($('map-signals'), T('{visible} VISIBLE  //  {tracked} TRACKED', { visible: globe.visible, tracked: globe.points.length }));
    const twoPi = Math.PI * 2;
    const toPass = (((Math.PI / 2 - globe.orbit) % twoPi) + twoPi) % twoPi;
    const secs = Math.round(toPass / ORBIT_SPEED);
    setText($('map-pass'), T('STABLE  //  NEXT PASS {time}', { time: '00:' + pad(Math.floor(secs / 60)) + ':' + pad(secs % 60) }));
  }

  // ---------- small panel canvases ----------

  function drawIntelViz(c) {
    const ctx = c.getContext('2d'), k = dpr();
    fitCanvas(c);
    const W = c.width, H = c.height, mid = H / 2;
    const ink = state.colors.ink;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = k;
    ctx.strokeStyle = 'rgba(' + ink + ',0.18)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();

    const val = (i) => Math.min(1, audio.smooth[i < 64 ? 63 - i : i] * 1.2);
    ctx.beginPath();
    for (let i = 0; i < 128; i++) {
      const x = i / 127 * W, y = mid - val(i) * H * 0.45;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    for (let i = 127; i >= 0; i--) ctx.lineTo(i / 127 * W, mid + val(i) * H * 0.45);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + ink + ',0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + ink + ',0.7)';
    ctx.stroke();
  }

  function drawSpark(c) {
    const ctx = c.getContext('2d'), k = dpr();
    fitCanvas(c);
    const W = c.width, H = c.height;
    const ink = state.colors.ink;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(' + ink + ',0.12)';
    for (let g = 1; g < 4; g++) ctx.fillRect(0, Math.round(H * g / 4), W, k);
    const n = audio.history.length, bw = W / n;
    ctx.fillStyle = 'rgba(' + ink + ',0.55)';
    for (let i = 0; i < n; i++) {
      const v = audio.history[(audio.histHead + i) % n];
      const h = Math.max(k, Math.min(1, v * 3) * (H - 2 * k));
      ctx.fillRect(i * bw, H - h, Math.max(k, bw - k), h);
    }
    ctx.fillStyle = 'rgba(' + ink + ',0.4)';
    ctx.fillRect(0, H - k, W, k);
  }

  // ---------- pod log ----------
  // Pod 042 has a life of its own. Its lines live in podlines.js; this section decides what to say and when,
  // remembers a few things across sessions, and reacts to what happens on the desktop.

  // The active dialogue bank: the language file's translated copy of podlines.js, or the English original.
  let P = window.YoRHaPod || {};
  let PE = P.events || {};
  function applyPodBank() {
    P = I18N.pod || window.YoRHaPod || {};
    PE = P.events || {};
    if (pod) pod.recent.length = 0;
  }
  const pod = {
    queue: [],
    current: null,
    nextIdle: 0,
    lastHour: -1,
    uptimeHours: 0,
    lastTitle: '',
    lastPauseMsg: 0,
    history: [], // every transmission, newest first (POD ARCHIVE)
    recent: [], // lines used lately, so the Pod does not repeat itself
    lastMemSave: 0,
    lastBack: 0,
    guardedAt: 0,
    lastPet: 0,
    lastDesk: 0,
    lastErratic: 0,
    lastChar: 0,
    charsShown: 0,
    greeted: false,
    placesSeen: {}
  };
  // Remembered across sessions: first contact, days in service, times petted.
  const podMem = Object.assign({ first: 0, last: 0, days: 0, lastDay: '', pets: 0, milestone: 0 }, store.get('pod.mem', {}));
  const podLastSeen = podMem.last; // read before the minute-by-minute saves overwrite it
  const savePodMem = () => store.set('pod.mem', podMem);
  const MAX_LINES = 5;
  const POD_KINDS = [K('Report'), K('Proposal'), K('Query'), K('Alert'), K('Hypothesis'), K('Analysis'),
    K('Warning'), K('Confirmation'), K('Summary')];
  const KIND_RE = new RegExp('^(' + POD_KINDS.join('|') + '):\\s*');

  // who: '' for a plain line, '042' or '153' inside a Pod-to-Pod exchange.
  function say(kind, text, who) {
    if (!cfg.showLog) return;
    pod.queue.push({ kind: kind, text: text.replace(/\{u\}/g, unit()), who: who || '' });
    if (pod.queue.length > 6) pod.queue.shift();
  }

  function fmtAway(ms) {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return TN(m, '{n} minute|{n} minutes');
    const h = Math.floor(m / 60), rest = m % 60;
    if (h < 48) return TN(h, '{n} hour|{n} hours') + (rest ? ' ' + TN(rest, '{n} minute|{n} minutes') : '');
    return TN(Math.floor(h / 24), '{n} day|{n} days');
  }

  // Grows over a session (and with affection): a curious Pod asks more questions and talks to Pod 153 more.
  const podCuriosity = (now) => Math.min(1, (now - state.started) / 10800000 + podMem.pets * 0.01 + (podMem.days > 7 ? 0.15 : 0));

  // Values for {placeholders}; anything unknown or zero stays undefined so lines that need it are skipped.
  function podVars(extra) {
    const now = Date.now(), d = new Date(now);
    const v = { u: unit(), t: timeHM(d), m: Math.max(1, Math.round((now - state.started) / 60000)) };
    const day = questRanges(now).day;
    v.pct = Math.round((now - day[0]) / (day[1] - day[0]) * 100);
    if (podMem.days > 1) v.days = podMem.days;
    if (podMem.pets) v.pets = v.aff = podMem.pets;
    if (gallery.current && actorVisible()) v.c = parseCharName(gallery.current).name;
    if (media.title && isPlaying()) {
      v.title = media.title.slice(0, 60);
      if (media.artist) v.artist = media.artist.slice(0, 40);
    }
    if (audioLog.length) v.tracks = audioLog.length;
    if (gallery.files.length) v.records = gallery.files.length;
    const list = orderList();
    if (list.length) {
      const st = ordersState();
      v.done = list.filter((x) => st.items[x]).length;
      v.total = list.length;
    }
    if (streakCount() > 1) v.streak = streakCount();
    if (timerToday().count) v.timers = timerToday().count;
    if (garden && garden.stats().total) v.flowers = garden.stats().total;
    if (breach && breach.stats().runs.length) v.best = String(breach.stats().runs[0].score).padStart(6, '0');
    if (intercept && intercept.stats().runs.length) v.interceptBest = String(intercept.stats().runs[0].score).padStart(6, '0');
    if (logic && logic.stats().solved) v.locks = logic.stats().solved;
    if (games.moon) v.moon = T(games.moon(d).name);
    v.mine = unitName();
    v.bond = bondLv(U.xp);
    return Object.assign(v, extra || {});
  }

  const usableLine = (line, vars) => (line.match(/\{\w+\}/g) || []).every((p) => vars[p.slice(1, -1)] !== undefined);

  function remember(line) {
    pod.recent.push(line);
    if (pod.recent.length > 40) pod.recent.shift();
  }

  // "Kind: text" with placeholders -> say()
  function sayLine(line, vars, who) {
    const text = line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    const k = KIND_RE.exec(text);
    say(k ? k[1] : '', k ? text.slice(k[0].length) : text, who);
  }

  // Pick a usable line the Pod has not said lately: { line, vars }, or null when nothing fits right now.
  function podPick(lines, extra) {
    if (!lines || !lines.length || I18N.loading) return null; // wait for the language file
    const vars = podVars(extra);
    const ok = lines.filter((l) => usableLine(l, vars));
    if (!ok.length) return null;
    const fresh = ok.filter((l) => !pod.recent.includes(l));
    const pool = fresh.length ? fresh : ok;
    const line = pool[Math.floor(Math.random() * pool.length)];
    remember(line);
    return { line: line, vars: vars };
  }

  // The picked line as plain text, without its "Kind:" prefix (for cards outside the log).
  const fillLine = (p) => p.line.replace(/\{(\w+)\}/g, (m, k) => (p.vars[k] !== undefined ? String(p.vars[k]) : m)).replace(KIND_RE, '');

  function podSay(lines, extra, who) {
    if (!cfg.showLog) return false;
    const p = podPick(lines, extra);
    if (!p) return false;
    sayLine(p.line, p.vars, who);
    return true;
  }

  // A short exchange with Pod 153, every line tagged with its speaker.
  function podChat(late) {
    if (!cfg.showLog || I18N.loading) return false;
    const vars = podVars();
    const ok = ((late ? P.chatsLate : P.chats) || []).filter((c) => c.every((l) => usableLine(l[1], vars)));
    if (!ok.length) return false;
    const fresh = ok.filter((c) => !pod.recent.includes(c[0][1]));
    const pool = fresh.length ? fresh : ok;
    const chat = pool[Math.floor(Math.random() * pool.length)];
    remember(chat[0][1]);
    for (const l of chat) sayLine(l[1], vars, l[0]);
    return true;
  }

  // Remark on the character standing on the desktop: by name if the Pod knows them, else by affiliation.
  function podCharLine() {
    if (!gallery.current || !actorVisible()) return false;
    const info = parseCharName(gallery.current);
    const known = (P.chars || []).find((c) => new RegExp(c.match, 'i').test(info.name));
    return podSay(known ? known.lines : (P.affiliation || {})[affiliation(info)]);
  }

  function timeBand(h) {
    if (h < 5) return 'late';
    if (h < 11) return 'morning';
    if (h < 14) return 'midday';
    if (h < 18) return 'afternoon';
    if (h < 22) return 'evening';
    return 'night';
  }

  // Idle chatter: a weighted pick of what kind of thing to say, shaped by the hour, music, the desktop
  // character and how curious the Pod has become.
  function podIdle(now) {
    const d = new Date(now), h = d.getHours(), I = P.idle || {};
    const cur = podCuriosity(now);
    const music = (media.title && isPlaying()) || musicActive();
    const late = h < 5 || h >= 23;
    const bag = [
      [3, () => podSay(I.routine)],
      [2, () => podSay(I.care)],
      [1.2, () => podSay(I.query)],
      [0.6 + 3 * cur, () => podSay(I.curious)],
      [1.4, () => podSay(I.activity)],
      [1 + cur, () => podSay(I.stats)],
      [1.6, () => podSay((P.time || {})[timeBand(h)])],
      [0.5, () => podSay((P.weekday || {})[d.getDay()])],
      [music ? 2.5 : 0, () => podSay(I.music)],
      [actorVisible() ? 1.5 : 0, () => podCharLine()],
      [unitNeed() && unitNeed() !== 'rest' ? 1.4 : 0.25, () => podSay(PE['unit' + (unitNeed() || 'fine').replace(/^./, (c) => c.toUpperCase())])],
      [0.8 + 1.5 * cur, () => podChat(late && Math.random() < 0.5)],
      [0.35, () => podSay(I.hint)]
    ];
    let r = Math.random() * bag.reduce((s, b) => s + b[0], 0);
    for (const [w, fn] of bag) {
      r -= w;
      if (r <= 0) {
        if (!fn()) podSay(I.routine);
        return;
      }
    }
  }

  // Status beside the log title, and the transmit light while a line is typing.
  function podState(now) {
    let s = K('OBSERVING');
    if (pod.current) s = K('TRANSMITTING');
    else if (new Date(now).getHours() < 5) s = K('LOW POWER');
    else if (now - nav.lastInput > 300000) s = K('GUARDING');
    else if (isPlaying() || musicActive()) s = K('LISTENING');
    else if (now - pod.lastPet < 60000) s = K('CONTENT');
    else if (podCuriosity(now) > 0.6) s = K('CURIOUS');
    setText($('pod-state'), T(s));
    document.body.classList.toggle('pod-talking', !!pod.current);
  }

  function petPod(now) {
    if (now - pod.lastPet < 12000) return;
    pod.lastPet = now;
    podMem.pets++;
    savePodMem();
    document.body.classList.remove('pod-petted');
    void document.body.offsetWidth;
    document.body.classList.add('pod-petted');
    podSay(PE.pet);
  }

  // Mouse habits: slow circles over the Pod log pet it (as in the game); frantic shaking worries it.
  const petTrack = { x: 0, y: 0, a: null, turn: 0, dist: 0, t0: 0, lastT: 0 };
  const shake = { dir: 0, flips: [] };
  function podMouse(e, now) {
    const p = petTrack;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.abs(dx) > 12) {
      const dir = Math.sign(dx);
      if (shake.dir && dir !== shake.dir) {
        shake.flips.push(now);
        while (shake.flips.length && now - shake.flips[0] > 1000) shake.flips.shift();
        if (shake.flips.length >= 7 && now - pod.lastErratic > 600000 && !gameBusy()) {
          pod.lastErratic = now;
          shake.flips.length = 0;
          podSay(PE.erratic);
        }
      }
      shake.dir = dir;
    }
    if (!e.target || !e.target.closest || !e.target.closest('#podlog, #place-hint')) {
      p.a = null;
      p.turn = 0;
      return;
    }
    if (now - p.lastT > 300) {
      p.turn = 0;
      p.dist = 0;
      p.t0 = now;
      p.a = null;
    }
    p.lastT = now;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const a = Math.atan2(dy, dx);
    if (p.a !== null) {
      let da = a - p.a;
      if (da > Math.PI) da -= TWO_PI;
      else if (da < -Math.PI) da += TWO_PI;
      p.turn += da;
    }
    p.a = a;
    p.dist += dist;
    const secs = (now - p.t0) / 1000;
    // Two full loops at a gentle pace, not a frantic scribble.
    if (Math.abs(p.turn) > 4 * Math.PI && secs > 0.8 && p.dist / secs < 1200) {
      p.turn = 0;
      p.dist = 0;
      p.t0 = now;
      petPod(now);
    }
  }

  function podStartNext() {
    const msg = pod.queue.shift();
    const line = document.createElement('div');
    line.className = 'pod-line';
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = timeHM(new Date());
    line.appendChild(t);
    if (msg.who) {
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = msg.who;
      line.appendChild(who);
    }
    const kind = document.createElement('span');
    kind.className = 'kind' + (msg.kind === 'Alert' || msg.kind === 'Warning' ? ' alert' : '');
    kind.textContent = msg.kind ? T(msg.kind) + ':' : '';
    const body = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'caret';
    line.append(kind, body, caret);
    els.podBox.appendChild(line);
    pod.history.unshift({ t: Date.now(), kind: msg.kind, text: msg.text, who: msg.who });
    pod.history.length = Math.min(pod.history.length, 120);
    setText($('hint-pod'), (msg.who ? msg.who + ' // ' : '') + (msg.kind ? T(msg.kind) + ': ' : '') + msg.text);
    if (nav.place === 'intel' && nav.sel === 'pod') renderPodLog();
    while (els.podBox.children.length > MAX_LINES) els.podBox.removeChild(els.podBox.firstChild);
    const lines = els.podBox.children;
    for (let i = 0; i < lines.length; i++) {
      lines[i].style.opacity = String([1, 0.75, 0.55, 0.4, 0.3][lines.length - 1 - i]);
    }
    pod.current = { msg: msg, body: body, caret: caret, shown: 0, lastN: -1, hold: 0 };
  }

  function updatePod(dt) {
    if (!cfg.showLog) return;
    if (!pod.current && pod.queue.length) podStartNext();
    const cur = pod.current;
    if (!cur) return;
    cur.shown += dt * 38;
    const n = Math.min(cur.msg.text.length, Math.floor(cur.shown));
    if (n !== cur.lastN) {
      cur.body.textContent = cur.msg.text.slice(0, n);
      cur.lastN = n;
    }
    if (n >= cur.msg.text.length) {
      cur.hold += dt;
      if (cur.hold > 1.2) {
        cur.caret.remove();
        pod.current = null;
      }
    }
  }

  function scheduleIdle(now) {
    pod.nextIdle = now + clamp(cfg.logInterval, 5, 600) * 1000 * (0.7 + Math.random() * 0.6);
  }

  function podTick(now) {
    podState(now);
    const d = new Date(now);
    if (now - pod.lastMemSave > 60000) {
      pod.lastMemSave = now;
      podMem.last = now;
      savePodMem();
    }
    // After the greeting has counted today, a wallpaper left running counts each new day as it comes.
    if (pod.greeted && countDay(d)) dayMilestone();
    if (!cfg.showLog) return;
    const h = d.getHours();
    if (pod.lastHour === -1) {
      pod.lastHour = h;
    } else if (h !== pod.lastHour) {
      pod.lastHour = h;
      podSay(h === 0 ? PE.midnight : h < 5 ? PE.hourlyLate : PE.hourly);
      act('surprise');
      emote(h < 5 ? 'sleep' : 'alert');
    }
    const up = Math.floor((now - state.started) / 3600000);
    if (up > pod.uptimeHours) {
      pod.uptimeHours = up;
      say('Report', T('Session uptime has reached {hours}.', { hours: TN(up, '{n} hour|{n} hours') }));
    }
    // A long quiet stretch gets one note per stretch.
    const quiet = now - nav.lastInput;
    if (quiet > 20 * 60000 && pod.guardedAt < nav.lastInput) {
      pod.guardedAt = now;
      podSay(PE.guarding, { away: fmtAway(quiet) });
    }
    if (now >= pod.nextIdle) {
      podIdle(now);
      scheduleIdle(now);
    }
  }

  // Days in service go up on each new calendar day, whether the wallpaper restarts or keeps running.
  function countDay(d) {
    const today = dayKey(d);
    if (podMem.lastDay === today) return false;
    podMem.days++;
    podMem.lastDay = today;
    savePodMem();
    return true;
  }

  function dayMilestone() {
    if (![2, 3, 7, 14, 30, 50, 100, 200, 365, 500, 1000].includes(podMem.days) || podMem.milestone === podMem.days) return;
    podMem.milestone = podMem.days;
    savePodMem();
    podSay(PE.dayMilestone);
  }

  // First contact, a quick restart, or a return after a long absence each get their own greeting.
  function greet() {
    const now = Date.now(), d = new Date(now), h = d.getHours();
    const gap = podLastSeen ? now - podLastSeen : 0;
    const first = !podMem.first;
    if (first) podMem.first = now;
    countDay(d);
    pod.greeted = true;
    podMem.last = now;
    savePodMem();
    if (first) {
      podSay(PE.greetFirst);
    } else if (gap > 20 * 3600000) {
      podSay(PE.greetReturn, { away: fmtAway(gap) });
    } else if (gap < 2 * 3600000) {
      podSay(PE.greetAgain);
    } else {
      let hello = K('Terminal link established. Good evening, {u}.');
      if (h < 5) hello = K('Terminal link established. It is late, {u}.');
      else if (h < 12) hello = K('Terminal link established. Good morning, {u}.');
      else if (h < 18) hello = K('Terminal link established. Good afternoon, {u}.');
      say('Report', T(hello));
    }
    if (!first) dayMilestone();
    const egg = (P.dates || {})[(d.getMonth() + 1) + '-' + d.getDate()];
    if (egg) sayLine(egg, podVars());
    if (h < 5) say('Proposal', T('Current hour is outside the recommended operating window. Rest is advised.'));
    else if (h >= 17 && games.moon && games.moon(d).name === 'FULL MOON') podSay(PE.fullMoon);
  }

  // ---------- character gallery (directory property) ----------

  const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;
  const MAX_RECORDS = 200;
  const gallery = {
    files: [],
    order: [],
    pos: 0,
    current: '',
    folder: '',
    shuffled: false,
    lastSwitch: 0,
    failed: 0,
    token: 0,
    fallbackTimer: 0,
    bundled: false, // showing the character set that ships with the wallpaper (no folder chosen)
    pinned: '' // file deployed from the ARCHIVE place; holds the rotation
  };
  // Only tall, high-res cutouts stand on the desktop; icons, screenshots and JPEGs stay in ARCHIVE.
  const desktopFit = (w, h, file) => h >= 600 && h >= w * 1.05 && !/\.jpe?g$/i.test(file);
  const fitCache = {}; // file -> desktopFit result, once its image has loaded
  const pinnedName = () => store.get('pinned', '');
  const artFront = { dos: 'a', show: 'a' };
  const portraitMQ = window.matchMedia('(max-aspect-ratio: 1/1)');
  portraitMQ.addEventListener('change', () => applyGallery());
  const normPath = (p) => plainPath(p).replace(/\\/g, '/').toLowerCase();
  const pad3 = (n) => String(n).padStart(3, '0');

  // "01 - 2B - YoRHa No.2 Type B.png" -> { name: "2B", sub: "YoRHa No.2 Type B" }
  function parseCharName(path) {
    let base = baseName(path).replace(/\.[a-z0-9]+$/i, '');
    base = base.replace(/^\d+\s*[-_.)\s]\s*/, '');
    const parts = base.split(/\s+-\s+|\s*\|\s*/);
    const clean = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return { name: clean(parts[0]) || 'UNKNOWN', sub: clean(parts.slice(1).join(' - ')) };
  }

  // Returns an English key (the Pod's dialogue is keyed on it); translate it for display.
  function affiliation(info) {
    const s = (info.name + ' ' + info.sub).toLowerCase();
    if (/reincarnation/.test(s)) return K('ALTERNATE RECORD');
    if (/machine/.test(s)) return K('MACHINE LIFEFORM');
    if (/resistance/.test(s)) return K('RESISTANCE');
    if (/yorha|operator|pod|commander/.test(s)) return K('YORHA');
    if (/android/.test(s)) return K('ANDROID');
    return K('UNCLASSIFIED');
  }

  function rebuildOrder() {
    const n = gallery.files.length;
    gallery.order = Array.from({ length: n }, (_, i) => i);
    gallery.shuffled = !!cfg.charShuffle;
    if (gallery.shuffled) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = gallery.order[i];
        gallery.order[i] = gallery.order[j];
        gallery.order[j] = tmp;
      }
    }
    const cur = gallery.files.indexOf(gallery.current);
    gallery.pos = Math.max(0, gallery.order.indexOf(cur));
  }

  function setGalleryFiles(list) {
    const before = gallery.files.length;
    const seen = new Set();
    const files = [];
    for (const p of list) {
      if (!p || !IMAGE_EXT.test(p)) continue;
      const key = normPath(p);
      if (seen.has(key)) continue;
      seen.add(key);
      files.push(p);
      if (files.length >= MAX_RECORDS) break;
    }
    files.sort((a, b) => baseName(a).localeCompare(baseName(b), undefined, { numeric: true, sensitivity: 'base' }));
    gallery.files = files;
    // A record deployed from the ARCHIVE place stays on the desktop across restarts.
    const pin = pinnedName();
    gallery.pinned = (pin && files.find((p) => baseName(p) === pin)) || '';
    rebuildOrder();
    if (gallery.pinned && gallery.current !== gallery.pinned) {
      gallery.pos = Math.max(0, gallery.order.indexOf(files.indexOf(gallery.pinned)));
      gallery.current = ''; // forces showRecord below
    }
    buildDots();
    applyGallery();
    if (nav.place === 'archive') renderArchive();
    unitRefresh(true);

    if (!files.length) {
      gallery.current = '';
      gallery.token++;
      for (const id of ['dos-a', 'dos-b', 'show-a', 'show-b']) {
        $(id).classList.remove('on');
        $(id).removeAttribute('src');
      }
      return;
    }
    if (!before) say('Report', T('Character archive synchronized. {records} found.', { records: TN(files.length, '{n} record|{n} records') }));
    if (files.indexOf(gallery.current) < 0) {
      gallery.failed = 0;
      showRecord();
    } else {
      updateDossier();
    }
  }

  function applyGallery() {
    const has = gallery.files.length > 0;
    const mode = charMode();
    const size = clamp(cfg.showcaseSize, 30, 100) / 100;
    $('view-archive').classList.toggle('gallery', has);
    document.body.classList.toggle('has-showcase', has && mode !== 'off');
    // Portrait screens put the character in the empty lower half instead of full height.
    $('showcase').style.height = portraitMQ.matches ? 'calc(48vh * ' + size + ')' : 'calc((100vh - 12.1rem) * ' + size + ')';
    if (has && gallery.shuffled !== !!cfg.charShuffle) rebuildOrder();
    layoutActor();
    fitShowLabel();
  }

  // The vertical name beside the desktop character: shrink it if it would run past the bottom of the showcase.
  function fitShowLabel() {
    const region = $('showcase'), name = $('show-name'), label = name.parentNode;
    name.style.fontSize = '';
    const over = label.offsetTop + label.scrollHeight - region.clientHeight; // scrollHeight: the CSS cap clips it
    if (!region.clientHeight || over <= 0) return;
    const size = parseFloat(getComputedStyle(name).fontSize);
    const len = name.offsetHeight;
    name.style.fontSize = Math.max(size * 0.45, size * (len - over) / len) + 'px';
  }

  function showRecord() {
    const file = gallery.files[gallery.order[gallery.pos]];
    if (!file) return;
    const token = ++gallery.token;
    const url = fileUrl(file);
    const probe = new Image();
    probe.onload = () => {
      if (token !== gallery.token) return;
      gallery.failed = 0;
      gallery.current = file;
      gallery.lastSwitch = Date.now();
      swapArt('dos', url);
      const fits = desktopFit(probe.naturalWidth, probe.naturalHeight, file);
      fitCache[file] = fits;
      if (fits) {
        $('showcase').classList.remove('show-empty');
        swapArt('show', url);
        actor.nw = probe.naturalWidth;
        actor.nh = probe.naturalHeight;
        const fig = figureOf(file, probe);
        actor.frame = !!(fig && fig.frame);
        actor.head = fig && !fig.frame ? fig : CORNER_HEAD;
        if (actor.frame) actor.facing = 1;
        actor.ready = true;
        layoutActor();
        syncDesktopAcc();
        emote('sparkle');
        // Now and then the Pod comments on who just stepped onto the desktop (not on the first one).
        if (pod.charsShown++ > 0 && Date.now() - pod.lastChar > 180000 && Math.random() < 0.4) {
          pod.lastChar = Date.now();
          setTimeout(podCharLine, 1500);
        }
      } else {
        $('showcase').classList.add('show-empty');
        $('show-a').classList.remove('on');
        $('show-b').classList.remove('on');
        placeAcc($('actor-acc'), '', null);
        clearTimeout(actor.bubbleTimer);
        actor.bubble.classList.remove('show');
      }
      updateDossier();
    };
    probe.onerror = () => {
      if (token !== gallery.token) return;
      if (++gallery.failed < gallery.files.length) nextRecord();
      else say('Alert', T('No readable visual records in the character folder.'));
    };
    probe.src = url;
  }

  function nextRecord() {
    if (!gallery.files.length) return;
    gallery.lastSwitch = Date.now();
    gallery.pos++;
    if (gallery.pos >= gallery.order.length) {
      gallery.pos = 0;
      if (cfg.charShuffle && gallery.files.length > 2) {
        const last = gallery.files.indexOf(gallery.current);
        rebuildOrder();
        if (gallery.order[0] === last) gallery.order.push(gallery.order.shift());
        gallery.pos = 0;
      }
    }
    showRecord();
  }

  // Cross-fade between two stacked <img> elements with a top-down reveal.
  function swapArt(prefix, url) {
    const cur = $(prefix + '-' + artFront[prefix]);
    const nextKey = artFront[prefix] === 'a' ? 'b' : 'a';
    const nxt = $(prefix + '-' + nextKey);
    nxt.src = url;
    nxt.classList.remove('on');
    void nxt.offsetWidth;
    nxt.classList.add('on');
    cur.classList.remove('on');
    artFront[prefix] = nextKey;
    const box = prefix === 'dos' ? $('dossier-art') : $('showcase');
    box.classList.remove('revealing');
    void box.offsetWidth;
    box.classList.add('revealing');
  }

  function buildDots() {
    const box = $('d-dots');
    box.textContent = '';
    if (gallery.files.length > 48) return;
    for (let i = 0; i < gallery.files.length; i++) box.appendChild(document.createElement('span'));
  }

  function updateDossier() {
    const idx = gallery.files.indexOf(gallery.current);
    if (idx < 0) return;
    const info = parseCharName(gallery.current);
    setText($('d-name'), info.name.toUpperCase());
    fitText($('d-name'));
    setText($('d-sub'), info.sub);
    setText($('d-record'), pad3(idx + 1) + ' / ' + pad3(gallery.files.length));
    setText($('d-aff'), T(affiliation(info)));
    setText($('show-name'), info.name.toUpperCase());
    setText($('show-sub'), info.sub);
    fitShowLabel();
    const dots = $('d-dots').children;
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === idx);
    updateDossierNext(Date.now());
    if (nav.place === 'archive') refreshArcLive();
  }

  function updateDossierNext(now) {
    setText($('d-status'), gallery.pinned ? T('DEPLOYED') : T('ARCHIVED'));
    if (gallery.pinned) {
      setText($('d-next'), T('ROTATION HELD'));
      return;
    }
    if (gallery.files.length < 2) {
      setText($('d-next'), gallery.files.length ? T('NONE') : '--');
      return;
    }
    const nextIdx = gallery.order[(gallery.pos + 1) % gallery.order.length];
    const secs = Math.max(0, Math.ceil((gallery.lastSwitch + clamp(cfg.charInterval, 3, 3600) * 1000 - now) / 1000));
    // Countdown first, so a long name only ever truncates its own tail.
    setText($('d-next'), T('{s} SEC  //  {name}', { s: secs, name: parseCharName(gallery.files[nextIdx]).name.toUpperCase() }));
  }

  function galleryTick(now) {
    if (gallery.files.length < 2 || !gallery.current || gallery.pinned) return;
    if (now - gallery.lastSwitch >= clamp(cfg.charInterval, 3, 3600) * 1000) nextRecord();
  }

  // The character set that ships with the wallpaper (bundled.js lists its NieRCharacters folder),
  // shown until the user picks a folder of their own.
  function bundledFiles() {
    const b = window.YoRHaBundled;
    if (!b || !Array.isArray(b.files)) return [];
    return b.files.map((f) => (b.folder ? b.folder + '/' : '') + f);
  }

  function useBundled() {
    const list = bundledFiles();
    gallery.bundled = list.length > 0;
    setGalleryFiles(list);
  }

  // Folder changed in the properties. File lists arrive through the directory events below.
  function onFolderChange(folder) {
    folder = folder || '';
    const prev = gallery.folder;
    gallery.folder = folder;
    clearTimeout(gallery.fallbackTimer);
    if (!folder) {
      useBundled();
      return;
    }
    if (gallery.bundled) {
      gallery.bundled = false;
      setGalleryFiles([]);
    } else if (prev && normPath(prev) !== normPath(folder)) {
      const prefix = normPath(folder).replace(/\/+$/, '') + '/';
      setGalleryFiles(gallery.files.filter((p) => normPath(p).startsWith(prefix)));
    }
    gallery.fallbackTimer = setTimeout(requestRandomFallback, 3000);
  }

  // Safety net: if no file list arrived, sample the folder through the on-demand API instead.
  function requestRandomFallback() {
    if (gallery.files.length || !gallery.folder || typeof window.wallpaperRequestRandomFileForProperty !== 'function') return;
    const found = [];
    let pending = 30;
    for (let i = 0; i < 30; i++) {
      window.wallpaperRequestRandomFileForProperty('charfolder', (name, file) => {
        if (file) found.push(file);
        if (--pending === 0 && !gallery.files.length) setGalleryFiles(found);
      });
    }
  }

  $('dossier-art').addEventListener('click', () => {
    if (!gallery.pinned) nextRecord();
  });

  // ---------- desktop character: idle motion, actions, emotes ----------
  // A flat PNG cannot be rigged, so motion comes from transforms on the whole cutout,
  // pivoting at the feet: breathing, sway, hops, nods and turns.

  const charMode = () => (cfg.charMode === 'off' ? 'off' : 'stand');

  const actor = {
    el: $('actor'),
    body: $('actor-body'),
    bubble: $('emote'),
    ready: false,
    nw: 0, nh: 0, w: 0, h: 0,
    facing: 1, flip: 1,
    action: null, actionStart: 0,
    bubbleTimer: 0, nextEvent: 0, lastNear: 0,
    pokes: [], lastPokeMsg: 0, lastMouseMove: Date.now(),
    // head anchor as fractions of the image box; frame = opaque portrait (no cutout)
    head: null, frame: false,
    tf: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
    side: 1, bw: 0, bh: 0, bubbleFade: 0,
    boxLeft: 0, boxTop: 0, rem: 16, safeTop: 0
  };
  // Opaque portraits have no findable head, so the bubble hangs off the top-right corner instead.
  const CORNER_HEAD = { hx: 0.9, hy: 0, hw: 0 };

  // Find the head of a transparent cutout: skip thin bits at the top (weapons, hair tufts),
  // then take the densest column in the head band. Returns null if pixels cannot be read.
  function analyzeFigure(img) {
    const sh = 160;
    const sw = Math.max(8, Math.round(sh * img.naturalWidth / Math.max(1, img.naturalHeight)));
    let data;
    try {
      const c = document.createElement('canvas');
      c.width = sw;
      c.height = sh;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, sw, sh);
      data = g.getImageData(0, 0, sw, sh).data;
    } catch (e) {
      return null; // tainted canvas: fall back to the corner anchor
    }
    const solid = (x, y) => data[(y * sw + x) * 4 + 3] >= 96;
    // wide = first row with a solid run as wide as a small head, so rifles and antennae are skipped
    const headRun = Math.max(3, sw * 0.08);
    let clear = 0, top = -1, bottom = -1, wide = -1;
    for (let y = 0; y < sh; y++) {
      let run = 0, longest = 0;
      for (let x = 0; x < sw; x++) {
        const a = data[(y * sw + x) * 4 + 3];
        if (a < 24) clear++;
        run = a >= 96 ? run + 1 : 0;
        if (run > longest) longest = run;
      }
      if (longest) {
        if (top < 0) top = y;
        bottom = y;
        if (wide < 0 && longest >= headRun) wide = y;
      }
    }
    if (top < 0 || clear < sw * sh * 0.04) return { frame: true };
    if (wide < 0) wide = top;
    const band = Math.max(4, Math.round((bottom - wide + 1) * 0.14));
    const mass = new Float32Array(sw);
    for (let y = wide; y < Math.min(sh, wide + band); y++) {
      for (let x = 0; x < sw; x++) if (solid(x, y)) mass[x]++;
    }
    // Smooth over roughly a head width so a thin vertical object cannot outweigh the head.
    const win = Math.max(3, Math.round(sw * 0.05));
    let best = -1, hx = Math.floor(sw / 2);
    for (let x = 0; x < sw; x++) {
      let s = 0;
      for (let d = -win; d <= win; d++) if (x + d >= 0 && x + d < sw) s += mass[x + d];
      if (s > best) {
        best = s;
        hx = x;
      }
    }
    let hy = wide;
    search: for (let y = Math.max(top, wide - Math.round(band * 0.5)); y < sh; y++) {
      for (let d = -2; d <= 2; d++) {
        if (hx + d >= 0 && hx + d < sw && solid(hx + d, y)) {
          hy = y;
          break search;
        }
      }
    }
    const row = Math.min(sh - 1, wide + Math.round(band * 0.6));
    let l = hx, r = hx;
    while (l > 0 && solid(l - 1, row)) l--;
    while (r < sw - 1 && solid(r + 1, row)) r++;
    const hw = clamp((r - l + 1) / 2, sw * 0.04, sw * 0.22);
    return { frame: false, hx: hx / sw, hy: hy / sh, hw: hw / sw };
  }

  // Reading a big render's pixels costs tens of milliseconds on the main thread (about 80 ms for a
  // 2400 x 4600 PNG), so each file is analysed once per session, not on every rotation.
  const figures = {};
  const figureOf = (file, img) => (file in figures ? figures[file] : (figures[file] = analyzeFigure(img)));

  // Grids (ARCHIVE, WARDROBE) show small copies: each file is decoded once, scaled down and kept for the
  // session, one at a time, so a page of records does not hold a dozen full-size renders in memory.
  const THUMB_H = 400;
  const thumbs = { done: {}, waiting: {}, queue: [], busy: false };

  function thumbFor(file, cb) {
    if (file in thumbs.done) return cb(thumbs.done[file]);
    if (thumbs.waiting[file]) return thumbs.waiting[file].push(cb);
    thumbs.waiting[file] = [cb];
    thumbs.queue.push(file);
    pumpThumbs();
  }

  function pumpThumbs() {
    if (thumbs.busy || !thumbs.queue.length) return;
    thumbs.busy = true;
    const file = thumbs.queue.shift();
    const finish = (bmp) => {
      thumbs.done[file] = bmp || null; // null: show the full image instead
      const cbs = thumbs.waiting[file] || [];
      delete thumbs.waiting[file];
      thumbs.busy = false;
      for (const f of cbs) f(thumbs.done[file]);
      setTimeout(pumpThumbs, 0); // let a frame through between files
    };
    if (typeof window.createImageBitmap !== 'function') return finish(null);
    const img = new Image();
    img.onload = () => {
      const h = Math.min(THUMB_H, img.naturalHeight || 1);
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * h / (img.naturalHeight || 1)));
      window.createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }).then(finish, () => finish(null));
    };
    img.onerror = () => finish(null);
    img.src = fileUrl(file);
  }

  function fullImg(file, cls) {
    const img = document.createElement('img');
    img.className = cls || '';
    img.alt = '';
    img.decoding = 'async';
    img.src = fileUrl(file);
    return img;
  }

  // A canvas that receives the small copy when it is ready (a canvas can show any image, readable or not).
  function thumbEl(file, cls) {
    if (thumbs.done[file] === null) return fullImg(file, cls);
    const c = document.createElement('canvas');
    c.className = cls || '';
    c.width = c.height = 1;
    thumbFor(file, (bmp) => {
      if (!bmp) {
        if (c.parentNode) c.parentNode.replaceChild(fullImg(file, cls), c);
        return;
      }
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
    });
    return c;
  }

  // Head position after the current body transform (pivot at the feet), in actor-box px.
  function headPoint() {
    const w = actor.w, h = actor.h, hd = actor.head || CORNER_HEAD, f = actor.tf;
    const dx = (hd.hx * w - w / 2) * f.sx, dy = (hd.hy * h - h) * f.sy;
    const a = f.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: w / 2 + f.tx + dx * c - dy * s, y: h + f.ty + dx * s + dy * c, hw: hd.hw * w * Math.abs(f.sx) };
  }

  // Pin the bubble's tail just beside the head, kept under the top bar and on screen.
  function placeBubble() {
    const p = headPoint(), rem = actor.rem;
    const tipX = p.x + actor.side * p.hw * 0.6;
    const tipY = p.y + p.hw * 0.25;
    let x = actor.side > 0 ? tipX - 0.5 * rem : tipX - actor.bw + 0.5 * rem;
    let y = tipY - 0.55 * rem - actor.bh;
    y = Math.max(y, actor.safeTop - actor.boxTop);
    x = clamp(x, 0.8 * rem - actor.boxLeft, window.innerWidth - 0.8 * rem - actor.boxLeft - actor.bw);
    const b = actor.bubble;
    const sx = x.toFixed(1) + 'px', sy = y.toFixed(1) + 'px';
    if (b.style.left !== sx) b.style.left = sx;
    if (b.style.top !== sy) b.style.top = sy;
  }

  const EMOTE_SVG = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.6 1.3 4.5 2.6.3.5 1 .5 1.3 0 .9-1.3 2.3-2.6 4.5-2.6 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 18.5a3 3 0 1 1-2-2.83V4l12-2v12.5a3 3 0 1 1-2-2.83V6.3L9 7.6z"/></svg>',
    sweat: '<svg viewBox="0 0 24 24"><path d="M12 2C9 7 6 10.5 6 14a6 6 0 0 0 12 0c0-3.5-3-7-6-12z"/></svg>',
    anger: '<svg viewBox="0 0 24 24"><path d="M4 9h5V4h2v7H4zM15 4h2v5h5v2h-7zM4 13h7v7H9v-5H4zM13 13h7v2h-5v5h-2z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 1l2.2 7.8L22 11l-7.8 2.2L12 21l-2.2-7.8L2 11l7.8-2.2z"/></svg>'
  };
  const EMOTE_TEXT = { alert: '!', question: '?', dots: '...', sleep: 'Zz', surprise: '!?' };

  // Each action maps progress p (0..1) to a transform offset; h is the figure height in px.
  const env = (p) => (p < 0.2 ? p / 0.2 : p > 0.8 ? (1 - p) / 0.2 : 1);
  const ACTIONS = {
    hop: { dur: 0.6, f: (p, h) => ({ ty: -Math.sin(Math.PI * p) * 0.07 * h, sy: 1 + 0.04 * Math.sin(Math.PI * p) - (p < 0.12 || p > 0.88 ? 0.035 : 0) }) },
    doubleHop: { dur: 0.9, f: (p, h) => { const q = (p * 2) % 1; return { ty: -Math.sin(Math.PI * q) * 0.05 * h, sy: 1 + 0.03 * Math.sin(Math.PI * q) }; } },
    nod: { dur: 0.9, f: (p) => ({ rot: Math.max(0, Math.sin(p * Math.PI * 4)) * 2.4 * (1 - p * 0.5) }) },
    shake: { dur: 0.7, f: (p, h) => ({ tx: Math.sin(p * Math.PI * 6) * 0.025 * h * (1 - p) }) },
    tilt: { dur: 1.8, f: (p) => ({ rot: -3.5 * env(p) }) },
    spin: { dur: 0.9, f: (p) => ({ sx: Math.cos(p * Math.PI * 2) }) },
    float: { dur: 2.6, f: (p, h, t) => ({ ty: -0.07 * h * env(p), rot: Math.sin(t * 3) * 1.2 * env(p) }) },
    stretch: { dur: 1.6, f: (p) => ({ sy: 1 + 0.045 * env(p), sx: 1 - 0.025 * env(p) }) },
    surprise: { dur: 0.45, f: (p, h) => ({ ty: -Math.sin(Math.PI * p) * 0.03 * h, sy: 1 + 0.05 * Math.sin(Math.PI * p) }) },
    droop: { dur: 3.5, f: (p) => ({ rot: 2.2 * env(p), sy: 1 - 0.012 * env(p) }) }
  };

  const actorVisible = () => actor.ready && !nav.place && document.body.classList.contains('has-showcase') &&
    !$('showcase').classList.contains('show-empty');
  const musicActive = () => audio.hasApi && performance.now() - audio.lastSignal < 1500 && audio.level > 0.04;
  const charName = () => (gallery.current ? parseCharName(gallery.current).name : unit());

  function customLines() {
    const own = cfg.emoteLines !== DEFAULTS.emoteLines;
    return String(cfg.emoteLines || '').split('|').map((s) => s.trim().slice(0, 60)).filter(Boolean).slice(0, 30)
      .map((s) => (own ? s : T(s)));
  }

  function act(name) {
    if (!ACTIONS[name]) return;
    actor.action = name;
    actor.actionStart = performance.now();
  }

  function emote(kind, text) {
    if (!actorVisible()) return;
    const b = actor.bubble;
    b.className = 'emote';
    if (kind === 'say') {
      b.textContent = text;
      b.classList.add('speech');
    } else if (EMOTE_SVG[kind]) {
      b.innerHTML = EMOTE_SVG[kind];
    } else {
      b.textContent = EMOTE_TEXT[kind] || '!';
    }
    // Measure, then hang the bubble on whichever side of the head has room.
    actor.bw = b.offsetWidth;
    actor.bh = b.offsetHeight;
    const p = headPoint();
    actor.side = actor.boxLeft + p.x + p.hw * 0.6 + actor.bw > window.innerWidth - 0.8 * actor.rem ? -1 : 1;
    // Never hang it over the agenda or a calendar alert above the hub panel (they sit on a higher layer).
    if (actor.side < 0) {
      const slot = $('hubslot').getBoundingClientRect();
      if (slot.height > 0 && actor.boxLeft + p.x - p.hw * 0.6 - actor.bw < slot.right &&
        actor.boxTop + p.y - actor.bh - actor.rem < slot.bottom) actor.side = 1;
    }
    b.classList.toggle('left', actor.side < 0);
    placeBubble();
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(actor.bubbleTimer);
    const hold = kind === 'say' ? 3800 : 2200;
    actor.bubbleFade = performance.now() + hold + 500;
    actor.bubbleTimer = setTimeout(() => b.classList.remove('show'), hold);
  }

  // Fit the actor box to the image so the feet sit on the box bottom (the transform pivot).
  function layoutActor() {
    const region = $('showcase');
    const RW = region.clientWidth, RH = region.clientHeight;
    if (!actor.nw || !actor.nh || !RW || !RH) return;
    const s = Math.min(RW / actor.nw, RH / actor.nh);
    actor.w = Math.round(actor.nw * s);
    actor.h = Math.round(actor.nh * s);
    actor.el.style.width = actor.w + 'px';
    actor.el.style.height = actor.h + 'px';
    actor.el.style.left = Math.round((RW - actor.w) / 2) + 'px';
    const rr = region.getBoundingClientRect();
    actor.boxLeft = rr.left + Math.round((RW - actor.w) / 2);
    actor.boxTop = rr.top;
    actor.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    actor.safeTop = $('topbar').getBoundingClientRect().bottom + 0.5 * actor.rem;
  }

  // Per-frame motion: idle breathing + sway, beat bob while music plays, then the current action.
  function updateActor(dt, t) {
    if (!actorVisible()) return;
    const h = actor.h || 400;
    let tx = 0, ty = 0, rot = 0, sx = 1, sy = 1;
    const br = Math.sin(t * (new Date().getHours() < 5 ? 1.0 : 1.7));
    sy *= 1 + 0.007 * br;
    sx *= 1 - 0.0035 * br;
    rot += Math.sin(t * 0.6) * 0.45;

    if (musicActive()) {
      const b = bass();
      ty -= b * h * 0.025;
      rot += Math.sin(t * 3.2) * (0.6 + b * 1.5);
    }

    if (actor.action) {
      const a = ACTIONS[actor.action];
      const p = (performance.now() - actor.actionStart) / (a.dur * 1000);
      if (p >= 1) {
        actor.action = null;
      } else {
        const o = a.f(p, h, t);
        tx += o.tx || 0;
        ty += o.ty || 0;
        rot += o.rot || 0;
        if (o.sx !== undefined) sx *= o.sx;
        if (o.sy !== undefined) sy *= o.sy;
      }
    }

    // Easing the flip through zero reads as the figure turning around.
    actor.flip += (actor.facing - actor.flip) * Math.min(1, dt * 9);
    sx *= actor.flip;
    actor.body.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' +
      rot.toFixed(2) + 'deg) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
    const f = actor.tf;
    f.tx = tx;
    f.ty = ty;
    f.rot = rot;
    f.sx = sx;
    f.sy = sy;
    if (performance.now() < actor.bubbleFade) placeBubble(); // the bubble rides along with hops and sways
  }

  // 4 Hz behaviour: mouse awareness, random actions and emotes.
  function actorTick() {
    if (!actorVisible()) return;
    const now = performance.now();
    checkNear(now);
    if (cfg.emoteFreq <= 0 || now < actor.nextEvent) return;
    actor.nextEvent = now + (60 / clamp(cfg.emoteFreq, 1, 10)) * 1000 * (0.6 + Math.random() * 0.8);
    if (actor.action) return;

    const sleepy = new Date().getHours() < 5 || Date.now() - actor.lastMouseMove > 15 * 60000;
    if (sleepy && Math.random() < 0.6) {
      act(Math.random() < 0.5 ? 'droop' : 'stretch');
      emote('sleep');
      return;
    }
    // Your unit shows how it is doing: sleepy, sulking, battered or delighted.
    const need = isUnit(gallery.current) ? unitNeed() : '';
    if (need && Math.random() < (need === 'rest' ? 0.75 : 0.4)) {
      if (need === 'rest' || need === 'tired') {
        act('droop');
        emote('sleep');
      } else if (need === 'sad') {
        act('droop');
        emote('dots');
      } else if (need === 'hurt') {
        act('shake');
        emote('sweat');
      } else {
        act(Math.random() < 0.5 ? 'hop' : 'float');
        emote('heart');
      }
      return;
    }
    if (musicActive() && Math.random() < 0.7) {
      act(Math.random() < 0.5 ? 'doubleHop' : 'hop');
      emote('music');
      return;
    }
    const lines = customLines();
    if (lines.length && Math.random() < 0.25) {
      act('nod');
      emote('say', lines[Math.floor(Math.random() * lines.length)]);
      return;
    }
    const picks = [['tilt', 'question'], ['hop', 'sparkle'], [null, 'dots'], ['nod', 'heart'], ['turn', null],
      ['stretch', null], ['float', 'sparkle'], ['spin', 'surprise'], ['surprise', 'alert']];
    const pick = picks[Math.floor(Math.random() * picks.length)];
    // A rectangular portrait would show its mirrored background, so frames never turn or spin.
    let move = pick[0];
    if (actor.frame && (move === 'turn' || move === 'spin')) move = 'tilt';
    if (move === 'turn') actor.facing *= -1;
    else if (move) act(move);
    if (pick[1]) emote(pick[1]);
  }

  // Notice the cursor passing close to the head: turn toward it and react.
  function checkNear(now) {
    if (now - actor.lastNear < 12000 || Date.now() - actor.lastMouseMove > 800) return;
    const r = actor.el.getBoundingClientRect();
    const mx = (state.mouseX + 0.5) * window.innerWidth, my = (state.mouseY + 0.5) * window.innerHeight;
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    if (Math.hypot(mx - cx, my - cy) > Math.max(120, r.height * 0.35)) return;
    actor.lastNear = now;
    if (!actor.frame) actor.facing = mx < cx ? -1 : 1;
    act('surprise');
    emote('alert');
  }

  actor.el.addEventListener('pointerdown', () => {
    if (isUnit(gallery.current)) unitPat(true);
    const now = performance.now();
    actor.pokes = actor.pokes.filter((p) => now - p < 8000);
    actor.pokes.push(now);
    const n = actor.pokes.length;
    if (n >= 5) {
      act('shake');
      emote('anger');
      if (Date.now() - actor.lastPokeMsg > 30000) {
        actor.lastPokeMsg = Date.now();
        if (!podSay(PE.poke)) say('Query', T('Why are you poking {c}?', { c: charName() }));
      }
    } else if (n >= 3) {
      act('shake');
      emote('sweat');
    } else {
      act(Math.random() < 0.5 ? 'hop' : 'surprise');
      emote(Math.random() < 0.5 ? 'heart' : 'sparkle');
    }
  });

  // ---------- glitch ----------

  function scheduleGlitch() {
    setTimeout(doGlitch, 18000 + Math.random() * 42000);
  }

  function doGlitch() {
    scheduleGlitch();
    if (!cfg.glitch || state.paused || document.hidden || gameBusy()) return;
    const layer = $('glitch');
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'slice ' + (Math.random() < 0.6 ? 'inv' : 'shift');
      s.style.top = (Math.random() * 95).toFixed(2) + '%';
      s.style.height = (0.3 + Math.random() * 3.5).toFixed(2) + 'vh';
      layer.appendChild(s);
    }
    document.body.classList.add('glitching');
    setTimeout(() => {
      layer.textContent = '';
      document.body.classList.remove('glitching');
    }, 120 + Math.random() * 220);
    if (Math.random() < 0.12) podSay(PE.glitch);
    if (Math.random() < 0.35) {
      act('shake');
      emote('sweat');
    }
  }

  // ---------- parallax ----------

  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    // Back from a long absence (Wallpaper Engine only sends mouse input while the desktop is in view).
    const away = now - nav.lastInput;
    if (away > 5 * 60000 && now - pod.lastBack > 10 * 60000) {
      pod.lastBack = now;
      podSay(PE.back, { away: fmtAway(away) });
    }
    state.mouseX = e.clientX / window.innerWidth - 0.5;
    state.mouseY = e.clientY / window.innerHeight - 0.5;
    actor.lastMouseMove = now;
    nav.lastInput = now;
    podMouse(e, now);
  });
  document.addEventListener('pointerdown', (e) => {
    const now = Date.now();
    nav.lastInput = now;
    // A click on bare desktop, now and then, gets a puzzled remark.
    const t = e.target;
    if (!nav.place && t && t.closest && !t.closest('#menu, #panel, #podlog, .actor') &&
      now - pod.lastDesk > 180000 && Math.random() < 0.4) {
      pod.lastDesk = now;
      podSay(PE.deskClick);
    }
  });
  // Wallpaper Engine forwards no keys, but Esc is handy in a browser preview.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.place) go('');
  });

  function updateParallax(dt) {
    if (!cfg.parallax) return;
    const f = Math.min(1, dt * 3);
    // Places hold still so clicks land where the eye expects (games, the globe).
    const mx = nav.place ? 0 : state.mouseX, my = nav.place ? 0 : state.mouseY;
    const nx = state.parX + (mx - state.parX) * f;
    const ny = state.parY + (my - state.parY) * f;
    if (Math.abs(nx - state.parX) + Math.abs(ny - state.parY) < 0.0002) return;
    state.parX = nx;
    state.parY = ny;
    els.ui.style.transform = 'translate(' + (-nx * 12).toFixed(2) + 'px,' + (-ny * 9).toFixed(2) + 'px)';
    els.grid.style.transform = 'translate(' + (nx * 7).toFixed(2) + 'px,' + (ny * 5).toFixed(2) + 'px)';
  }

  // ---------- places: destinations opened from the hub ----------
  // The hub is the desktop terminal. Each menu entry opens a full-screen place with a tab bar,
  // a sub-menu and its own views. HUB (or leaving the mouse alone) returns to the desktop.

  const TWO_PI = Math.PI * 2;
  const PLACES = {
    map: { title: K('MAP'), sub: K('ORBITAL OVERVIEW // SURVEY'), hover: true },
    quests: { title: K('QUESTS'), sub: K('OPERATIONS AND ORDERS') },
    intel: { title: K('INTEL'), sub: K('SIGNAL ARCHIVE') },
    archive: { title: K('ARCHIVE'), sub: K('CHARACTER RECORDS') },
    unit: { title: K('UNIT'), sub: K('MAINTENANCE AND BOND') },
    hacking: { title: K('HACKING'), sub: K('INTRUSION DRILLS') },
    garden: { title: K('GARDEN'), sub: K('LUNAR TEAR FIELD') },
    system: { title: K('SYSTEM'), sub: K('UNIT CONFIGURATION') }
  };
  const hooks = {}; // per place: enter, leave, sub(id), refresh(now, force), frame(dt, t)

  // Mini-games and the garden live in games.js and only see this small API.
  const games = window.YoRHaGames || {};
  const gameApi = {
    store: store,
    dpr: dpr,
    fit: fitCanvas,
    get font() { return canvasFont(); },
    colors: () => state.colors,
    bass: bass,
    unit: unit,
    say: (kind, text) => say(kind, text)
  };
  const intercept = games.intercept ? games.intercept($('g-intercept'), gameApi) : null;
  const logic = games.logic ? games.logic($('g-logic'), gameApi) : null;
  const garden = games.garden ? games.garden($('g-garden'), gameApi) : null;
  // BREACH (breach3d.js) loads three.js and starts WebGL only when it is first opened.
  const games3d = window.YoRHaGames3D || {};
  const breach = games3d.breach ? games3d.breach($('g-breach'), gameApi) : null;

  function gameBusy() {
    return !!((breach && breach.busy()) || (intercept && intercept.busy()) || (logic && logic.busy()));
  }

  function placeItems(name) {
    switch (name) {
      case 'map':
        return LOCATIONS.map((l) => ({ id: l.id, label: l.name, desc: l.desc, view: 'pv-map' }));
      case 'quests':
        return [
          { id: 'ops', label: K('OPERATIONS'), desc: K('Progress of the current hour, day, week, month and year.') },
          { id: 'orders', label: K('DAILY ORDERS'), desc: K('Your own checklist. Click an order to mark it complete. Resets every day.') },
          { id: 'calendar', label: K('CALENDAR'), desc: K('Events and reminders. Click a day to open it; NEW ENTRY adds one. Alerts show above the hub panel with a chime.') },
          { id: 'schedule', label: K('WEEKLY SCHEDULE'), desc: K('Your week at a glance. Click an empty slot to add an activity, or an activity to change it.') },
          { id: 'timer', label: K('FOCUS TIMER'), desc: K('A timed operation for focused work. The Pod reports when it ends, even from the hub.') },
          { id: 'wellness', label: K('WELLNESS'), desc: K('Proposals to rest your eyes, drink water, stretch, check your posture and eat. Click an interval to change it.') }
        ];
      case 'unit':
        return [
          { id: 'care', label: K('CARE'), desc: K('Look after your unit. Its meters drift down over time; repairs, sleep and attention bring them back and build bond.') },
          { id: 'wardrobe', label: K('WARDROBE'), desc: K('Change outfits freely; accessories are earned through bond. Click one to equip it.') },
          { id: 'items', label: K('SUPPLIES'), desc: K('Items held, what they do and how to earn more.') },
          { id: 'deploy', label: K('DEPLOY TO DESKTOP'), desc: K('Keep your unit on the desktop in its current outfit and accessory.'), action: deployUnit },
          { id: 'change', label: K('CHANGE UNIT'), desc: K('Pick another character in ARCHIVE > CHARACTERS with SET AS UNIT. Bond and supplies carry over.'),
            action: () => go('archive', 'chars'), value: () => unitName().toUpperCase() }
        ];
      case 'intel':
        return [
          { id: 'now', label: K('NOW PLAYING'), desc: K('Live media signal through Wallpaper Engine media integration.') },
          { id: 'audio', label: K('AUDIO LOG'), desc: K('Tracks the terminal has picked up, newest first. Choose what is kept under QUICK SETTINGS // AUDIO LOG.') },
          { id: 'pod', label: K('POD ARCHIVE'), desc: K('Full record of Pod transmissions this session.') },
          { id: 'clearaudio', label: K('CLEAR AUDIO LOG'), desc: K('Erase every track in the audio log. Click twice to confirm.'),
            action: armClearAudio, armed: () => Date.now() < clearArm }
        ];
      case 'archive':
        return [
          { id: 'chars', label: K('CHARACTERS'), desc: K('Click a record to select it. Double-click it to deploy it to the desktop; rotation holds until you resume it. Only tall transparent PNGs stand on the desktop.') },
          { id: 'visual', label: K('VISUAL RECORD'), desc: K('The image assigned in the wallpaper properties.') }
        ];
      case 'hacking':
        return [
          { id: 'breach', label: K('BREACH'), desc: K('3D drill. The probe follows the cursor and fires on its own; click for a pulse. Break the shield nodes, then destroy every core before time runs out.') },
          { id: 'intercept', label: K('INTERCEPT'), desc: K('Click intrusion packets before they reach the core. Pod support crates clear the screen and repair it.') },
          { id: 'logic', label: K('LOGIC LOCK'), desc: K('Click tiles to rotate them until every terminal on the board is powered.') },
          { id: 'records', label: K('RECORDS'), desc: K('Best runs and fastest locks on this terminal.') }
        ];
      case 'garden':
        return [
          { id: 'field', label: K('FIELD'), desc: K('Click the ground to plant a Lunar Tear. Sweep the cursor across the flowers to stir the wind.') },
          { id: 'wind', label: K('WIND'), desc: K('Cursor: your movement makes gusts. Calm: still air. Storm: a constant gale.'),
            action: () => garden && garden.cycleWind(), value: () => (garden ? T(garden.windLabel()) : '--') },
          { id: 'clear', label: K('CLEAR FIELD'), desc: K('Let every flower wither and start over.'), action: () => garden && garden.clear() }
        ];
      case 'system':
        return [
          { id: 'diag', label: K('DIAGNOSTICS'), desc: K('Unit status, display and signal history.') },
          { id: 'settings', label: K('QUICK SETTINGS'), desc: K('Change the look and language from the desktop. Saved on this PC.') },
          { id: 'about', label: K('ABOUT'), desc: K('Terminal information.') }
        ];
    }
    return [];
  }

  K('CURSOR'); K('CALM'); K('STORM'); // garden wind labels (games.js)

  // CLEAR AUDIO LOG asks twice: the first click arms it for a few seconds.
  let clearArm = 0;
  function armClearAudio() {
    if (Date.now() < clearArm) {
      clearArm = 0;
      clearAudioLog();
    } else {
      clearArm = Date.now() + 4000;
    }
  }

  for (const name of PANELS) {
    const li = document.createElement('li');
    li.dataset.place = name;
    li.textContent = T(PLACES[name].title);
    li.addEventListener('click', () => go(name));
    $('tab-list').appendChild(li);
  }
  $('tab-back').addEventListener('click', () => go(''));

  // Wipe out, swap screens under the cover, wipe in. name '' = back to the hub.
  function go(name, sub) {
    if (nav.transit || (name && !PLACES[name])) return;
    if (name === nav.place) {
      if (sub) selectSub(sub);
      return;
    }
    const tr = $('transit');
    setText($('transit-label'), name ? T('ACCESSING // {place}', { place: T(PLACES[name].title) }) : T('RETURNING // HUB'));
    tr.classList.remove('run');
    void tr.offsetWidth;
    tr.classList.add('run');
    nav.transit = setTimeout(() => {
      if (name) showPlace(name, sub);
      else showHub();
      nav.transit = setTimeout(() => {
        tr.classList.remove('run');
        nav.transit = 0;
      }, 420);
    }, 360);
  }

  function leavePlace() {
    const h = hooks[nav.place];
    if (h && h.leave) h.leave();
  }

  function showPlace(name, sub) {
    leavePlace();
    nav.place = name;
    nav.sel = '';
    nav.lastInput = Date.now();
    document.body.classList.add('in-place');
    for (const li of $('tab-list').children) li.classList.toggle('active', li.dataset.place === name);
    setText($('side-title'), T(PLACES[name].title));
    setText($('place-sub'), T(PLACES[name].sub));
    buildSide(name);
    const views = nav.items.filter((i) => !i.action);
    const want = views.find((i) => i.id === sub) || views.find((i) => i.id === nav.sub[name]) || views[0];
    if (hooks[name] && hooks[name].enter) hooks[name].enter();
    selectSub(want.id);
    setText($('tab-clock'), timeHM(new Date()));
    if (!pod.placesSeen[name] && Math.random() < 0.7) podSay((PE.place || {})[name]);
    pod.placesSeen[name] = true;
    placeWellCard();
  }

  function showHub() {
    leavePlace();
    nav.place = '';
    nav.sel = '';
    document.body.classList.remove('in-place');
    for (const v of document.querySelectorAll('#place-main .pview')) v.classList.remove('active');
    positionCursor();
    layoutActor();
    fitNames(); // names that changed while the hub was hidden could not be measured then
    fitShowLabel();
    refreshPanel(Date.now());
    placeWellCard();
    planner.showHub();
  }

  function buildSide(name) {
    const ul = $('side-list');
    ul.textContent = '';
    nav.items = placeItems(name);
    for (const it of nav.items) {
      const li = document.createElement('li');
      li.dataset.sub = it.id;
      const lab = document.createElement('span');
      lab.textContent = T(it.label);
      li.appendChild(lab);
      if (it.value) {
        const v = document.createElement('span');
        v.className = 'val';
        li.appendChild(v);
      }
      li.addEventListener('mouseenter', () => {
        setText($('side-desc'), T(it.desc || ''));
        if (PLACES[name].hover && !it.action) selectSub(it.id);
      });
      li.addEventListener('click', () => {
        if (!it.action) {
          selectSub(it.id);
          return;
        }
        it.action();
        refreshSideValues();
      });
      ul.appendChild(li);
    }
    const cur = document.createElement('li');
    cur.className = 'side-cursor';
    cur.id = 'side-cursor';
    ul.appendChild(cur);
    refreshSideValues();
  }
  $('side-list').addEventListener('mouseleave', () => {
    const it = nav.items.find((i) => i.id === nav.sel);
    if (it) setText($('side-desc'), T(it.desc || ''));
  });

  function refreshSideValues() {
    for (const li of $('side-list').children) {
      const it = nav.items.find((i) => i.id === li.dataset.sub);
      if (it && it.value) setText(li.querySelector('.val'), it.value());
      if (it && it.armed) setText(li.firstChild, it.armed() ? T('CONFIRM?') : T(it.label)); // two-click actions
    }
  }

  function selectSub(id) {
    const name = nav.place;
    const it = nav.items.find((i) => i.id === id && !i.action);
    if (!name || !it) return;
    const changed = nav.sel !== id;
    nav.sel = id;
    nav.sub[name] = id;
    for (const li of $('side-list').children) li.classList.toggle('active', li.dataset.sub === id);
    setText($('side-desc'), T(it.desc || ''));
    positionSideCursor();
    const view = it.view || 'pv-' + name + '-' + id;
    for (const v of document.querySelectorAll('#place-main .pview')) v.classList.toggle('active', v.id === view);
    if (changed && hooks[name] && hooks[name].sub) hooks[name].sub(id);
    refreshPlace(Date.now(), true);
  }

  function positionSideCursor() {
    const cur = $('side-cursor');
    const li = Array.from($('side-list').children).find((l) => l.dataset.sub === nav.sel);
    if (cur && li) cur.style.top = (li.offsetTop + (li.offsetHeight - cur.offsetHeight) / 2) + 'px';
  }

  function refreshPlace(now, force) {
    const h = hooks[nav.place];
    if (h && h.refresh) h.refresh(now, !!force);
  }

  function placeFrame(dt, t) {
    const h = hooks[nav.place];
    if (h && h.frame) h.frame(dt, t);
  }

  function placeTick(now) {
    if (!nav.place) return;
    setText($('tab-clock'), timeHM(new Date(now)));
    if (!nav.transit && cfg.hubReturn > 0 && now - nav.lastInput > clamp(cfg.hubReturn, 10, 3600) * 1000) {
      podSay(PE.autoHub);
      go('');
      return;
    }
    refreshPlace(now, false);
  }

  // Shared bits: table rows and PREV / NEXT pages (Wallpaper Engine does not reliably forward the scroll wheel).
  function trow(cells, head) {
    const r = document.createElement('div');
    r.className = 'trow' + (head ? ' head' : '');
    for (const c of cells) {
      const s = document.createElement('span');
      s.className = c[0];
      s.textContent = c[1];
      r.appendChild(s);
    }
    return r;
  }

  function emptyRow(text) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = text;
    return e;
  }

  function pagerBar(bar, page, pages, onPage) {
    bar.textContent = '';
    if (pages <= 1) return;
    const mk = (label, to, off) => {
      const b = document.createElement('span');
      b.className = 'btn ghost' + (off ? ' off' : '');
      b.textContent = label;
      b.addEventListener('click', () => onPage(to));
      return b;
    };
    const lab = document.createElement('span');
    lab.textContent = T('PAGE {p} / {n}', { p: page + 1, n: pages });
    bar.append(mk(T('PREV'), page - 1, page === 0), lab, mk(T('NEXT'), page + 1, page >= pages - 1));
  }

  function makePager(tableId, pagerId, per, headCells, rowFn, emptyText) {
    const p = { page: 0, rows: [] };
    p.render = () => {
      const pages = Math.max(1, Math.ceil(p.rows.length / per));
      p.page = clamp(p.page, 0, pages - 1);
      const table = $(tableId);
      table.textContent = '';
      table.appendChild(trow(headCells.map((c) => [c[0], T(c[1])]), true));
      if (!p.rows.length) table.appendChild(emptyRow(T(emptyText)));
      for (const r of p.rows.slice(p.page * per, p.page * per + per)) table.appendChild(rowFn(r));
      pagerBar($(pagerId), p.page, pages, (to) => {
        p.page = to;
        p.render();
      });
    };
    p.set = (rows) => {
      p.rows = rows;
      p.render();
    };
    return p;
  }

  // ----- MAP: draggable globe with surveyable locations -----

  const LOCATIONS = [
    { id: 'bunker', name: K('BUNKER'), zone: K('ORBITAL STATION // YORHA COMMAND'), orbit: true, threat: 0,
      cond: [K('VACUUM // STABLE'), K('SOLAR WIND // NOMINAL')],
      desc: K('YoRHa orbital headquarters. Memory backups, maintenance and mission briefings are handled here.') },
    { id: 'ruins', name: K('CITY RUINS'), zone: K('SECTOR 01 // URBAN'), lat: 35.4, lon: 139.4, threat: 2,
      cond: [K('OVERCAST'), K('CLEAR'), K('LIGHT RAIN'), K('HAZE')],
      desc: K('A collapsed metropolis swallowed by forest growth. Most ground operations begin here.') },
    { id: 'camp', name: K('RESISTANCE CAMP'), zone: K('SECTOR 02 // OUTPOST'), lat: 52, lon: 96, threat: 1,
      cond: [K('CLEAR'), K('OVERCAST'), K('DRIZZLE')],
      desc: K('Android resistance outpost built into the ruins. Supplies, repairs and rumours.') },
    { id: 'desert', name: K('DESERT ZONE'), zone: K('SECTOR 03 // ARID'), lat: 22, lon: 28, threat: 3,
      cond: [K('SANDSTORM'), K('CLEAR // HIGH HEAT'), K('DUST HAZE')],
      desc: K('Wind-scoured dunes over buried structures. Sandstorms cut visibility without warning.') },
    { id: 'park', name: K('AMUSEMENT PARK'), zone: K('SECTOR 04 // LEISURE'), lat: -8, lon: -62, threat: 3,
      cond: [K('CLEAR'), K('FIREWORKS DETECTED'), K('OVERCAST')],
      desc: K('Festival grounds still running on old power. Machine lifeforms gather here in crowds.') },
    { id: 'forest', name: K('FOREST ZONE'), zone: K('SECTOR 05 // WOODLAND'), lat: 47, lon: -112, threat: 2,
      cond: [K('MIST'), K('CLEAR'), K('LIGHT RAIN')],
      desc: K('Dense old-growth woodland around a ruined castle. Local machines keep a strict hierarchy.') },
    { id: 'flooded', name: K('FLOODED CITY'), zone: K('SECTOR 06 // COASTAL'), lat: -31, lon: 168, threat: 2,
      cond: [K('RAIN'), K('HIGH TIDE'), K('SEA FOG')],
      desc: K('Coastal district lost beneath the sea. Wreckage makes an aerial approach difficult.') },
    { id: 'factory', name: K('FACTORY'), zone: K('SECTOR 07 // INDUSTRIAL'), lat: -42, lon: 58, threat: 4,
      cond: [K('SMOG'), K('ACID HAZE'), K('OVERCAST')],
      desc: K('Automated production complex. Suspected origin of large numbers of machine units.') }
  ];
  const locById = (id) => LOCATIONS.find((l) => l.id === id) || LOCATIONS[1];
  const hash01 = (n) => {
    const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return h - Math.floor(h);
  };
  const utcHM = (t) => {
    const d = new Date(t);
    return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  };
  const pglobe = $('pmap-globe');
  const mapv = { rot: -139.4 * Math.PI / 180, tilt: 0.5, focus: true, drag: null, vel: 0, hover: '', hits: [] };

  function updateLocInfo(now) {
    const l = locById(nav.sub.map);
    const idx = LOCATIONS.indexOf(l);
    setText($('loc-name'), T(l.name));
    fitText($('loc-name'));
    setText($('loc-sub'), T(l.zone));
    if (l.orbit) {
      setText($('loc-coord'), T('ALT 4,800 KM  //  INCL 67.6'));
      setText($('loc-time'), 'UTC ' + utcHM(now));
    } else {
      setText($('loc-coord'), Math.abs(l.lat).toFixed(2) + (l.lat >= 0 ? ' N' : ' S') + '  //  ' +
        Math.abs(l.lon).toFixed(2) + (l.lon >= 0 ? ' E' : ' W'));
      const zone = Math.round(l.lon / 15);
      setText($('loc-time'), utcHM(now + zone * 3600000) + '  //  UTC' + (zone >= 0 ? '+' : '-') + Math.abs(zone));
    }
    setText($('loc-cond'), T(l.cond[Math.floor(hash01(Math.floor(now / 86400000) * 31 + idx) * l.cond.length)]));
    const sig = Math.round(l.threat * 16 + hash01(Math.floor(now / 600000) * 7 + idx) * (l.threat * 12 + 5));
    setText($('loc-sig'), l.orbit ? T('NONE  //  SECURE') : T('{n} DETECTED', { n: sig }));
    const th = $('loc-threat');
    if (th._n !== l.threat) {
      th._n = l.threat;
      th.textContent = '';
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('i');
        if (i < l.threat) s.className = 'on' + (l.threat >= 4 ? ' hi' : '');
        th.appendChild(s);
      }
    }
    setText($('loc-desc'), T(l.desc));
  }

  function globeHit(e) {
    const r = pglobe.getBoundingClientRect();
    const kx = pglobe.width / Math.max(1, r.width);
    const x = (e.clientX - r.left) * kx, y = (e.clientY - r.top) * kx;
    let best = '', bd = 18 * dpr();
    for (const h of mapv.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) {
        bd = d;
        best = h.id;
      }
    }
    return best;
  }

  pglobe.addEventListener('pointerdown', (e) => {
    mapv.drag = { x: e.clientX, y: e.clientY, rot: mapv.rot, tilt: mapv.tilt, moved: 0, lt: performance.now(), lx: e.clientX };
    mapv.vel = 0;
    try { pglobe.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  });
  pglobe.addEventListener('pointermove', (e) => {
    const d = mapv.drag;
    if (!d) {
      mapv.hover = globeHit(e);
      pglobe.classList.toggle('hot', !!mapv.hover);
      return;
    }
    const r = pglobe.getBoundingClientRect();
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    if (d.moved <= 4) return;
    mapv.focus = false;
    pglobe.classList.add('drag');
    const k = Math.PI * 1.6 / Math.max(1, r.width);
    mapv.rot = d.rot + dx * k;
    mapv.tilt = clamp(d.tilt + dy * 2 / Math.max(1, r.height), -1.25, 1.25);
    const now = performance.now();
    mapv.vel = (e.clientX - d.lx) * k / (Math.max(8, now - d.lt) / 1000);
    d.lt = now;
    d.lx = e.clientX;
  });
  function endGlobeDrag(e) {
    const d = mapv.drag;
    if (!d) return;
    mapv.drag = null;
    pglobe.classList.remove('drag');
    if (d.moved <= 4) {
      mapv.vel = 0;
      const id = globeHit(e);
      if (id) selectSub(id);
    } else if (performance.now() - d.lt > 120) {
      mapv.vel = 0; // released after holding still: no fling
    }
  }
  pglobe.addEventListener('pointerup', endGlobeDrag);
  pglobe.addEventListener('pointercancel', endGlobeDrag);
  pglobe.addEventListener('pointerleave', () => {
    if (mapv.drag) return;
    mapv.hover = '';
    pglobe.classList.remove('hot');
  });

  hooks.map = {
    sub() {
      mapv.focus = true;
      mapv.vel = 0;
    },
    refresh(now) { updateLocInfo(now); },
    frame(dt, t) {
      const l = locById(nav.sub.map);
      const ease = Math.min(1, dt * 4);
      if (mapv.focus && !mapv.drag) {
        if (l.orbit) {
          mapv.rot += dt * 0.08;
          mapv.tilt += (0.41 - mapv.tilt) * ease;
        } else {
          // Turn the shortest way round so the location ends up dead centre.
          const diff = -l.lon * Math.PI / 180 - mapv.rot;
          mapv.rot += ((diff % TWO_PI + 3 * Math.PI) % TWO_PI - Math.PI) * ease;
          mapv.tilt += (clamp(l.lat * Math.PI / 180, -1.1, 1.1) - mapv.tilt) * ease;
        }
      } else if (!mapv.drag) {
        mapv.rot += (mapv.vel + 0.05) * dt;
        mapv.vel *= Math.pow(0.08, dt);
      }
      const r = renderGlobe(pglobe, {
        rot: mapv.rot,
        tilt: mapv.tilt,
        wf: 0.36,
        points: globe.points,
        markers: LOCATIONS.filter((x) => !x.orbit).map((x) => ({
          id: x.id, lat: x.lat, lon: x.lon, label: T(x.name), sel: x.id === l.id, hover: x.id === mapv.hover
        })),
        bunkerSel: !!l.orbit,
        bunkerHover: mapv.hover === 'bunker'
      }, t);
      mapv.hits = r.hits;
    }
  };

  // ----- QUESTS: time progress, daily orders, focus timer -----

  const OPS = [['hour', K('CURRENT HOUR')], ['day', K('DAILY OPERATION')], ['week', K('WEEKLY OPERATION')],
    ['month', K('MONTHLY OPERATION')], ['year', K('ANNUAL OPERATION')]];
  const opsEls = {};
  for (const [id, label] of OPS) {
    const q = document.createElement('div');
    q.className = 'quest';
    q.innerHTML = '<div class="q-row"><span class="q-name"></span><span class="q-pct">--</span></div>' +
      '<div class="bar"><div class="fill"></div></div>' +
      '<div class="q-meta"><span class="q-state">IN PROGRESS</span><span class="q-rem">--</span></div>';
    q.querySelector('.q-name').textContent = T(label);
    $('ops-list').appendChild(q);
    opsEls[id] = { pct: q.querySelector('.q-pct'), fill: q.querySelector('.fill'), rem: q.querySelector('.q-rem'), name: q.querySelector('.q-name') };
  }

  const orders = {
    done: store.get('orders.done', { day: '', items: {} }),
    streak: store.get('orders.streak', { count: 0, last: '' }),
    renderedDay: ''
  };

  const orderLabel = (s) => (cfg.dailyOrders === DEFAULTS.dailyOrders ? T(s) : s);

  function orderList() {
    return String(cfg.dailyOrders || '').split('|').map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 10);
  }

  function ordersState() {
    const today = dayKey(new Date());
    if (orders.done.day !== today) {
      orders.done = { day: today, items: {} };
      store.set('orders.done', orders.done);
    }
    return orders.done;
  }

  function streakCount() {
    const d = new Date();
    const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    const sk = orders.streak;
    return sk.last === dayKey(d) || sk.last === dayKey(y) ? sk.count : 0;
  }

  function renderOrders() {
    const list = orderList(), st = ordersState(), ul = $('orders');
    orders.renderedDay = st.day;
    ul.textContent = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = T('NO ORDERS ASSIGNED');
      ul.appendChild(li);
    }
    for (const text of list) {
      const done = !!st.items[text];
      const li = document.createElement('li');
      if (done) li.className = 'done';
      const chk = document.createElement('span');
      chk.className = 'chk';
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.textContent = orderLabel(text);
      const s = document.createElement('span');
      s.className = 'st';
      s.textContent = done ? T('COMPLETE') : T('PENDING');
      li.append(chk, txt, s);
      li.addEventListener('click', () => toggleOrder(text));
      ul.appendChild(li);
    }
    const d = new Date();
    const n = list.filter((t) => st.items[t]).length;
    const sk = streakCount();
    setText($('ord-date'), T('{weekday}  {day} {month}', { weekday: T(DAYS[d.getDay()]), day: pad(d.getDate()), month: T(MONTHS[d.getMonth()]) }));
    setText($('ord-count'), T('{done} / {total} COMPLETE', { done: n, total: list.length }));
    setText($('ord-streak'), T('STREAK {days}', { days: TN(sk, '{n} DAY|{n} DAYS') }));
  }

  function toggleOrder(text) {
    const st = ordersState();
    if (st.items[text]) delete st.items[text];
    else st.items[text] = true;
    store.set('orders.done', st);
    if (st.items[text]) {
      const list = orderList();
      if (list.every((t) => st.items[t])) {
        const sk = orders.streak, today = dayKey(new Date());
        if (sk.last !== today) {
          sk.count = streakCount() + 1;
          sk.last = today;
          store.set('orders.streak', sk);
          unitEvent('orders');
        }
        say('Report', T('All daily orders complete. Streak: {days}. Glory to Mankind.', { days: TN(sk.count, '{n} day|{n} days') }));
      } else {
        say('Report', T('Order complete: {order}.', { order: orderLabel(text) }));
      }
    }
    renderOrders();
  }

  const timer = Object.assign({ min: 25, left: 25 * 60000, endAt: 0, running: false }, store.get('timer', {}));
  let timerStats = store.get('timer.stats', { day: '', count: 0, ms: 0 });
  let timerFlash = 0;
  const saveTimer = () => store.set('timer', { min: timer.min, left: timer.left, endAt: timer.endAt, running: timer.running });
  const timerLeft = (now) => (timer.running ? Math.max(0, timer.endAt - now) : timer.left);

  function timerToday() {
    const today = dayKey(new Date());
    if (timerStats.day !== today) timerStats = { day: today, count: 0, ms: 0 };
    return timerStats;
  }

  function timerToggle() {
    const now = Date.now();
    if (timer.running) {
      timer.left = timerLeft(now);
      timer.running = false;
      say('Report', T('Operation timer paused at {time}.', { time: fmtMS(timer.left) }));
    } else {
      if (timer.left <= 0) timer.left = timer.min * 60000;
      timer.endAt = now + timer.left;
      timer.running = true;
      timerFlash = 0;
      say('Report', T('Operation timer started. {time} remaining.', { time: fmtMS(timer.left) }));
    }
    saveTimer();
    renderTimer(now);
  }

  function timerReset() {
    timer.running = false;
    timer.left = timer.min * 60000;
    timerFlash = 0;
    saveTimer();
    renderTimer(Date.now());
  }

  function timerSet(min) {
    if (timer.running) return;
    timer.min = min;
    timer.left = min * 60000;
    timerFlash = 0;
    saveTimer();
    renderTimer(Date.now());
  }

  // Runs in the hub too: finishes the operation and shows the countdown in the top bar.
  function timerTick(now) {
    if (timer.running && now >= timer.endAt) {
      timer.running = false;
      timer.left = timer.min * 60000;
      const s = timerToday();
      s.count++;
      s.ms += timer.min * 60000;
      store.set('timer.stats', s);
      saveTimer();
      timerFlash = now + 15000;
      say('Alert', T('Operation timer complete. Recommend a short rest.'));
      act('hop');
      emote('alert');
      unitEvent('timer');
    }
    let status = T('SYS NOMINAL');
    if (timer.running) status = T('OPERATION {time}', { time: fmtMS(timerLeft(now)) });
    else if (now < timerFlash) status = T('OPERATION COMPLETE');
    else if (planner.alertTitle()) status = T('ALERT // {name}', { name: planner.alertTitle() });
    else if (well.card) status = T('PROPOSAL // {name}', { name: T(wellById(well.card.id).name) });
    setText($('status-label'), status);
  }

  function renderTimer(now) {
    const done = now < timerFlash;
    const partial = !timer.running && timer.left < timer.min * 60000;
    setText($('timer-left'), fmtMS(timerLeft(now)));
    setText($('timer-state'), T(timer.running ? K('IN PROGRESS') : done ? K('COMPLETE') : partial ? K('PAUSED') : K('STANDBY')));
    $('timer-state').classList.toggle('alert', done);
    setText($('timer-go'), T(timer.running ? K('PAUSE') : partial ? K('RESUME') : K('START')));
    for (const c of $('timer-chips').children) c.classList.toggle('on', Number(c.dataset.min) === timer.min);
    $('timer-chips').classList.toggle('locked', timer.running);
    const s = timerToday();
    setText($('timer-today'), String(s.count));
    setText($('timer-total'), T('{n} MIN', { n: Math.round(s.ms / 60000) }));
  }
  $('timer-go').addEventListener('click', timerToggle);
  $('timer-reset').addEventListener('click', timerReset);
  for (const c of $('timer-chips').children) c.addEventListener('click', () => timerSet(Number(c.dataset.min)));

  function drawTimerRing(t) {
    const c = $('timer-canvas'), ctx = c.getContext('2d'), k = dpr();
    fitCanvas(c);
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6 * k;
    const ink = state.colors.ink;
    ctx.clearRect(0, 0, W, H);
    const frac = clamp(timerLeft(Date.now()) / (timer.min * 60000), 0, 1);
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + i / 60 * TWO_PI;
      const major = i % 5 === 0;
      const r1 = R * 0.84, r2 = R * (major ? 0.98 : 0.94);
      ctx.strokeStyle = 'rgba(' + ink + ',' + (i / 60 < frac ? 0.85 : 0.15) + ')';
      ctx.lineWidth = (major ? 3 : 2) * k;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.lineWidth = k;
    ctx.strokeStyle = 'rgba(' + ink + ',0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([4 * k, 8 * k]);
    ctx.lineDashOffset = timer.running ? -t * 20 * k : 0;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.72, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    const ha = -Math.PI / 2 + frac * TWO_PI;
    ctx.fillStyle = 'rgb(' + (timer.running ? state.colors.accent : ink) + ')';
    ctx.fillRect(cx + Math.cos(ha) * R * 0.78 - 4 * k, cy + Math.sin(ha) * R * 0.78 - 4 * k, 8 * k, 8 * k);
  }

  hooks.quests = {
    refresh(now, force) {
      if (nav.sel === 'ops') {
        const r = questRanges(now);
        for (const [id] of OPS) setQuest(opsEls[id], r[id], now);
      } else if (nav.sel === 'orders') {
        if (force || orders.renderedDay !== dayKey(new Date())) renderOrders();
      } else if (nav.sel === 'timer') {
        renderTimer(now);
      } else if (nav.sel === 'wellness') {
        renderWellness(now, force);
      } else if (nav.sel === 'calendar' || nav.sel === 'schedule') {
        planner.refresh(nav.sel, now, force);
      }
    },
    sub() {
      planner.leave(); // an open editor belongs to the view it was opened from
    },
    leave() {
      planner.leave();
    },
    frame(dt, t) {
      if (nav.sel === 'timer') drawTimerRing(t);
    }
  };

  // ----- QUESTS > WELLNESS: proposals to rest the eyes, drink, stretch, sit well and eat -----
  // Interval proposals count from the start of the session (or from the last time one was done); meal
  // proposals come at the times in mealTimes. One card at a time, spaced out, never during a drill.
  // Wallpaper Engine only shows the desktop when nothing covers it, so a card waits there until it is seen:
  // its timeout only counts time after the cursor has been on the desktop, and never time spent paused.

  const WELL = [
    { id: 'eyes', field: 'eyesEvery', name: K('EYE REST'), hold: 20, act: 'nod', emote: 'dots',
      done: K('Optical rest logged. {n} today.'),
      hint: K('20-20-20: look at something about 6 m (20 ft) away for 20 seconds and blink slowly a few times.') },
    { id: 'water', field: 'waterEvery', name: K('HYDRATION'), act: 'hop', emote: 'sweat',
      done: K('Hydration logged. {n} today.'),
      hint: K('Drink a glass of water. A little and often works better than a lot at once.') },
    { id: 'stretch', field: 'stretchEvery', name: K('STRETCH'), act: 'stretch', emote: 'sparkle',
      done: K('Stretch logged. {n} today.'),
      hint: K('Stand up. Roll your shoulders, stretch your back, neck and wrists, and walk for a minute if you can.') },
    { id: 'posture', field: 'postureEvery', name: K('POSTURE'), act: 'stretch', emote: 'alert',
      done: K('Posture check logged. {n} today.'),
      hint: K('Feet flat, back against the chair, shoulders loose, screen at eye level and an arm\'s length away.') },
    { id: 'meal', name: K('MEAL'), act: 'hop', emote: 'heart',
      done: K('Meal logged. Fuel reserves restored.'),
      hint: K('Time to eat something. Regular meals keep energy and focus steady.') }
  ];
  const WELL_ICON = {
    eyes: '<svg viewBox="0 0 24 24"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>',
    water: '<svg viewBox="0 0 24 24"><path d="M12 2C9 7 5.5 10.5 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.5 15 7 12 2z" fill="currentColor"/></svg>',
    stretch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.2" r="2.3" fill="currentColor"/><path d="M4.5 2.5L12 9l7.5-6.5M12 9v6.5M12 15.5L8 22M12 15.5L16 22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    posture: '<svg viewBox="0 0 24 24"><circle cx="10" cy="3.8" r="2.3" fill="currentColor"/><path d="M10 8v7h6.5v6.5M10 11.5h5M5 8.5V22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    meal: '<svg viewBox="0 0 24 24"><path d="M2.5 12h19a9.5 8.5 0 0 1-19 0z" fill="currentColor"/><path d="M13.5 2.5l-2.5 8M19.5 3.5l-6 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  const WELL_STEPS = [0, 10, 15, 20, 30, 45, 60, 90, 120];
  const MEAL_WINDOW = 90 * 60000; // a meal proposal can still appear up to 90 min after its time
  const WELL_GAP = 90000; // at least 90 s between two cards
  const WELL_TIMEOUT = 10 * 60000; // an unanswered card closes itself after this much seen time; the countdown starts again
  const WELL_SNOOZE = 10 * 60000;
  const wellById = (id) => WELL.find((w) => w.id === id);
  const well = {
    st: Object.assign({ day: '', done: {}, meals: {} }, store.get('well', {})),
    last: {}, // id -> when its countdown last restarted
    snooze: {}, // id -> not before this time
    card: null, // { id, at, holdEnd, meal, tick, seen }
    lastCard: 0,
    lastCheck: 0,
    on: false,
    rows: null
  };
  for (const w of WELL) well.last[w.id] = Date.now();

  function wellToday() {
    const today = dayKey(new Date());
    if (well.st.day !== today) {
      well.st = { day: today, done: {}, meals: {} };
      store.set('well', well.st);
    }
    return well.st;
  }

  const wellEvery = (w) => (w.field ? clamp(cfg[w.field], 0, 600) : 0);

  // "08:00|12:30|18:30" -> [{ key: '08:00', at: ms today }]
  function mealSlots(now) {
    const d = new Date(now), out = [];
    for (const raw of String(cfg.mealTimes || '').split(/[|,;]/)) {
      const m = /^\s*(\d{1,2})(?:[:.h](\d{2}))?\s*$/i.exec(raw);
      if (!m) continue;
      const h = Number(m[1]), mi = Number(m[2] || 0);
      if (h > 23 || mi > 59) continue;
      out.push({ key: pad(h) + ':' + pad(mi), at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi).getTime() });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 8);
  }

  // The meal slot a proposal (or LOG NOW) belongs to: the latest one already due, else the next one.
  function mealSlot(now) {
    const st = wellToday();
    const open = mealSlots(now).filter((s) => !st.meals[s.key] && now < s.at + MEAL_WINDOW);
    return open.filter((s) => s.at <= now).pop() || open[0] || null;
  }

  // When a proposal is next due (ms), or 0 when it is off or nothing is left today.
  function wellNext(w, now) {
    if (w.id === 'meal') {
      const s = mealSlot(now);
      return s ? Math.max(s.at, well.snooze.meal || 0) : 0;
    }
    const every = wellEvery(w);
    if (!every) return 0;
    return Math.max(well.last[w.id] + every * 60000, well.snooze[w.id] || 0);
  }

  function fmtIn(ms) {
    if (ms <= 0) return T('DUE');
    const m = Math.ceil(ms / 60000);
    if (m < 60) return T('IN {n} MIN', { n: m });
    return T('IN {h}H {m}M', { h: Math.floor(m / 60), m: pad(m % 60) });
  }

  // The proposal coming up soonest, for the hub panel.
  function wellSoonest(now) {
    let best = null, at = Infinity;
    for (const w of WELL) {
      const n = wellNext(w, now);
      if (n && n < at) {
        best = w;
        at = n;
      }
    }
    return best ? { w: best, at: at } : null;
  }

  // Switching proposals on starts every countdown fresh.
  function syncWellness() {
    if (cfg.wellness && !well.on) for (const w of WELL) well.last[w.id] = Date.now();
    well.on = !!cfg.wellness;
    if (!cfg.wellness && well.card) closeWellCard();
  }

  function wellTick(now) {
    if (now - well.lastCheck < 1000) return;
    well.lastCheck = now;
    const c = well.card;
    if (c) {
      if (c.holdEnd) {
        const left = c.holdEnd - now;
        setText($('wc-count'), left > 0 ? String(Math.ceil(left / 1000)) : '');
        if (left <= 0) wellDone(c.id);
      } else {
        // A long gap between checks means the wallpaper was paused: that time does not count.
        const step = Math.min(2000, Math.max(0, now - c.tick));
        c.tick = now;
        if (nav.lastInput > c.at) c.seen += step;
        if (c.seen > WELL_TIMEOUT) wellMissed(c.id);
      }
      return;
    }
    if (!cfg.wellness || gameBusy() || nav.transit || now - well.lastCard < WELL_GAP) return;
    let pick = null, pickAt = Infinity;
    for (const w of WELL) {
      const at = wellNext(w, now);
      if (at && at <= now && at < pickAt) {
        pick = w;
        pickAt = at;
      }
    }
    if (pick) showWellCard(pick, now);
  }

  // The card sits above the Pod log on the hub and in the corner of a place.
  // A calendar alert sits above the hub panel (clear of the desktop character); in a place it stacks above
  // the wellness card in the bottom corner.
  function placeWellCard() {
    const card = $('well-card'), cal = $('cal-card');
    if (nav.place) {
      if (cal.parentNode !== $('place-cards')) $('place-cards').appendChild(cal);
      if (card.parentNode !== $('place-cards')) $('place-cards').appendChild(card);
    } else {
      if (card.parentNode !== $('rightcol')) $('rightcol').insertBefore(card, $('podlog'));
      if (cal.parentNode !== $('hubslot')) $('hubslot').appendChild(cal);
    }
  }

  function showWellCard(w, now) {
    const slot = w.id === 'meal' ? mealSlot(now) : null;
    well.card = { id: w.id, at: now, holdEnd: 0, meal: slot ? slot.key : '', tick: now, seen: 0 };
    well.lastCard = now;
    const p = podPick(PE['well' + w.id.charAt(0).toUpperCase() + w.id.slice(1)]);
    if (p && cfg.showLog) sayLine(p.line, p.vars);
    const card = $('well-card');
    card.dataset.kind = w.id;
    $('wc-icon').innerHTML = WELL_ICON[w.id];
    setText($('wc-title'), T(w.name) + (slot ? '  //  ' + slot.key : ''));
    setText($('wc-text'), p ? fillLine(p) : '');
    setText($('wc-hint'), T(w.hint));
    setText($('wc-count'), '');
    setText($('wc-done'), w.hold ? T('START {n} S', { n: w.hold }) : T('DONE'));
    setText($('wc-today'), T('TODAY {n}', { n: wellToday().done[w.id] || 0 }));
    placeWellCard();
    card.classList.remove('show', 'holding');
    void card.offsetWidth;
    card.classList.add('show');
    act(w.act);
    emote(w.emote);
    if (nav.place === 'quests' && nav.sel === 'wellness') renderWellness(now, true);
  }

  function closeWellCard() {
    well.card = null;
    $('well-card').classList.remove('show', 'holding');
  }

  function wellDone(id) {
    const now = Date.now(), st = wellToday(), w = wellById(id);
    st.done[id] = (st.done[id] || 0) + 1;
    if (id === 'meal') {
      const key = well.card && well.card.id === 'meal' && well.card.meal ? well.card.meal : (mealSlot(now) || {}).key;
      if (key) st.meals[key] = 1;
    }
    store.set('well', st);
    well.last[id] = now;
    delete well.snooze[id];
    if (well.card && well.card.id === id) closeWellCard();
    say('Confirmation', T(w.done, { n: st.done[id] }));
    act('hop');
    emote('heart');
    unitEvent('wellness', id);
    if (nav.place === 'quests' && nav.sel === 'wellness') renderWellness(now, true);
  }

  function wellLater(id) {
    well.snooze[id] = Date.now() + WELL_SNOOZE;
    closeWellCard();
  }

  function wellMissed(id) {
    const now = Date.now();
    well.last[id] = now;
    if (id === 'meal' && well.card && well.card.meal) {
      wellToday().meals[well.card.meal] = -1;
      store.set('well', well.st);
    }
    closeWellCard();
  }

  $('wc-done').addEventListener('click', () => {
    const c = well.card;
    if (!c) return;
    const w = wellById(c.id);
    if (w.hold && !c.holdEnd) {
      c.holdEnd = Date.now() + w.hold * 1000;
      $('well-card').classList.add('holding');
      setText($('wc-count'), String(w.hold));
      setText($('wc-done'), T('DONE'));
      return;
    }
    wellDone(c.id);
  });
  $('wc-later').addEventListener('click', () => {
    if (well.card) wellLater(well.card.id);
  });

  // The WELLNESS view: one row per proposal. Rows are built on entry; the countdowns update in place.
  function renderWellness(now, force) {
    const list = $('well-list');
    if (force || !well.rows) {
      list.textContent = '';
      well.rows = {};
      for (const w of WELL) {
        const row = document.createElement('div');
        row.className = 'well-row';
        const ico = document.createElement('span');
        ico.className = 'wl-ico';
        ico.innerHTML = WELL_ICON[w.id];
        const main = document.createElement('span');
        main.className = 'wl-main';
        const nm = document.createElement('span');
        nm.className = 'wl-name';
        nm.textContent = T(w.name);
        const hint = document.createElement('span');
        hint.className = 'wl-hint';
        hint.textContent = T(w.hint);
        main.append(nm, hint);
        const every = document.createElement('span');
        every.className = 'wl-every' + (w.field ? ' btn ghost' : '');
        if (w.field) {
          every.addEventListener('click', () => {
            const i = WELL_STEPS.indexOf(wellEvery(w));
            setOverride(w.field, WELL_STEPS[(i + 1) % WELL_STEPS.length]);
          });
        }
        const next = document.createElement('span');
        next.className = 'wl-next';
        const today = document.createElement('span');
        today.className = 'wl-today';
        const go = document.createElement('span');
        go.className = 'btn wl-do';
        go.textContent = T('LOG NOW');
        go.addEventListener('click', () => wellDone(w.id));
        row.append(ico, main, every, next, today, go);
        list.appendChild(row);
        well.rows[w.id] = { row: row, every: every, next: next, today: today };
      }
    }
    const st = wellToday();
    setText($('wl-toggle'), cfg.wellness ? T('PROPOSALS ON') : T('PROPOSALS OFF'));
    $('wl-toggle').classList.toggle('ghost', !cfg.wellness);
    let total = 0;
    for (const w of WELL) {
      const r = well.rows[w.id];
      total += st.done[w.id] || 0;
      const every = wellEvery(w);
      const slots = w.id === 'meal' ? mealSlots(now) : null;
      const off = w.field ? !every : !slots.length;
      r.row.classList.toggle('off', off || !cfg.wellness);
      setText(r.every, w.field ? (every ? T('EVERY {n} MIN', { n: every }) : T('OFF')) : (slots.length ? slots.map((s) => s.key).join('  ') : T('OFF')));
      const at = wellNext(w, now);
      setText(r.next, !cfg.wellness || off ? '--' : well.card && well.card.id === w.id ? T('SHOWN') : at ? fmtIn(at - now) : T('DONE TODAY'));
      setText(r.today, T('TODAY {n}', { n: st.done[w.id] || 0 }));
    }
    setText($('wl-total'), T('{n} LOGGED TODAY', { n: total }));
    const soon = cfg.wellness ? wellSoonest(now) : null;
    setText($('wl-next'), soon ? T('NEXT // {name} {when}', { name: T(soon.w.name), when: fmtIn(soon.at - now) }) : '--');
  }
  $('wl-toggle').addEventListener('click', () => setOverride('wellness', !cfg.wellness));

  // ----- QUESTS > CALENDAR / WEEKLY SCHEDULE, alerts and the desktop agenda (planner.js) -----

  const planner = window.YoRHaPlanner({
    cfg: cfg,
    store: store,
    nav: nav,
    setText: setText,
    timeHM: timeHM,
    fmtIn: fmtIn,
    DAYS: DAYS,
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    setOverride: setOverride,
    say: (kind, text) => say(kind, text),
    act: act,
    emote: emote,
    go: go,
    ask: (prompt, text, max) => linkAsk(prompt, text, max), // real-keyboard typing through YoRHa Helper
    helperOnline: () => link.online,
    pingHelper: () => linkPing()
  });

  // ----- INTEL: now playing, audio log, Pod archive -----

  const audioPager = makePager('audio-table', 'audio-pager', 14,
    [['c-t', K('RECEIVED')], ['c-m', K('TITLE')], ['c-s', K('ARTIST')]],
    (r) => trow([['c-t', shortDate(r.t)], ['c-m', r.title], ['c-s', r.artist || '--']]),
    K('NO AUDIO SIGNALS RECORDED'));
  const podPager = makePager('pod-table', 'pod-pager', 14,
    [['c-t', K('TIME')], ['c-k', K('TYPE')], ['c-m', K('TRANSMISSION')]],
    (r) => trow([['c-t', timeHM(new Date(r.t))],
      ['c-k' + (r.kind === 'Alert' || r.kind === 'Warning' ? ' alert' : ''), (r.who ? r.who + ' ' : '') + (r.kind ? T(r.kind).toUpperCase() : '--')],
      ['c-m', r.text]]),
    K('NO TRANSMISSIONS'));
  function renderAudioLog() { audioPager.set(audioLog); }
  function renderPodLog() { podPager.set(pod.history); }

  hooks.intel = {
    sub(id) {
      if (id === 'audio') renderAudioLog();
      else if (id === 'pod') renderPodLog();
    },
    refresh() {
      if (nav.sel === 'now') updateIntel('pm-');
      refreshSideValues(); // the CLEAR confirmation timing out
    },
    frame() {
      if (nav.sel === 'now') drawIntelViz($('pm-viz'));
    }
  };

  // ----- ARCHIVE: character grid; click selects a record, double-click deploys it to the desktop -----

  const arcv = { page: 0, per: 12, view: -1 }; // view: record shown in the dossier (-1 = desktop record)

  function renderArchive() {
    const n = gallery.files.length;
    $('pv-archive-chars').classList.toggle('empty', !n);
    const grid = $('arc-grid');
    grid.textContent = '';
    if (!n) {
      $('arc-pager').textContent = '';
      return;
    }
    const pages = Math.max(1, Math.ceil(n / arcv.per));
    arcv.page = clamp(arcv.page, 0, pages - 1);
    const start = arcv.page * arcv.per;
    for (let i = start; i < Math.min(n, start + arcv.per); i++) {
      const card = document.createElement('div');
      card.className = 'arc-card';
      card.dataset.i = String(i);
      const img = thumbEl(gallery.files[i]);
      const no = document.createElement('span');
      no.className = 'no';
      no.textContent = pad3(i + 1);
      const pin = document.createElement('span');
      pin.className = 'pin';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = parseCharName(gallery.files[i]).name.toUpperCase();
      card.append(img, no, pin, nm);
      // Click selects (the dossier and its buttons stay on that record while the mouse travels to them);
      // double-click deploys. Hover only highlights, so crossing other cards changes nothing.
      card.addEventListener('click', () => selectArcRecord(i));
      card.addEventListener('dblclick', () => deployRecord(i));
      grid.appendChild(card);
    }
    pagerBar($('arc-pager'), arcv.page, pages, (to) => {
      arcv.page = to;
      renderArchive();
    });
    refreshArcLive();
  }

  function refreshArcLive() {
    const sel = arcIndex();
    for (const card of $('arc-grid').children) {
      const i = Number(card.dataset.i), f = gallery.files[i];
      card.classList.toggle('live', f === gallery.current);
      card.classList.toggle('pinned', !!gallery.pinned && f === gallery.pinned);
      card.classList.toggle('sel', i === sel);
    }
    showArcDossier(arcv.view);
  }

  function selectArcRecord(i) {
    if (!gallery.files[i]) return;
    arcv.view = i;
    refreshArcLive();
  }

  function arcIndex() {
    return arcv.view >= 0 && arcv.view < gallery.files.length ? arcv.view : gallery.files.indexOf(gallery.current);
  }

  function showArcDossier(i) {
    arcv.view = i;
    const idx = arcIndex();
    const file = gallery.files[idx];
    $('arc-deploy').classList.toggle('off', !file || file === gallery.pinned);
    $('arc-resume').classList.toggle('off', !gallery.pinned);
    $('arc-assign').classList.toggle('off', !file || sameName(file, unitName()));
    if (!file) return;
    const info = parseCharName(file);
    const img = $('arc-img');
    const url = fileUrl(file);
    if (img.dataset.src !== url) {
      img.dataset.src = url;
      img.dataset.file = file;
      img.src = url;
    }
    setText($('arc-name'), info.name.toUpperCase());
    fitText($('arc-name'));
    setText($('arc-sub'), info.sub);
    setText($('arc-rec'), pad3(idx + 1) + ' / ' + pad3(gallery.files.length));
    setText($('arc-aff'), T(affiliation(info)));
    setText($('arc-desk'), fitCache[file] === false ? T('ARCHIVE ONLY')
      : T(file === gallery.pinned ? K('DEPLOYED // HELD') : file === gallery.current ? K('ON DESKTOP // ROTATING') : K('IN ARCHIVE')));
  }

  function deployRecord(i) {
    const file = gallery.files[i];
    if (!file) return;
    gallery.pinned = file;
    store.set('pinned', baseName(file));
    if (file !== gallery.current) {
      gallery.pos = Math.max(0, gallery.order.indexOf(i));
      gallery.failed = 0;
      showRecord();
    }
    if (fitCache[file] === false) {
      say('Alert', T('{name} cannot stand on the desktop: it needs a tall transparent PNG, 600 px high or more.', { name: parseCharName(file).name }));
    } else {
      say('Report', T('{name} deployed to the desktop. Rotation held.', { name: parseCharName(file).name }));
    }
    arcv.view = i;
    refreshArcLive();
    updateDossierNext(Date.now());
  }

  function resumeRotation() {
    if (!gallery.pinned) return;
    gallery.pinned = '';
    store.set('pinned', '');
    gallery.lastSwitch = Date.now();
    say('Report', T('Character rotation resumed.'));
    refreshArcLive();
    updateDossierNext(Date.now());
  }

  $('arc-deploy').addEventListener('click', () => {
    const idx = arcIndex();
    if (idx >= 0) deployRecord(idx);
  });
  $('arc-resume').addEventListener('click', resumeRotation);
  $('arc-assign').addEventListener('click', () => {
    const idx = arcIndex();
    if (idx >= 0) assignUnit(gallery.files[idx]);
  });
  // The dossier image tells whether a record can stand on the desktop.
  $('arc-img').addEventListener('load', () => {
    const img = $('arc-img'), f = img.dataset.file;
    if (!f || fitCache[f] !== undefined) return;
    fitCache[f] = desktopFit(img.naturalWidth, img.naturalHeight, f);
    if (nav.place === 'archive') showArcDossier(arcv.view);
  });

  hooks.archive = {
    enter() {
      arcv.view = -1;
      const cur = gallery.files.indexOf(gallery.current);
      if (cur >= 0) arcv.page = Math.floor(cur / arcv.per);
    },
    sub(id) {
      if (id === 'chars') renderArchive();
    }
  };

  // ----- UNIT: look after your character, Tamagotchi style -----
  // One unit (a character name). Integrity, energy and morale drift down in real time; repairs, sleep
  // mode and attention bring them back, and so does the rest of the terminal (wellness proposals, daily
  // orders, focus operations, drills, Lunar Tears from the GARDEN, music). Care builds BOND, which unlocks
  // accessories from the game. Outfits (character images that share the unit's name) are never locked:
  // the same images are already free to deploy from ARCHIVE.
  // Nothing is ever lost: an empty meter only means a tired or sulking unit, and time away is capped.

  const ITEMS = [
    { id: 'small', name: K('SMALL RECOVERY'), heal: 25, desc: K('Restores 25% integrity.'), src: K('Daily supply drop. Wellness proposals.') },
    { id: 'medium', name: K('MEDIUM RECOVERY'), heal: 50, desc: K('Restores 50% integrity.'), src: K('Finished focus operations.') },
    { id: 'large', name: K('LARGE RECOVERY'), heal: 100, desc: K('Restores integrity completely.'), src: K('Completing every daily order.') },
    { id: 'tear', name: K('LUNAR TEAR'), desc: K('A gift. Raises morale and bond a great deal.'), src: K('One for every 3 flowers planted in the GARDEN, up to 3 a day.') },
    { id: 'mackerel', name: K('MACKEREL'), desc: K('A fish. Lethal to androids.'), src: K('Rarely found in the water supply.') }
  ];
  const itemById = (id) => ITEMS.find((i) => i.id === id);

  // Accessories from the game, drawn here as simple originals. Unlocks follow the game loosely: the ribbons
  // come from the lost machine sisters, the Lunar Tear from gathering the flowers for Emil.
  const ACCS = [
    { id: 'none', name: K('NONE'), desc: K('No accessory.') },
    { id: 'pink', name: K('PINK RIBBON'), lv: 2, desc: K('A ribbon from a little machine lost in the desert.') },
    { id: 'blue', name: K('BLUE RIBBON'), lv: 3, desc: K('Her big sister kept the matching one.') },
    { id: 'tear', name: K('LUNAR TEAR'), gifts: 4, desc: K('A white moonflower. Legend says it grants one wish.') },
    { id: 'fox', name: K('FOX MASK'), lv: 5, desc: K('A festival mask, worn to the side.') },
    { id: 'machine', name: K('MACHINE HEAD'), drills: 5, desc: K('A hollow machine lifeform head. Pod advises against it.') },
    { id: 'emil', name: K('EMIL\'S HEAD'), lv: 7, desc: K('A cheerful, slightly unsettling spare head.') }
  ];
  const accById = (id) => ACCS.find((a) => a.id === id) || ACCS[0];

  const petals = (n, a0, len, wid, fill, stroke) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      s += '<path transform="rotate(' + (a0 + i * 360 / n) + ' 50 50)" d="M50 50C' + (50 - wid) + ' ' + (50 - len * 0.35) + ' ' +
        (50 - wid * 0.7) + ' ' + (50 - len * 0.85) + ' 50 ' + (50 - len) + 'C' + (50 + wid * 0.7) + ' ' + (50 - len * 0.85) + ' ' +
        (50 + wid) + ' ' + (50 - len * 0.35) + ' 50 50Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.3"/>';
    }
    return s;
  };
  const ribbon = (lite, dark) => '<svg viewBox="0 0 100 100"><g stroke="#2e2a26" stroke-width="2.4" stroke-linejoin="round">' +
    '<path fill="' + dark + '" d="M46 53L32 88l9-4 5 8 7-37z"/><path fill="' + dark + '" d="M54 53l14 33-9-3-4 9-6-36z"/>' +
    '<path fill="' + lite + '" d="M50 47C40 30 16 21 11 36c-5 15 17 24 39 18z"/><path fill="' + lite + '" d="M50 47c10-17 34-26 39-11 5 15-17 24-39 18z"/>' +
    '<path fill="' + dark + '" d="M43 43q7-4 14 0l1 12q-8 4-16 0z"/></g>' +
    '<path d="M18 35c6-5 17-1 25 9M82 35c-6-5-17-1-25 9" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M21 47c9 3 18 3 25 2M79 47c-9 3-18 3-25 2" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="2"/></svg>';
  const ACC_SVG = {
    none: '<svg viewBox="0 0 100 100"><path d="M30 50h40" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".45"/></svg>',
    pink: ribbon('#eda7bd', '#c4728d'),
    blue: ribbon('#a3c2e6', '#6687b5'),
    tear: '<svg viewBox="0 0 100 100"><defs><radialGradient id="lt-g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#eef4fb"/>' +
      '<stop offset="1" stop-color="#ffffff"/></radialGradient></defs>' +
      '<path d="M50 58C40 70 27 76 15 74c8-9 21-15 35-16zM52 58c8 12 18 18 30 18-6-10-17-16-30-18z" fill="#7f9c74" stroke="#3e5238" stroke-width="1.6"/>' +
      petals(6, 0, 40, 15, 'url(#lt-g)', '#7d8a99') + petals(6, 30, 27, 10, '#f7fbff', '#9aa7b5') +
      '<circle cx="50" cy="50" r="6.5" fill="#efe2a2" stroke="#a39457" stroke-width="1.2"/>' +
      '<circle cx="47" cy="48" r="1.4" fill="#a39457"/><circle cx="53" cy="49" r="1.4" fill="#a39457"/><circle cx="50" cy="53" r="1.4" fill="#a39457"/></svg>',
    fox: '<svg viewBox="0 0 100 100"><path d="M50 93C39 85 26 71 22 53L15 17l20 15c8-4 22-4 30 0l20-15-7 36c-4 18-17 32-28 40z" fill="#f6f1e6" stroke="#2e2a26" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M19 24l12 10-8 9zM81 24L69 34l8 9z" fill="#c8473a"/>' +
      '<path d="M30 52q7-5 14 2-7 2-14-2zM70 52q-7-5-14 2 7 2 14-2z" fill="#2e2a26"/>' +
      '<path d="M28 44q8-6 16 0M72 44q-8-6-16 0M33 63q-4 5-2 10M67 63q4 5 2 10" fill="none" stroke="#c8473a" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M50 36c-3 3-3 7 0 10 3-3 3-7 0-10z" fill="#c8473a"/><ellipse cx="50" cy="80" rx="4" ry="3" fill="#2e2a26"/>' +
      '<path d="M44 86q6 3 12 0" fill="none" stroke="#2e2a26" stroke-width="1.8" stroke-linecap="round"/></svg>',
    machine: '<svg viewBox="0 0 100 100"><defs><radialGradient id="mh-g" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#c79f74"/>' +
      '<stop offset="1" stop-color="#6b4d35"/></radialGradient></defs>' +
      '<rect x="4" y="44" width="10" height="16" rx="3" fill="#8d6c4e" stroke="#2e2a26" stroke-width="2"/><rect x="86" y="44" width="10" height="16" rx="3" fill="#8d6c4e" stroke="#2e2a26" stroke-width="2"/>' +
      '<circle cx="50" cy="52" r="38" fill="url(#mh-g)" stroke="#2e2a26" stroke-width="2.6"/>' +
      '<path d="M14 58q36 16 72 0" fill="none" stroke="#3d2c1f" stroke-width="2"/><path d="M50 14v10" stroke="#3d2c1f" stroke-width="2"/>' +
      '<circle cx="36" cy="49" r="10" fill="#2a211b"/><circle cx="64" cy="49" r="10" fill="#2a211b"/>' +
      '<circle cx="36" cy="49" r="6" fill="#ffc35a"/><circle cx="64" cy="49" r="6" fill="#ffc35a"/>' +
      '<circle cx="34" cy="47" r="2" fill="#fff6d8"/><circle cx="62" cy="47" r="2" fill="#fff6d8"/>' +
      '<ellipse cx="38" cy="28" rx="11" ry="6" fill="#fff" opacity=".25" transform="rotate(-20 38 28)"/></svg>',
    emil: '<svg viewBox="0 0 100 100"><defs><radialGradient id="em-g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fbf5e8"/>' +
      '<stop offset="1" stop-color="#c9bda5"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="43" fill="url(#em-g)" stroke="#2e2a26" stroke-width="2.6"/>' +
      '<circle cx="34" cy="43" r="12" fill="#1f1c1a"/><circle cx="66" cy="43" r="12" fill="#1f1c1a"/>' +
      '<circle cx="31" cy="39" r="3.6" fill="#fff"/><circle cx="63" cy="39" r="3.6" fill="#fff"/>' +
      '<path d="M21 62q29 30 58 0-29 12-58 0z" fill="#1f1c1a"/>' +
      '<path d="M27 65.5l3 5M34 68l2 5.5M41 69.5l1 5.5M48 70v5.5M55 69.6l-1 5.4M62 68.2l-2 5.4M69 65.8l-3 5" stroke="#f3ecdc" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  ACC_SVG.flower = ACC_SVG.tear;
  // Gradient ids must be unique per copy: a reference to a copy inside a hidden view draws nothing.
  let svgSeq = 0;
  const accSvg = (id) => {
    const n = ++svgSeq;
    return (ACC_SVG[id] || '').replace(/(id="|url\(#)([a-z]+-g)/g, (m, a, b) => a + b + n);
  };

  // Where an accessory sits on the detected head: offset from the top-centre of the head and size, in head
  // half-widths, plus a tilt. Hair pieces sit high on one side; the masks cover the whole head.
  const ACC_FIT = {
    pink: { dx: 0.62, dy: 0.32, size: 1.35, rot: 16 },
    blue: { dx: 0.62, dy: 0.32, size: 1.35, rot: 16 },
    tear: { dx: 0.66, dy: 0.42, size: 1.25, rot: -8 },
    fox: { dx: 0.8, dy: 0.66, size: 1.6, rot: 24 },
    machine: { dx: 0, dy: 1.02, size: 2.75, rot: 0 },
    emil: { dx: 0, dy: 1.0, size: 2.9, rot: 0 }
  };

  const BOND_XP = [0, 60, 150, 280, 450, 660, 920, 1230, 1600, 2050];
  const bondLv = (xp) => {
    let lv = 0;
    while (lv < BOND_XP.length && xp >= BOND_XP[lv]) lv++;
    return lv;
  };

  const unitDefault = () => ({
    name: '', outfit: '', acc: 'none', integrity: 85, energy: 85, morale: 75, xp: 0, xpFrac: 0,
    items: { small: 3, medium: 1, large: 0, tear: 0, mackerel: 0 }, tears: 0, drills: 0,
    born: Date.now(), last: Date.now(), supply: dayKey(new Date()), rest: 0, garden: -1, seen: null,
    tearDay: '', tearsToday: 0, tearCapDay: ''
  });
  const TEARS_PER_DAY = 3; // Lunar Tears the GARDEN can give per day
  const U = Object.assign(unitDefault(), store.get('unit', {}));
  U.items = Object.assign(unitDefault().items, U.items || {});
  let unitSavedAt = 0;
  const saveUnit = () => {
    unitSavedAt = Date.now();
    store.set('unit', U);
  };
  const resting = () => U.rest > Date.now();

  // ----- who the unit is -----

  const sameName = (f, n) => parseCharName(f).name.toLowerCase() === String(n).toLowerCase();

  // The assigned unit, else the record named like the Unit name property, else whoever is on the desktop.
  function unitName() {
    const files = gallery.files;
    if (U.name && (!files.length || files.some((f) => sameName(f, U.name)))) return U.name;
    const u = unit();
    if (!files.length || files.some((f) => sameName(f, u))) return u;
    if (gallery.pinned) return parseCharName(gallery.pinned).name;
    if (gallery.current) return parseCharName(gallery.current).name;
    return parseCharName(files[0]).name;
  }
  const unitOutfits = () => gallery.files.filter((f) => sameName(f, unitName()));
  function unitFile() {
    const o = unitOutfits();
    const i = o.findIndex((f) => baseName(f) === U.outfit);
    return i >= 0 ? o[i] : o[0] || '';
  }
  const isUnit = (file) => !!file && sameName(file, unitName());

  function accOpen(a) {
    if (a.lv) return bondLv(U.xp) >= a.lv;
    if (a.gifts) return U.tears >= a.gifts;
    if (a.drills) return U.drills >= a.drills;
    return true;
  }
  function accLock(a) {
    if (a.lv) return T('BOND LV {n}', { n: a.lv });
    if (a.gifts) return T('GIVE {n} LUNAR TEARS ({have}/{n})', { n: a.gifts, have: Math.min(U.tears, a.gifts) });
    if (a.drills) return T('FINISH {n} DRILLS ({have}/{n})', { n: a.drills, have: Math.min(U.drills, a.drills) });
    return '';
  }

  // ----- figures: the unit with its accessory, fitted into a box -----

  const figCache = {}; // file -> { head, nw, nh } (head null for opaque portraits)

  function makeFig(box) {
    const body = document.createElement('div');
    body.className = 'fig-body';
    const img = document.createElement('img');
    img.className = 'char-img';
    img.alt = '';
    const acc = document.createElement('div');
    acc.className = 'acc';
    body.append(img, acc);
    box.appendChild(body);
    const f = { box: box, body: body, img: img, acc: acc, file: '', accId: '', info: null };
    img.addEventListener('load', () => {
      if (!f.file) return;
      let info = figCache[f.file];
      if (!info) {
        const fig = figureOf(f.file, img);
        info = figCache[f.file] = { head: fig && !fig.frame ? fig : null, nw: img.naturalWidth, nh: img.naturalHeight };
      }
      f.info = info;
      img.classList.add('on');
      box.classList.add('has-fig');
      layoutFig(f);
    });
    return f;
  }

  function setFig(f, file, accId) {
    if (file !== f.file) {
      f.file = file;
      f.info = null;
      f.img.classList.remove('on');
      f.box.classList.toggle('has-fig', false);
      placeAcc(f.acc, '', null);
      if (file) f.img.src = fileUrl(file);
      else f.img.removeAttribute('src');
    }
    f.accId = accId;
    layoutFig(f);
  }

  // Fit the image box into the container, feet on the floor, then hang the accessory on the head.
  function layoutFig(f) {
    const info = f.info;
    const RW = f.box.clientWidth, RH = f.box.clientHeight;
    if (!info || !RW || !RH) return;
    const s = Math.min(RW / info.nw, RH / info.nh);
    const w = Math.round(info.nw * s), h = Math.round(info.nh * s);
    f.body.style.width = w + 'px';
    f.body.style.height = h + 'px';
    f.body.style.left = Math.round((RW - w) / 2) + 'px';
    f.body.style.top = (RH - h) + 'px';
    placeAcc(f.acc, f.accId, info.head, info.nw, info.nh);
  }

  function placeAcc(el, id, head, nw, nh) {
    const fit = ACC_FIT[id];
    if (!fit || !head || !nw || !nh) {
      el.classList.remove('on');
      return;
    }
    if (el.dataset.id !== id) {
      el.innerHTML = accSvg(id);
      el.dataset.id = id;
    }
    const asp = nw / nh;
    const R = head.hw, size = fit.size * R;
    const cx = head.hx + fit.dx * R, cy = head.hy + fit.dy * R * asp;
    el.style.width = (size * 100).toFixed(2) + '%';
    el.style.height = (size * asp * 100).toFixed(2) + '%';
    el.style.left = ((cx - size / 2) * 100).toFixed(2) + '%';
    el.style.top = ((cy - size * asp / 2) * 100).toFixed(2) + '%';
    el.style.transform = 'rotate(' + fit.rot + 'deg)';
    el.classList.add('on');
  }

  // The accessory also rides on the desktop character whenever the unit is the one standing there.
  function syncDesktopAcc() {
    const on = actor.ready && !actor.frame && actor.head && actor.head !== CORNER_HEAD && isUnit(gallery.current);
    placeAcc($('actor-acc'), on ? U.acc : '', on ? actor.head : null, actor.nw, actor.nh);
  }

  const figs = {};
  function figFor(id) {
    if (!figs[id]) figs[id] = makeFig($(id));
    return figs[id];
  }

  // A small reaction in the maintenance bay: a hop, shake or float plus an emote over the head.
  function bayReact(move, kind) {
    const f = figs['bay-fig'];
    if (!f || nav.place !== 'unit' || nav.sel !== 'care') return;
    f.body.classList.remove('fa-hop', 'fa-shake', 'fa-float');
    void f.body.offsetWidth;
    if (move) f.body.classList.add('fa-' + move);
    if (!kind) return;
    const b = $('bay-emote');
    b.className = 'emote';
    if (EMOTE_SVG[kind] || ACC_SVG[kind]) b.innerHTML = EMOTE_SVG[kind] || accSvg(kind);
    else b.textContent = EMOTE_TEXT[kind] || '!';
    const info = f.info;
    const bw = f.body.offsetWidth, bh = f.body.offsetHeight;
    const hx = info && info.head ? info.head.hx : 0.8, hy = info && info.head ? info.head.hy : 0.05;
    const hw = info && info.head ? info.head.hw : 0.1;
    const x = f.body.offsetLeft + (hx + hw * 0.7) * bw, y = f.body.offsetTop + hy * bh;
    b.style.left = Math.round(Math.min(x, f.box.clientWidth - b.offsetWidth - 8)) + 'px';
    b.style.top = Math.max(4, Math.round(y - b.offsetHeight * 1.1)) + 'px';
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bayReact.timer);
    bayReact.timer = setTimeout(() => b.classList.remove('show'), 2000);
  }

  function unitNote(text) {
    setText($('un-note'), text);
    unitNote.at = Date.now();
  }

  // ----- care over time -----

  const drillSeen = { b: -1, i: -1, l: -1 };
  const lastAt = (g) => (g && g.stats().last ? g.stats().last.at || 0 : 0);

  function unitTick(now) {
    if (U.last > now) U.last = now; // the PC clock was set back: start counting again from here
    if (now - U.last < 5000) return;
    const dt = now - U.last;
    const away = dt > 180000; // the wallpaper was closed or paused
    const span = Math.min(dt, 8 * 3600000);
    const floor = away ? 15 : 0;
    const restMs = U.rest > U.last ? Math.min(U.rest, now) - U.last : 0;
    const h = span / 3600000, restH = Math.min(restMs, span) / 3600000, awakeH = Math.max(0, h - restH);
    const drop = (k, hours, rate) => {
      if (U[k] > floor) U[k] = Math.max(floor, U[k] - rate * hours);
    };
    drop('integrity', h, 2.5);
    drop('energy', awakeH, 4);
    drop('morale', awakeH, 3.5);
    if (restH) U.energy = Math.min(100, U.energy + restH * 180);
    if (!away && musicActive() && !resting()) U.morale = Math.min(100, U.morale + h * 10); // music cheers the unit up
    if (!away && U.integrity >= 50 && U.energy >= 50 && U.morale >= 50) U.xpFrac += h * 6; // well kept: 1 bond per 10 min
    U.last = now;
    if (U.xpFrac >= 1) {
      const n = Math.floor(U.xpFrac);
      U.xpFrac -= n;
      gainBond(n);
    }
    if (U.rest && (U.rest <= now || U.energy >= 100)) {
      U.rest = 0;
      U.energy = Math.min(100, Math.max(U.energy, 99.5));
      say('Report', T('{c} has left sleep mode. Energy {n}%.', { c: unitName(), n: Math.round(U.energy) }));
      bayReact('hop', 'sparkle');
    }

    const today = dayKey(new Date(now));
    if (U.supply !== today) {
      U.supply = today;
      U.items.small += 2;
      say('Report', T('Daily supply drop from the Bunker: Small Recovery x2.'));
    }
    if (garden) {
      const total = garden.stats().total;
      if (U.garden < 0) {
        U.garden = total;
        U.items.tear += Math.min(2, Math.floor(total / 3));
      }
      if (total < U.garden) U.garden = total;
      if (U.tearDay !== today) {
        U.tearDay = today;
        U.tearsToday = 0;
      }
      // A daily cap, so planting flowers as fast as possible cannot buy every bond level in an afternoon.
      while (total - U.garden >= 3) {
        U.garden += 3;
        if (U.tearsToday >= TEARS_PER_DAY) {
          if (U.tearCapDay !== today) {
            U.tearCapDay = today;
            say('Report', T('The GARDEN has given all the Lunar Tears it can spare today. More tomorrow.'));
          }
          continue;
        }
        U.tearsToday++;
        U.items.tear++;
        say('Report', T('A Lunar Tear from the GARDEN was set aside for {c}.', { c: unitName() }));
      }
    }
    const b = lastAt(breach), i = lastAt(intercept), l = logic ? logic.stats().solved : 0;
    if (drillSeen.b < 0) {
      drillSeen.b = b;
      drillSeen.i = i;
      drillSeen.l = l;
    } else if (b !== drillSeen.b || i !== drillSeen.i || l !== drillSeen.l) {
      drillSeen.b = b;
      drillSeen.i = i;
      drillSeen.l = l;
      unitEvent('drill');
    }
    checkUnlocks(false);
    if (now - unitSavedAt > 30000) saveUnit();
    unitRefresh(false);
  }

  // Rewards from the rest of the terminal.
  function unitEvent(kind, sub) {
    const c = unitName();
    if (kind === 'wellness') {
      U.morale = Math.min(100, U.morale + 4);
      gainBond(8);
      if (sub === 'water' && Math.random() < 0.08) {
        U.items.mackerel++;
        say('Report', T('A mackerel was recovered from the water supply. Do not ask how.'));
      } else if (Math.random() < 0.34) {
        U.items.small++;
        say('Report', T('{c} noticed you looking after yourself. Small Recovery x1 received.', { c: c }));
      }
    } else if (kind === 'orders') {
      U.items.large++;
      gainBond(15);
      say('Report', T('Daily orders rewarded: Large Recovery x1 for {c}.', { c: c }));
    } else if (kind === 'timer') {
      U.items.medium++;
      gainBond(10);
      say('Report', T('Focus operation rewarded: Medium Recovery x1 for {c}.', { c: c }));
    } else if (kind === 'drill') {
      U.morale = Math.min(100, U.morale + 8);
      U.energy = Math.max(0, U.energy - 6);
      U.drills++;
      gainBond(10);
    }
    checkUnlocks(true);
    saveUnit();
    unitRefresh(true);
  }

  function gainBond(n) {
    const lv0 = bondLv(U.xp);
    U.xp += n;
    const lv = bondLv(U.xp);
    if (lv > lv0) {
      say('Report', T('Bond with {c} reached level {n}.', { c: unitName(), n: lv }));
      if (isUnit(gallery.current)) {
        act('float');
        emote('heart');
      }
    }
  }

  // Announce what just became available, once. The first look only records what is already open.
  function checkUnlocks(announce) {
    const open = ACCS.filter((a) => a.id !== 'none' && accOpen(a)).map((a) => 'a.' + a.id);
    if (!U.seen) {
      U.seen = open;
      return;
    }
    const fresh = open.filter((k) => !U.seen.includes(k));
    if (!fresh.length) return;
    U.seen = U.seen.concat(fresh);
    saveUnit();
    if (announce === false && fresh.length > 3) return;
    for (const k of fresh) {
      const what = k.startsWith('a.') ? T(accById(k.slice(2)).name) : '';
      if (what) say('Report', T('Unlocked for {c}: {item}. Equip it in UNIT > WARDROBE.', { c: unitName(), item: what }));
    }
  }

  // ----- care actions -----

  function unitRepair(itemId) {
    const need = 100 - U.integrity;
    if (need < 2) {
      unitNote(T('No repairs needed. Integrity is at {n}%.', { n: Math.round(U.integrity) }));
      return;
    }
    const kinds = ['small', 'medium', 'large'];
    const pick = itemId || kinds.find((id) => U.items[id] > 0 && itemById(id).heal >= need) ||
      kinds.slice().reverse().find((id) => U.items[id] > 0);
    if (!pick || !U.items[pick]) {
      unitNote(T('No recovery items. A supply drop arrives every day; wellness proposals and focus operations earn more.'));
      bayReact('shake', 'sweat');
      return;
    }
    U.items[pick]--;
    U.integrity = Math.min(100, U.integrity + itemById(pick).heal);
    gainBond(need > 20 ? 8 : 3);
    unitNote(T('{item} applied. Integrity {n}%.', { item: T(itemById(pick).name), n: Math.round(U.integrity) }));
    const bay = $('bay');
    bay.classList.remove('repairing');
    void bay.offsetWidth;
    bay.classList.add('repairing');
    bayReact('float', 'sparkle');
    saveUnit();
    unitRefresh(true);
  }

  function unitRest() {
    const c = unitName();
    if (resting()) {
      U.rest = 0;
      unitNote(T('{c} woke up. Energy {n}%.', { c: c, n: Math.round(U.energy) }));
      bayReact('hop', 'surprise');
    } else if (U.energy >= 97) {
      unitNote(T('{c} is fully charged and refuses to sleep.', { c: c }));
      bayReact('shake', 'dots');
      return;
    } else {
      const mins = Math.max(1, Math.ceil((100 - U.energy) / 3));
      U.rest = Date.now() + mins * 60000;
      gainBond(U.energy < 60 ? 6 : 2);
      unitNote(T('{c} entered sleep mode. Full charge in about {n} min.', { c: c, n: mins }));
      bayReact(null, 'sleep');
    }
    saveUnit();
    unitRefresh(true);
  }

  const patLog = [];
  let patWarned = 0;
  function unitPat(fromDesk) {
    const now = Date.now(), c = unitName();
    while (patLog.length && now - patLog[0] > 120000) patLog.shift();
    patLog.push(now);
    if (patLog.length > 8) {
      U.morale = Math.max(0, U.morale - 2);
      unitNote(T('{c} has had enough attention for now.', { c: c }));
      if (!fromDesk) bayReact('shake', 'anger');
      if (!fromDesk && now - patWarned > 30000) {
        patWarned = now;
        say('Query', T('Why are you poking {c}?', { c: c }));
      }
    } else {
      U.morale = Math.min(100, U.morale + 5);
      if (patLog.length <= 4) gainBond(2);
      unitNote(resting() ? T('{c} stirs, still asleep.', { c: c }) : T('{c} seems pleased. Morale {n}%.', { c: c, n: Math.round(U.morale) }));
      if (!fromDesk) bayReact(resting() ? null : 'hop', resting() ? 'sleep' : U.morale > 90 ? 'heart' : 'sparkle');
    }
    saveUnit();
    unitRefresh(true);
  }

  function unitGift() {
    const c = unitName();
    if (!U.items.tear) {
      unitNote(T('No Lunar Tears in supply. One is set aside for every 3 flowers planted in the GARDEN, up to 3 a day.'));
      bayReact('shake', 'question');
      return;
    }
    U.items.tear--;
    U.tears++;
    U.morale = Math.min(100, U.morale + 25);
    gainBond(30);
    say('Report', T('{c} accepted the Lunar Tear. Lunar Tears given: {n}.', { c: c, n: U.tears }));
    unitNote(T('{c} holds the flower carefully. Morale {n}%.', { c: c, n: Math.round(U.morale) }));
    bayReact('float', 'flower');
    checkUnlocks(true);
    saveUnit();
    unitRefresh(true);
  }

  // Androids and mackerel do not mix (the game has an ending about it). The Pod will not allow it.
  function unitMackerel() {
    if (!U.items.mackerel) return;
    say('Warning', T('Mackerel is lethal to androids. Gift refused. This unit is keeping it away from {c}.', { c: unitName() }));
    unitNote(T('Mackerel is lethal to androids. Pod 042 refused to hand it over.'));
    bayReact('shake', 'alert');
  }

  function useItem(id) {
    if (!U.items[id]) return;
    if (id === 'tear') unitGift();
    else if (id === 'mackerel') unitMackerel();
    else unitRepair(id);
    if (nav.place === 'unit' && nav.sel === 'items') renderItems();
  }

  function assignUnit(file) {
    if (!file) return;
    const info = parseCharName(file);
    U.name = info.name;
    const outs = unitOutfits();
    const i = outs.indexOf(file);
    U.outfit = baseName(i >= 0 ? file : outs[0] || file);
    saveUnit();
    say('Report', T('{c} assigned as your unit. Bond and supplies carry over.', { c: info.name }));
    syncDesktopAcc();
    unitRefresh(true);
    if (nav.place === 'archive') refreshArcLive();
  }

  function deployUnit() {
    const f = unitFile();
    const i = gallery.files.indexOf(f);
    if (i < 0) {
      say('Alert', T('No image of {c} in the character archive.', { c: unitName() }));
      return;
    }
    deployRecord(i);
  }

  function equipOutfit(file) {
    U.outfit = baseName(file);
    saveUnit();
    // A unit held on the desktop changes clothes there too.
    if (gallery.pinned && isUnit(gallery.pinned) && gallery.pinned !== file) deployRecord(gallery.files.indexOf(file));
    unitRefresh(true);
  }

  function equipAcc(id) {
    U.acc = id;
    saveUnit();
    syncDesktopAcc();
    unitRefresh(true);
  }

  // ----- views -----

  function unitCond() {
    if (resting()) return K('SLEEP MODE');
    if (U.integrity < 25) return K('DAMAGED');
    if (U.energy < 20) return K('EXHAUSTED');
    if (U.morale < 20) return K('SULKING');
    if (Math.min(U.integrity, U.energy, U.morale) < 45) return K('FATIGUED');
    if (U.morale >= 90 && U.integrity >= 70 && U.energy >= 70) return K('EXCELLENT');
    return K('NOMINAL');
  }

  // What the unit needs most, for emotes and the Pod: '', 'rest', 'tired', 'sad', 'hurt' or 'happy'.
  function unitNeed() {
    if (resting()) return 'rest';
    if (U.integrity < 25) return 'hurt';
    if (U.energy < 25) return 'tired';
    if (U.morale < 25) return 'sad';
    if (U.morale >= 90 && U.energy >= 60) return 'happy';
    return '';
  }

  function setMeter(id, v, label) {
    const el = $(id);
    if (!el._m) el._m = { v: el.querySelector('.m-val'), f: el.querySelector('.fill') };
    setText(el._m.v, label !== undefined ? label : Math.round(v) + '%');
    const w = clamp(v, 0, 100).toFixed(1) + '%';
    if (el._m.f.style.width !== w) el._m.f.style.width = w;
    el.classList.toggle('low', v < 25);
  }

  function bondInfo() {
    const lv = bondLv(U.xp);
    if (lv >= BOND_XP.length) return { lv: lv, pct: 100, label: T('LV {n}', { n: lv }) + '  //  ' + T('MAX') };
    const a = BOND_XP[lv - 1], b = BOND_XP[lv];
    return { lv: lv, pct: (U.xp - a) / (b - a) * 100, label: T('LV {n}', { n: lv }) + '  //  ' + (U.xp - a) + ' / ' + (b - a) };
  }

  function updateUnitPreview() {
    const f = figFor('un-mini');
    setFig(f, unitFile(), U.acc);
    setText($('hu-name'), unitName().toUpperCase());
    fitText($('hu-name'));
    setText($('hu-cond'), T(unitCond()));
    setMeter('hu-int', U.integrity);
    setMeter('hu-en', U.energy);
    setMeter('hu-mo', U.morale);
    const bi = bondInfo();
    setMeter('hu-bond', bi.pct, bi.label);
  }

  function renderCare(now, force) {
    const f = figFor('bay-fig');
    if (force || f.file !== unitFile() || f.accId !== U.acc) setFig(f, unitFile(), U.acc);
    $('bay').classList.toggle('no-fig', !unitFile());
    const info = parseCharName(unitFile() || unitName());
    setText($('un-name'), unitName().toUpperCase());
    fitText($('un-name'));
    setText($('un-sub'), unitFile() ? info.sub : '');
    setText($('un-cond'), T(unitCond()));
    const days = Math.max(1, Math.floor((now - U.born) / 86400000) + 1);
    setText($('un-age'), TN(days, '{n} DAY|{n} DAYS'));
    setMeter('un-int', U.integrity);
    setMeter('un-en', U.energy);
    setMeter('un-mo', U.morale);
    const bi = bondInfo();
    setMeter('un-bond', bi.pct, bi.label);
    const rest = resting();
    $('bay').classList.toggle('sleeping', rest);
    setText($('bay-sleep'), rest ? T('SLEEP MODE  //  {n} MIN', { n: Math.max(1, Math.ceil((U.rest - now) / 60000)) }) : '');
    const heals = U.items.small + U.items.medium + U.items.large;
    setText($('un-repair'), T('REPAIR') + '  x' + heals);
    $('un-repair').classList.toggle('off', !heals || U.integrity > 98);
    setText($('un-rest'), rest ? T('WAKE') : T('SLEEP'));
    setText($('un-gift'), T('GIFT LUNAR TEAR') + '  x' + U.items.tear);
    $('un-gift').classList.toggle('off', !U.items.tear);
    if (!unitNote.at || now - unitNote.at > 12000) {
      const need = unitNeed();
      unitNote.at = 0;
      setText($('un-note'), need === 'hurt' ? T('Integrity is low. Repair with a recovery item.')
        : need === 'tired' ? T('Energy is low. Sleep mode recharges it.')
          : need === 'sad' ? T('Morale is low. A pat or a Lunar Tear will help.')
            : rest ? T('Sleeping. Morale holds while the unit rests.')
              : T('Click the unit to pat it. Music, drills and your own wellness breaks also lift it.'));
    }
  }

  function renderWardrobe() {
    setFig(figFor('wd-fig'), unitFile(), U.acc);
    const outs = unitOutfits(), cur = unitFile();
    const go = $('wd-outfits');
    go.textContent = '';
    if (!outs.length) go.appendChild(emptyRow(T('NO IMAGES OF THIS UNIT')));
    outs.forEach((file, i) => {
      const card = document.createElement('div');
      card.className = 'wd-card' + (file === cur ? ' on' : '');
      const pic = document.createElement('div');
      pic.className = 'wd-pic';
      pic.appendChild(thumbEl(file, 'char-img on'));
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = (parseCharName(file).sub || T('STANDARD')).toUpperCase();
      const st = document.createElement('span');
      st.className = 'st';
      st.textContent = file === cur ? T('EQUIPPED') : T('EQUIP');
      card.append(pic, nm, st);
      card.addEventListener('click', () => equipOutfit(file));
      go.appendChild(card);
    });
    const ga = $('wd-acc');
    ga.textContent = '';
    for (const a of ACCS) {
      const open = accOpen(a);
      const card = document.createElement('div');
      card.className = 'wd-card acc-card' + (a.id === U.acc ? ' on' : '') + (open ? '' : ' locked');
      const pic = document.createElement('div');
      pic.className = 'wd-pic';
      pic.innerHTML = accSvg(a.id);
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = T(a.name);
      const ds = document.createElement('span');
      ds.className = 'ds';
      ds.textContent = T(a.desc);
      const st = document.createElement('span');
      st.className = 'st';
      st.textContent = !open ? accLock(a) : a.id === U.acc ? T('EQUIPPED') : T('EQUIP');
      card.append(pic, nm, ds, st);
      if (open) card.addEventListener('click', () => equipAcc(a.id));
      ga.appendChild(card);
    }
    const frame = figs['wd-fig'] && figs['wd-fig'].info && !figs['wd-fig'].info.head;
    setText($('wd-note'), frame ? T('This image is not a transparent cutout, so accessories cannot be placed on it.') : '');
  }

  function renderItems() {
    const t = $('items-table');
    t.textContent = '';
    t.appendChild(trow([['c-m', T('ITEM')], ['c-n', T('HELD')], ['c-s', T('EFFECT')], ['c-r', T('SOURCE')], ['c-u', '']], true));
    for (const it of ITEMS) {
      const r = trow([['c-m', T(it.name)], ['c-n', String(U.items[it.id] || 0)], ['c-s', T(it.desc)], ['c-r', T(it.src)]]);
      const b = document.createElement('span');
      b.className = 'btn c-u' + (U.items[it.id] ? '' : ' off');
      b.textContent = it.id === 'tear' || it.id === 'mackerel' ? T('GIFT') : T('USE');
      b.addEventListener('click', () => useItem(it.id));
      r.appendChild(b);
      t.appendChild(r);
    }
    setText($('items-stats'), T('LUNAR TEARS GIVEN {a}  //  DRILLS FINISHED {b}', { a: U.tears, b: U.drills }));
  }

  // Refresh whatever shows the unit right now.
  function unitRefresh(force) {
    if (nav.place === 'unit') {
      if (nav.sel === 'care') renderCare(Date.now(), force);
      else if (force && nav.sel === 'wardrobe') renderWardrobe();
      else if (force && nav.sel === 'items') renderItems();
      refreshSideValues();
    } else if (!nav.place && state.panel === 'unit') {
      updateUnitPreview();
    }
  }

  $('un-repair').addEventListener('click', () => unitRepair());
  $('un-rest').addEventListener('click', unitRest);
  $('un-pat').addEventListener('click', () => unitPat(false));
  $('un-gift').addEventListener('click', unitGift);
  $('bay-fig').addEventListener('click', () => unitPat(false));

  hooks.unit = {
    sub(id) {
      if (id === 'wardrobe') renderWardrobe();
      else if (id === 'items') renderItems();
    },
    refresh(now, force) {
      if (nav.sel === 'care') renderCare(now, force);
      else if (force && nav.sel === 'wardrobe') renderWardrobe();
      else if (force && nav.sel === 'items') renderItems();
      if (force) for (const id in figs) layoutFig(figs[id]);
      refreshSideValues();
    }
  };

  // ----- HACKING: BREACH, INTERCEPT, LOGIC LOCK, records -----

  function renderRecords() {
    const rb = $('rec-br');
    rb.textContent = '';
    rb.appendChild(trow([['c-n', T('NO')], ['c-m', T('SCORE')], ['c-s', T('BREACHES')], ['c-r', T('DATE')]], true));
    const bruns = breach ? breach.stats().runs : [];
    if (!bruns.length) rb.appendChild(emptyRow(T('NO RUNS RECORDED')));
    bruns.forEach((r, i) => {
      rb.appendChild(trow([['c-n', pad(i + 1)], ['c-m', String(r.score).padStart(6, '0')], ['c-s', pad(r.stages)], ['c-r', shortDate(r.at)]]));
    });
    const ri = $('rec-int');
    ri.textContent = '';
    ri.appendChild(trow([['c-n', T('NO')], ['c-m', T('SCORE')], ['c-s', T('WAVE // ACCURACY')], ['c-r', T('DATE')]], true));
    const runs = intercept ? intercept.stats().runs : [];
    if (!runs.length) ri.appendChild(emptyRow(T('NO RUNS RECORDED')));
    runs.forEach((r, i) => {
      ri.appendChild(trow([['c-n', pad(i + 1)], ['c-m', String(r.score).padStart(6, '0')],
        ['c-s', T('WAVE {w} // {acc}%', { w: pad(r.wave), acc: Math.round(r.acc * 100) })], ['c-r', shortDate(r.at)]]));
    });
    const rl = $('rec-log');
    rl.textContent = '';
    rl.appendChild(trow([['c-m', T('BOARD')], ['c-r', T('BEST TIME')]], true));
    const ls = logic ? logic.stats() : { best: {}, solved: 0, level: 1, size: 5 };
    const sizes = Object.keys(ls.best).map(Number).sort((a, b) => a - b);
    if (!sizes.length) rl.appendChild(emptyRow(T('NO LOCKS RELEASED')));
    for (const n of sizes) rl.appendChild(trow([['c-m', n + ' X ' + n], ['c-r', fmtMS(ls.best[n] * 1000)]]));
    rl.appendChild(trow([['c-m', T('LOCKS RELEASED')], ['c-r', String(ls.solved)]]));
    rl.appendChild(trow([['c-m', T('CURRENT LEVEL')], ['c-r', pad(ls.level) + ' // ' + ls.size + ' X ' + ls.size]]));
  }

  function updateHackingPreview() {
    const sb = breach ? breach.stats() : null;
    const bb = sb && sb.runs[0];
    setText($('hv-br-best'), bb ? String(bb.score).padStart(6, '0') + '  //  ' + TN(bb.stages, '{n} BREACH|{n} BREACHES') : T('NO RECORD'));
    setText($('hv-br-last'), sb && sb.last ? String(sb.last.score).padStart(6, '0') + '  //  ' + shortDate(sb.last.at) : '--');
    const si = intercept ? intercept.stats() : null;
    const best = si && si.runs[0];
    setText($('hv-int-best'), best ? String(best.score).padStart(6, '0') + '  //  ' + T('WAVE {w}', { w: pad(best.wave) }) : T('NO RECORD'));
    setText($('hv-int-last'), si && si.last ? String(si.last.score).padStart(6, '0') + '  //  ' + shortDate(si.last.at) : '--');
    const sl = logic ? logic.stats() : null;
    setText($('hv-log-solved'), sl ? String(sl.solved) : '--');
    setText($('hv-log-level'), sl ? pad(sl.level) + '  //  ' + sl.size + ' X ' + sl.size : '--');
  }

  hooks.hacking = {
    sub(id) {
      if (breach) breach[id === 'breach' ? 'show' : 'hide']();
      if (intercept) intercept[id === 'intercept' ? 'show' : 'hide']();
      if (logic) logic[id === 'logic' ? 'show' : 'hide']();
      if (id === 'records') renderRecords();
    },
    leave() {
      if (breach) breach.hide();
      if (intercept) intercept.hide();
      if (logic) logic.hide();
    },
    frame(dt, t) {
      if (nav.sel === 'breach' && breach) breach.frame(dt, t);
      else if (nav.sel === 'intercept' && intercept) intercept.frame(dt, t);
      else if (nav.sel === 'logic' && logic) logic.frame(dt, t);
    }
  };

  // ----- GARDEN: Lunar Tear field -----

  function updateGardenPreview() {
    if (!games.moon) return;
    const m = games.moon(new Date());
    const days = Math.round(m.toFull);
    setText($('gv-phase'), T(m.name));
    setText($('gv-illum'), Math.round(m.illum * 100) + '%');
    setText($('gv-full'), days < 1 ? T('TONIGHT') : T('IN {days}', { days: TN(days, '{n} DAY|{n} DAYS') }));
    const gs = garden ? garden.stats() : null;
    setText($('gv-count'), gs ? T('{alive} IN FIELD  //  {total} PLANTED', { alive: gs.alive, total: gs.total }) : '--');
    const c = $('moon-mini');
    fitCanvas(c);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    games.drawMoon(ctx, c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.36, m.phase, state.colors, dpr());
  }

  hooks.garden = {
    enter() { if (garden) garden.show(); },
    leave() { if (garden) garden.hide(); },
    refresh() { refreshSideValues(); },
    frame(dt, t) { if (garden) garden.frame(dt, t); }
  };

  // ----- SYSTEM: diagnostics, quick settings, about -----

  // opts: [value, label, raw]; raw labels (language names) are shown as they are.
  const langName = (code) => (I18N.list.find((l) => l.code === code) || { name: code }).name;
  const SETTINGS = [
    { label: K('LANGUAGE'), field: 'language', opts: () => [['auto', K('AUTO')]].concat(I18N.list.map((l) => [l.code, l.name, true])) },
    { label: K('THEME'), field: 'theme', opts: [['light', K('DAYLIGHT')], ['dark', K('NIGHT')], ['auto', K('AUTO (BY CLOCK)')]] },
    { label: K('LAYOUT'), field: 'layout', opts: [['left', K('MENU LEFT')], ['right', K('MENU RIGHT')]] },
    { label: K('DESKTOP CHARACTER'), field: 'charMode', opts: [['stand', K('ON')], ['off', K('OFF')]] },
    { label: K('POD LOG'), field: 'showLog', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('DESKTOP AGENDA'), field: 'calWidget', opts: [['auto', K('WHEN SOMETHING IS PLANNED')], ['on', K('ALWAYS')], ['off', K('HIDDEN')]] },
    { label: K('CALENDAR ALERTS'), field: 'calAlerts', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('ALERT CHIME'), field: 'calSound', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('WEEK STARTS ON'), field: 'weekStart', opts: [['auto', K('AUTO')], ['monday', K('MONDAY')], ['sunday', K('SUNDAY')], ['saturday', K('SATURDAY')]] },
    { label: K('YORHA HELPER'), field: 'helper', opts: [[false, K('OFF')], [true, K('ON')]], confirm: helperDisclaimer },
    { label: K('ON-SCREEN KEYBOARD'), field: 'oskb', opts: [['auto', K('WHEN YORHA HELPER IS OFF')], ['on', K('ALWAYS')], ['off', K('HIDDEN')]] },
    { label: K('AUDIO LOG'), field: 'audioLog', opts: [['keep', K('KEEP')], ['music', K('MUSIC ONLY')], ['session', K('THIS SESSION ONLY')], ['off', K('OFF')]] },
    { label: K('AUDIO VISUALIZER'), field: 'showViz', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('AUDIO SENSITIVITY'), field: 'audioGain', opts: [[50, '50%', true], [100, '100%', true], [200, '200%', true], [400, '400%', true], [800, '800%', true]], fmt: (v) => Math.round(v) + '%' },
    { label: K('AUTO-BOOST QUIET AUDIO'), field: 'audioAuto', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('PARTICLES'), field: 'particles', opts: [[0, K('OFF')], [40, K('LOW')], [70, K('NORMAL')], [150, K('HIGH')]] },
    { label: K('SCANLINES AND GRAIN'), field: 'scanlines', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('GLITCH EFFECT'), field: 'glitch', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('MOUSE PARALLAX'), field: 'parallax', opts: [[true, K('ON')], [false, K('OFF')]] },
    { label: K('RETURN TO HUB WHEN IDLE'), field: 'hubReturn', opts: [[0, K('NEVER')], [60, K('1 MIN')], [120, K('2 MIN')], [300, K('5 MIN')], [600, K('10 MIN')]] }
  ];

  function settingRow(label, tag, value, onClick, cls) {
    const row = document.createElement('div');
    row.className = 'set-row' + (cls ? ' ' + cls : '');
    const l = document.createElement('span');
    l.className = 'lbl';
    l.textContent = label;
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = tag;
    const v = document.createElement('span');
    v.className = 'val';
    v.textContent = value;
    row.append(l, t, v);
    row.addEventListener('click', onClick);
    return row;
  }

  function renderSettings() {
    const box = $('settings');
    box.textContent = '';
    for (const s of SETTINGS) {
      const opts = typeof s.opts === 'function' ? s.opts() : s.opts;
      const cur = opts.find((o) => o[0] === cfg[s.field]);
      let shown = cur ? (cur[2] ? cur[1] : T(cur[1])) : s.fmt ? s.fmt(cfg[s.field]) : String(cfg[s.field]).toUpperCase();
      if (s.field === 'language' && cfg.language === 'auto') shown += ' // ' + langName(I18N.code);
      box.appendChild(settingRow(T(s.label), s.field in overrides ? T('CUSTOM') : '', shown, () => {
        const i = opts.findIndex((o) => o[0] === cfg[s.field]);
        const next = opts[(i + 1) % opts.length][0];
        if (s.confirm && next === true) s.confirm(); // switching YoRHa Helper on goes through its disclaimer
        else setOverride(s.field, next);
      }));
    }
    box.appendChild(settingRow(T('USE WALLPAPER ENGINE SETTINGS'), '', T('RESET'), () => {
      for (const f of Object.keys(overrides)) {
        delete overrides[f];
        cfg[f] = base[f];
      }
      store.set('overrides', overrides);
      say('Report', T('Quick settings cleared. Wallpaper Engine properties restored.'));
      applyConfig();
    }, 'reset'));
  }

  hooks.system = {
    sub() {
      closeHelperNote();
    },
    leave() {
      closeHelperNote();
    },
    refresh(now, force) {
      if (nav.sel === 'diag') updateSystem(now, 'ps-');
      else if (nav.sel === 'settings' && force) renderSettings();
    },
    frame() {
      if (nav.sel === 'diag') drawSpark($('ps-spark'));
    }
  };

  // ---------- language switch ----------

  // Re-render everything that carries text. Static page text was remembered in English at start-up.
  function relabel() {
    I18N.translateStatic(document.body);
    applyPodBank();
    for (const li of $('tab-list').children) li.textContent = T(PLACES[li.dataset.place].title);
    for (const [id, label] of OPS) opsEls[id].name.textContent = T(label);
    const now = Date.now();
    setText($('unit-label'), T('UNIT {u}', { u: unit().toUpperCase() }));
    setText($('footer-text'), footerLabel());
    if (state.panel) {
      setText($('panel-title'), T(PLACES[state.panel].title));
      setText($('panel-sub'), T(PANEL_SUB[state.panel]));
    }
    applyImages();
    planner.relabel();
    updateClock(new Date(now));
    updateDossier();
    updateDossierNext(now);
    timerTick(now);
    refreshPanel(now);
    if (nav.place) {
      setText($('side-title'), T(PLACES[nav.place].title));
      setText($('place-sub'), T(PLACES[nav.place].sub));
      const sel = nav.sel;
      buildSide(nav.place);
      nav.sel = '';
      selectSub(sel);
    }
    fitNames();
    fitShowLabel();
  }

  // ---------- film grain texture ----------

  (function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    $('grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
  })();

  // ---------- loops ----------

  let lastFrame = performance.now();
  let frames = 0;
  let fpsAt = lastFrame;

  function frame(now) {
    requestAnimationFrame(frame);
    if (state.paused) {
      lastFrame = now;
      return;
    }
    if (state.fpsLimit > 0 && now - lastFrame < 1000 / state.fpsLimit - 2) return;
    // A rAF timestamp can predate lastFrame; a negative step would make the audio smoothing diverge.
    const dt = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
    lastFrame = now;
    const t = now / 1000;

    frames++;
    if (now - fpsAt >= 1000) {
      state.fps = Math.round(frames * 1000 / (now - fpsAt));
      frames = 0;
      fpsAt = now;
    }

    if (!audio.hasApi) fakeAudio(t);
    updateAudio(dt);
    updateParallax(dt);
    if (cfg.particles > 0) drawParticles(dt, t);
    drawGlobe(dt, t);
    if (nav.place) {
      placeFrame(dt, t);
    } else {
      drawViz();
      updateActor(dt, t);
      if (state.panel === 'intel') drawIntelViz($('intel-viz'));
      else if (state.panel === 'system') drawSpark($('sys-spark'));
    }
    updatePod(dt);
  }

  function slowTick() {
    if (state.paused) return;
    const now = Date.now();
    updateClock(new Date(now));
    if (!nav.place) cycleTick(now);
    galleryTick(now);
    actorTick();
    podTick(now);
    timerTick(now);
    wellTick(now);
    planner.tick(now);
    linkTick(now);
    unitTick(now);
    refreshPanel(now);
    placeTick(now);
    if (cfg.theme === 'auto' && now - state.themeCheck > 20000) {
      state.themeCheck = now;
      applyTheme(true);
    }
    audio.history[audio.histHead] = audio.level;
    audio.histHead = (audio.histHead + 1) % audio.history.length;
  }

  window.addEventListener('resize', () => {
    for (const id in figs) layoutFig(figs[id]);
    positionCursor();
    positionSideCursor();
    layoutActor();
    fitNames();
    fitShowLabel();
  });

  // ---------- init ----------

  // Preview helper for a normal browser, e.g. index.html#theme=dark&startpanel=quests
  // (charfiles=pathA|pathB stands in for the character folder).
  // place=map&sub=ruins opens a place directly.
  let previewChars = null, previewPlace = '', previewSub = '';
  if (location.hash.length > 1) {
    for (const [key, raw] of new URLSearchParams(location.hash.slice(1))) {
      if (key === 'charfiles') previewChars = raw.split('|');
      if (key === 'place') previewPlace = raw;
      if (key === 'sub') previewSub = raw;
      const field = PROP_MAP[key];
      if (!field) continue;
      const cur = base[field];
      base[field] = typeof cur === 'boolean' ? (raw === 'true' || raw === '1')
        : typeof cur === 'number' ? Number(raw) : raw;
      if (!(field in overrides)) cfg[field] = base[field];
    }
  }

  I18N.translateStatic(document.body); // remember the English originals before any language applies
  applyConfig();
  if (previewChars) setGalleryFiles(previewChars);
  // Outside Wallpaper Engine nothing sends the folder property: show the bundled set.
  else setTimeout(() => { if (!weSeen && !gallery.files.length) useBundled(); }, 1200);
  setPanel(cfg.startPanel, false);
  if (PLACES[previewPlace]) showPlace(previewPlace, previewSub);
  updateClock(new Date());
  scheduleIdle(Date.now() + 15000);
  // After Wallpaper Engine has applied the unit name, and once the language file is in.
  setTimeout(function hello() {
    if (I18N.loading) setTimeout(hello, 300);
    else greet();
  }, 1500);

  let weSeen = false;
  window.wallpaperPropertyListener = {
    applyUserProperties: function (props) {
      // The first call carries every property; later calls carry only what the user just changed,
      // and a change made in Wallpaper Engine replaces the matching quick setting.
      const first = !weSeen;
      weSeen = true;
      let dropped = false;
      for (const key in props) {
        const field = PROP_MAP[key];
        if (!field || !props[key] || props[key].value === undefined) continue;
        base[field] = props[key].value;
        if (!first && field in overrides) {
          delete overrides[field];
          dropped = true;
        }
        cfg[field] = field in overrides ? overrides[field] : base[field];
      }
      if (dropped) store.set('overrides', overrides);
      applyConfig();
      if (props.charfolder) onFolderChange(props.charfolder.value);
      if (props.startpanel) setPanel(cfg.startPanel, false);
    },
    userDirectoryFilesAddedOrChanged: function (propertyName, changedFiles) {
      if (propertyName !== 'charfolder' || !Array.isArray(changedFiles)) return;
      setGalleryFiles(gallery.files.concat(changedFiles));
    },
    userDirectoryFilesRemoved: function (propertyName, removedFiles) {
      if (propertyName !== 'charfolder' || !Array.isArray(removedFiles)) return;
      const gone = new Set(removedFiles.map(normPath));
      setGalleryFiles(gallery.files.filter((p) => !gone.has(normPath(p))));
    },
    applyGeneralProperties: function (props) {
      if (props.fps !== undefined) {
        const f = typeof props.fps === 'object' ? props.fps.value : props.fps;
        state.fpsLimit = Number(f) || 0;
      }
    },
    setPaused: function (isPaused) {
      state.paused = !!isPaused;
    }
  };

  if (audio.hasApi) window.wallpaperRegisterAudioListener(onAudio);
  if (typeof window.wallpaperRegisterMediaStatusListener === 'function') window.wallpaperRegisterMediaStatusListener(onMediaStatus);
  if (hasMediaApi) window.wallpaperRegisterMediaPropertiesListener(onMediaProps);
  if (typeof window.wallpaperRegisterMediaThumbnailListener === 'function') window.wallpaperRegisterMediaThumbnailListener(onMediaThumb);
  if (typeof window.wallpaperRegisterMediaPlaybackListener === 'function') window.wallpaperRegisterMediaPlaybackListener(onMediaPlayback);
  if (typeof window.wallpaperRegisterMediaTimelineListener === 'function') window.wallpaperRegisterMediaTimelineListener(onMediaTimeline);

  requestAnimationFrame(frame);
  setInterval(slowTick, 250);
  scheduleGlitch();
})();
