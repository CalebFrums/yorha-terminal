/* YoRHa Terminal -- translation layer.
   English text is the key. Each language file (lang/<code>.js, generated from i18n/<code>.txt by
   tools/build_i18n.mjs) adds window.YoRHaLang[code] = { ui: { 'ENGLISH KEY': 'translation' }, pod: {...} },
   where pod has the same shape as window.YoRHaPod. lang/index.js lists the languages that exist.
   Only the language in use is loaded. */
(function () {
  'use strict';

  window.YoRHaLang = window.YoRHaLang || {};
  const LIST = (window.YoRHaLangIndex || [{ code: 'en', name: 'English', html: 'en' }]).slice();
  if (!LIST.some((l) => l.code === 'en')) LIST.unshift({ code: 'en', name: 'English', html: 'en' });

  // Plural form index for "one|few|many" style keys, per language.
  function pluralIndex(code, n) {
    n = Math.abs(Math.floor(Number(n) || 0));
    switch (code) {
      case 'zh': case 'ja': case 'ko': return 0;
      case 'ru': {
        const a = n % 10, b = n % 100;
        if (a === 1 && b !== 11) return 0;
        if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 1;
        return 2;
      }
      case 'fr': case 'pt': return n < 2 ? 0 : 1;
      default: return n === 1 ? 0 : 1;
    }
  }

  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : s);

  const I18N = {
    code: 'en',
    html: 'en',
    list: LIST,
    dict: null,
    pod: null,
    loading: '',

    // T('REMAINING {time}', { time: '04:12' }); unknown placeholders are left for later filling.
    t(key, vars) {
      const d = I18N.dict;
      const s = d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : key;
      return fill(s, vars);
    },

    // n(3, '{n} DAY|{n} DAYS') -> '3 DAYS'; translations list as many forms as the language needs.
    n(count, key, vars) {
      const forms = I18N.t(key).split('|');
      const i = Math.min(forms.length - 1, pluralIndex(I18N.code, count));
      return fill(forms[i], Object.assign({ n: count }, vars || {}));
    },

    has(code) {
      return LIST.some((l) => l.code === code);
    },

    // 'auto' -> the first language the browser reports that we have; English otherwise.
    resolve(want) {
      if (want && want !== 'auto' && I18N.has(want)) return want;
      const asks = [];
      try {
        if (navigator.languages) asks.push.apply(asks, navigator.languages);
        if (navigator.language) asks.push(navigator.language);
        asks.push(Intl.DateTimeFormat().resolvedOptions().locale);
      } catch (e) { /* keep what we have */ }
      for (const a of asks) {
        const code = String(a || '').toLowerCase().split(/[-_]/)[0];
        if (I18N.has(code)) return code;
      }
      return 'en';
    },

    // Switch language; done() runs once the strings are ready (at once for English or a loaded file).
    use(code, done) {
      code = I18N.has(code) ? code : 'en';
      const apply = () => {
        const pack = code === 'en' ? null : window.YoRHaLang[code];
        if (code !== 'en' && !pack) code = 'en';
        I18N.code = code;
        I18N.html = (LIST.find((l) => l.code === code) || LIST[0]).html || code;
        I18N.dict = pack ? pack.ui || null : null;
        I18N.pod = pack ? pack.pod || null : null;
        I18N.loading = '';
        document.documentElement.lang = I18N.html;
        if (done) done(code);
      };
      if (code === I18N.code && !I18N.loading) {
        if (done) done(code);
        return;
      }
      if (code === 'en' || window.YoRHaLang[code]) {
        apply();
        return;
      }
      if (I18N.loading === code) return;
      I18N.loading = code;
      const s = document.createElement('script');
      s.src = 'lang/' + code + '.js';
      s.onload = () => {
        if (I18N.loading === code) apply();
      };
      s.onerror = () => {
        if (I18N.loading !== code) return;
        code = 'en';
        apply();
      };
      document.head.appendChild(s);
    },

    // Static text in the page: the first pass remembers each text node's English original,
    // later passes re-translate only those nodes (text set by code is translated where it is set).
    translateStatic(root) {
      const first = !I18N._walked;
      I18N._walked = true;
      const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentNode;
          if (!p || /^(SCRIPT|STYLE|CANVAS)$/.test(p.nodeName) || (p.closest && p.closest('svg'))) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node._en === undefined) {
          if (!first) continue;
          const raw = node.nodeValue;
          if (!/[A-Za-z]/.test(raw)) continue;
          const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
          node._en = m[2];
          node._lead = m[1];
          node._trail = m[3];
        }
        const v = node._lead + I18N.t(node._en) + node._trail;
        if (node.nodeValue !== v) node.nodeValue = v;
      }
    }
  };

  window.YoRHaI18N = I18N;
})();
