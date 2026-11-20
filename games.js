/* YoRHa Terminal -- the 2D HACKING drills (INTERCEPT, LOGIC LOCK) and the garden toy for the GARDEN place
   (the 3D drill BREACH is breach3d.js).
   Each factory takes its canvas and a small API from main.js and returns
   { show, hide, frame(dt, t), busy, stats }. Everything is drawn procedurally. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const easeOut = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
  const fmtTime = (s) => Math.floor(s / 60) + ':' + pad(Math.floor(s % 60));
  // Translation (i18n.js); English text is the key. K marks text that is translated where it is shown.
  const T = (k, v) => (window.YoRHaI18N ? window.YoRHaI18N.t(k, v) : k);
  const TN = (n, k, v) => (window.YoRHaI18N ? window.YoRHaI18N.n(n, k, v) : k.split('|')[n === 1 ? 0 : 1].replace('{n}', n));
  const K = (k) => k;

  // Pointer position in canvas pixels.
  function pointerPos(c, e) {
    const r = c.getBoundingClientRect();
    const k = c.width / Math.max(1, r.width);
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  }

  // Terminal-font text; size is in CSS px, o = { align, base, color, spacing (em) }.
  function text(ctx, api, str, x, y, size, o) {
    o = o || {};
    const k = api.dpr();
    ctx.font = Math.round(size * k) + 'px ' + api.font;
    if ('letterSpacing' in ctx) ctx.letterSpacing = ((o.spacing !== undefined ? o.spacing : 0.18) * size * k).toFixed(1) + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.fillStyle = o.color || 'rgb(' + api.colors().ink + ')';
    ctx.fillText(str, x, y);
  }

  // Canvas buttons are laid out every frame and hit-tested on click.
  function drawButtons(ctx, api, list, hot) {
    const col = api.colors(), k = api.dpr();
    for (const b of list) {
      const on = b.id === hot;
      ctx.fillStyle = on ? 'rgb(' + col.ink + ')' : 'rgba(' + col.paper + ',0.95)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgb(' + col.ink + ')';
      ctx.lineWidth = k;
      ctx.strokeRect(b.x + 0.5 * k, b.y + 0.5 * k, b.w - k, b.h - k);
      text(ctx, api, b.label, b.x + b.w / 2, b.y + b.h / 2 + k, 13, {
        align: 'center', base: 'middle', spacing: 0.24, color: on ? col.hl : 'rgb(' + col.ink + ')'
      });
    }
  }
  const hitButton = (list, p) => list.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);

  function backdrop(ctx, api, W, H, a) {
    ctx.fillStyle = 'rgba(' + api.colors().paper + ',' + a + ')';
    ctx.fillRect(0, 0, W, H);
  }

  // ======================================================================
  // INTERCEPT: intrusion packets converge on a core; click them to destroy them.
  // ======================================================================

  function intercept(canvas, api) {
    const ctx = canvas.getContext('2d');
    const MAX_HP = 5;
    const CORE = 0.075; // core radius in board units (1 = short side of the canvas)
    const TYPES = {
      drone: { size: 0.026, speed: 0.085, hp: 1, score: 10, dmg: 1 },
      splitter: { size: 0.034, speed: 0.068, hp: 1, score: 20, dmg: 1 },
      mini: { size: 0.017, speed: 0.12, hp: 1, score: 5, dmg: 1 },
      armor: { size: 0.042, speed: 0.048, hp: 3, score: 40, dmg: 2 },
      glitch: { size: 0.026, speed: 0.1, hp: 1, score: 30, dmg: 2 }
    };
    const g = {
      visible: false, mode: 'title', t: 0,
      enemies: [], parts: [], beams: [], rings: [], floats: [], crate: null,
      score: 0, wave: 0, hp: MAX_HP, combo: 0, hits: 0, shots: 0,
      toSpawn: 0, spawnT: 0, gap: 1, speedMul: 1, waveT: 0, waveHurt: false, crateT: 25,
      banner: '', bannerT: 0, shake: 0, flash: 0,
      mx: -1, my: -1, lastMove: 0, buttons: [], hot: '', overAt: 0, newBest: false,
      W: 1, H: 1, S: 1, cx: 0, cy: 0
    };
    let runs = api.store.get('intercept.runs', []);
    let last = api.store.get('intercept.last', null);

    const mult = () => 1 + Math.min(3, Math.floor(g.combo / 6) * 0.5);
    const reach = () => 0.5 * Math.hypot(g.W, g.H) / g.S + 0.05;
    // Distance from the centre to just past the visible edge in direction a, so packets enter right away.
    const edgeDist = (a) => Math.min(g.W / 2 / Math.max(1e-3, Math.abs(Math.cos(a))), g.H / 2 / Math.max(1e-3, Math.abs(Math.sin(a)))) / g.S + 0.04;

    function banner(s, dur) {
      g.banner = s;
      g.bannerT = dur || 1.6;
    }

    function start() {
      g.mode = 'play';
      g.enemies = [];
      g.parts = [];
      g.beams = [];
      g.rings = [];
      g.floats = [];
      g.crate = null;
      g.score = 0;
      g.wave = 0;
      g.hp = MAX_HP;
      g.combo = 0;
      g.hits = 0;
      g.shots = 0;
      g.crateT = rand(20, 30);
      g.lastMove = performance.now();
      nextWave();
    }

    function nextWave() {
      g.wave++;
      g.toSpawn = 5 + g.wave * 3;
      g.gap = Math.max(0.28, 1.2 - g.wave * 0.08);
      g.spawnT = 1.4;
      g.speedMul = 1 + (g.wave - 1) * 0.07;
      g.waveHurt = false;
      g.waveT = 0;
      banner(T('WAVE {w}', { w: pad(g.wave) }));
    }

    function pickType() {
      const w = g.wave, r = Math.random();
      if (w >= 4 && r < 0.13) return 'glitch';
      if (w >= 3 && r < 0.3) return 'armor';
      if (w >= 2 && r < 0.52) return 'splitter';
      return 'drone';
    }

    function spawn(type, x, y, curl) {
      const ty = TYPES[type];
      if (x === undefined) {
        const a = Math.random() * TAU, r = edgeDist(a);
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
      }
      g.enemies.push({
        type: type, x: x, y: y, hp: ty.hp, size: ty.size,
        speed: ty.speed * g.speedMul * rand(0.85, 1.15),
        curl: curl !== undefined ? curl : rand(-0.5, 0.5),
        ph: Math.random() * TAU, spin: Math.random() * TAU, hitT: 0
      });
    }

    function burst(x, y, n, hot) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, v = rand(0.08, 0.32);
        g.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.7), max: 0.7, s: rand(0.004, 0.011), hot: hot });
      }
    }

    function kill(e, quiet) {
      const pts = Math.round(TYPES[e.type].score * mult());
      g.score += pts;
      burst(e.x, e.y, e.type === 'armor' ? 16 : 9, e.type === 'glitch');
      if (!quiet) g.floats.push({ x: e.x, y: e.y, s: '+' + pts, t: 0.8 });
      if (e.type === 'splitter') {
        spawn('mini', e.x + rand(-0.02, 0.02), e.y + rand(-0.02, 0.02), -0.9);
        spawn('mini', e.x + rand(-0.02, 0.02), e.y + rand(-0.02, 0.02), 0.9);
      }
    }

    function hurt(dmg, e) {
      g.hp = Math.max(0, g.hp - dmg);
      g.combo = 0;
      g.waveHurt = true;
      g.shake = 0.35;
      g.flash = 0.3;
      burst(e.x, e.y, 14, true);
      if (g.hp <= 0) gameOver();
    }

    function gameOver() {
      g.mode = 'over';
      g.overAt = performance.now();
      const run = { score: g.score, wave: g.wave, acc: g.shots ? g.hits / g.shots : 0, at: Date.now() };
      last = run;
      if (run.score > 0) runs.push(run);
      runs.sort((a, b) => b.score - a.score);
      runs = runs.slice(0, 5);
      g.newBest = runs[0] === run;
      api.store.set('intercept.runs', runs);
      api.store.set('intercept.last', last);
      api.say('Report', T('Intercept drill ended. Score {score}, wave {wave}, accuracy {acc}%.', { score: run.score, wave: run.wave, acc: Math.round(run.acc * 100) }));
      if (g.newBest) api.say('Report', T('New terminal record. Recommend continued training.'));
    }

    function fire(p) {
      const bx = (p.x - g.cx) / g.S, by = (p.y - g.cy) / g.S;
      g.shots++;
      const c = g.crate;
      if (c && Math.hypot(bx - c.x, by - c.y) < c.size) {
        g.crate = null;
        g.hits++;
        g.hp = Math.min(MAX_HP, g.hp + 1);
        g.rings.push({ r: CORE, max: reach() + 0.1 });
        g.beams.push({ x: c.x, y: c.y, t: 0.18 });
        banner(T('POD SUPPORT // PULSE'), 1.2);
        return;
      }
      let best = null, bd = Infinity;
      for (const e of g.enemies) {
        const d = Math.hypot(bx - e.x, by - e.y);
        if (d < e.size * 0.5 + 0.024 && d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) {
        g.combo = 0;
        g.floats.push({ x: bx, y: by, s: T('MISS'), t: 0.6, miss: true });
        return;
      }
      g.hits++;
      g.combo++;
      g.beams.push({ x: best.x, y: best.y, t: 0.15 });
      best.hp--;
      best.hitT = 0.15;
      if (best.hp <= 0) {
        g.enemies.splice(g.enemies.indexOf(best), 1);
        kill(best);
      } else {
        burst(best.x, best.y, 4, false);
      }
    }

    function update(dt) {
      g.t += dt;
      if (g.toSpawn > 0) {
        g.spawnT -= dt;
        if (g.spawnT <= 0) {
          spawn(pickType());
          g.toSpawn--;
          g.spawnT = g.gap * rand(0.6, 1.3);
        }
      } else if (!g.enemies.length) {
        if (g.waveT === 0) {
          const bonus = 50 * g.wave + (g.waveHurt ? 0 : 100);
          g.score += bonus;
          banner(g.waveHurt ? T('WAVE CLEARED  +{n}', { n: bonus }) : T('PERFECT WAVE  +{n}', { n: bonus }));
        }
        g.waveT += dt;
        if (g.waveT > 1.8) nextWave();
      }

      g.crateT -= dt;
      if (g.crateT <= 0 && !g.crate) {
        const dir = Math.random() < 0.5 ? 1 : -1, edge = 0.5 * g.W / g.S + 0.06;
        g.crate = { x: -dir * edge, y: rand(-0.32, 0.32), vx: dir * 0.09, size: 0.045, edge: edge };
        g.crateT = rand(24, 36);
      }
      if (g.crate) {
        g.crate.x += g.crate.vx * dt;
        if (Math.abs(g.crate.x) > g.crate.edge + 0.01) g.crate = null;
      }

      for (let i = g.enemies.length - 1; i >= 0; i--) {
        const e = g.enemies[i];
        const d = Math.hypot(e.x, e.y) || 1e-6;
        const ux = -e.x / d, uy = -e.y / d;
        let side = e.curl * Math.min(1, d / 0.45);
        if (e.type === 'glitch') side += Math.sin(g.t * 7 + e.ph) * 1.3;
        e.x += (ux - uy * side) * e.speed * dt;
        e.y += (uy + ux * side) * e.speed * dt;
        e.spin += dt * (e.type === 'armor' ? 0.6 : 1.8);
        e.hitT = Math.max(0, e.hitT - dt);
        if (d < CORE + e.size * 0.5) {
          g.enemies.splice(i, 1);
          hurt(TYPES[e.type].dmg, e);
          if (g.mode !== 'play') return;
        }
      }

      // Pulse rings sweep outward and clear whatever they touch.
      for (let i = g.rings.length - 1; i >= 0; i--) {
        const r = g.rings[i];
        r.r += dt * 1.4;
        for (let j = g.enemies.length - 1; j >= 0; j--) {
          const e = g.enemies[j];
          if (Math.hypot(e.x, e.y) < r.r) {
            g.enemies.splice(j, 1);
            kill(e, true);
          }
        }
        if (r.r > r.max) g.rings.splice(i, 1);
      }

      if (performance.now() - g.lastMove > 8000) g.mode = 'paused'; // the user walked away
    }

    function updateFx(dt) {
      for (let i = g.parts.length - 1; i >= 0; i--) {
        const p = g.parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.1, dt);
        p.vy *= Math.pow(0.1, dt);
        p.life -= dt;
        if (p.life <= 0) g.parts.splice(i, 1);
      }
      for (let i = g.beams.length - 1; i >= 0; i--) if ((g.beams[i].t -= dt) <= 0) g.beams.splice(i, 1);
      for (let i = g.floats.length - 1; i >= 0; i--) {
        const f = g.floats[i];
        f.t -= dt;
        f.y -= dt * 0.05;
        if (f.t <= 0) g.floats.splice(i, 1);
      }
      g.shake = Math.max(0, g.shake - dt);
      g.flash = Math.max(0, g.flash - dt);
      g.bannerT = Math.max(0, g.bannerT - dt);
    }

    function drawEnemy(e, ink, acc, paper, k) {
      const S = g.S, x = g.cx + e.x * S, y = g.cy + e.y * S, s = e.size * S;
      const lit = e.hitT > 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = 1.5 * k;
      if (e.type === 'glitch') {
        const j = Math.sin(g.t * 40 + e.ph) > 0.6 ? s * 0.25 : 0;
        ctx.fillStyle = 'rgb(' + acc + ')';
        ctx.fillRect(-s / 2 + j, -s / 2, s, s);
        ctx.fillStyle = 'rgba(' + acc + ',0.4)';
        ctx.fillRect(-s / 2 - j - s * 0.2, -s * 0.15, s * 1.4, s * 0.3);
      } else if (e.type === 'splitter') {
        ctx.rotate(Math.PI / 4 + e.spin * 0.3);
        ctx.strokeStyle = 'rgb(' + ink + ')';
        ctx.fillStyle = lit ? 'rgb(' + paper + ')' : 'rgba(' + ink + ',0.25)';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = 'rgb(' + ink + ')';
        ctx.fillRect(-s * 0.14, -s * 0.14, s * 0.28, s * 0.28);
      } else if (e.type === 'armor') {
        ctx.rotate(e.spin);
        ctx.strokeStyle = 'rgb(' + ink + ')';
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72);
        ctx.fillStyle = lit ? 'rgb(' + paper + ')' : 'rgb(' + ink + ')';
        const pip = s * 0.16;
        for (let i = 0; i < e.hp; i++) ctx.fillRect(-s * 0.26 + i * pip * 1.1, -pip / 2, pip * 0.8, pip);
      } else {
        ctx.rotate(e.spin);
        ctx.fillStyle = lit ? 'rgb(' + paper + ')' : 'rgb(' + ink + ')';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = 'rgb(' + ink + ')';
        ctx.strokeRect(-s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }

    function drawField(t, col, k) {
      const ink = col.ink, acc = col.accent, S = g.S, cx = g.cx, cy = g.cy;
      ctx.lineWidth = k;
      ctx.strokeStyle = 'rgba(' + ink + ',0.12)';
      ctx.setLineDash([4 * k, 8 * k]);
      for (const r of [0.2, 0.34, 0.48]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * S, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(g.W, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, g.H);
      ctx.stroke();

      // core
      const pulse = 1 + api.bass() * 0.08;
      const rc = CORE * S * pulse;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.5);
      ctx.strokeStyle = 'rgb(' + (g.flash > 0 ? acc : ink) + ')';
      ctx.lineWidth = 2 * k;
      ctx.strokeRect(-rc * 0.75, -rc * 0.75, rc * 1.5, rc * 1.5);
      ctx.rotate(-t * 1.2);
      ctx.lineWidth = k;
      ctx.strokeRect(-rc * 0.5, -rc * 0.5, rc, rc);
      ctx.fillStyle = 'rgb(' + (g.flash > 0 ? acc : ink) + ')';
      ctx.fillRect(-rc * 0.22, -rc * 0.22, rc * 0.44, rc * 0.44);
      ctx.restore();
      const seg = TAU / MAX_HP;
      ctx.lineWidth = 4 * k;
      for (let i = 0; i < MAX_HP; i++) {
        ctx.strokeStyle = i < g.hp ? 'rgb(' + (g.flash > 0 ? acc : ink) + ')' : 'rgba(' + ink + ',0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, rc * 1.45, -Math.PI / 2 + i * seg + 0.08, -Math.PI / 2 + (i + 1) * seg - 0.08);
        ctx.stroke();
      }

      if (g.mode === 'title') {
        for (let i = 0; i < 6; i++) {
          const a = t * 0.4 + i * TAU / 6, r = 0.3 + 0.03 * Math.sin(t + i);
          drawEnemy({ type: i % 3 === 1 ? 'splitter' : 'drone', x: Math.cos(a) * r, y: Math.sin(a) * r, size: 0.026, spin: t + i, hp: 1, hitT: 0, ph: i }, ink, acc, col.paper, k);
        }
      }

      for (const b of g.beams) {
        ctx.strokeStyle = 'rgba(' + ink + ',' + (b.t / 0.18).toFixed(3) + ')';
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + b.x * S, cy + b.y * S);
        ctx.stroke();
      }
      for (const r of g.rings) {
        ctx.strokeStyle = 'rgba(' + acc + ',' + clamp(1 - r.r / r.max, 0, 1).toFixed(3) + ')';
        ctx.lineWidth = 3 * k;
        ctx.beginPath();
        ctx.arc(cx, cy, r.r * S, 0, TAU);
        ctx.stroke();
      }
      for (const e of g.enemies) drawEnemy(e, ink, acc, col.paper, k);
      for (const p of g.parts) {
        ctx.fillStyle = 'rgba(' + (p.hot ? acc : ink) + ',' + (p.life / p.max).toFixed(3) + ')';
        const s = p.s * S;
        ctx.fillRect(cx + p.x * S - s / 2, cy + p.y * S - s / 2, s, s);
      }
      if (g.crate) {
        const c = g.crate, x = cx + c.x * S, y = cy + c.y * S, s = c.size * S * (1 + 0.08 * Math.sin(t * 6));
        ctx.strokeStyle = 'rgb(' + ink + ')';
        ctx.lineWidth = 2 * k;
        ctx.strokeRect(x - s / 2, y - s / 2, s, s);
        ctx.fillStyle = 'rgba(' + ink + ',0.15)';
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        ctx.fillStyle = 'rgb(' + ink + ')';
        ctx.fillRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.6);
        ctx.fillRect(x - s * 0.3, y - s * 0.06, s * 0.6, s * 0.12);
        text(ctx, api, T('POD SUPPORT'), x, y - s * 0.75, 10, { align: 'center' });
      }
      for (const f of g.floats) {
        text(ctx, api, f.s, cx + f.x * S, cy + f.y * S, f.miss ? 11 : 13, {
          align: 'center', base: 'middle', color: 'rgba(' + (f.miss ? acc : ink) + ',' + clamp(f.t / 0.5, 0, 1).toFixed(3) + ')'
        });
      }
    }

    function drawHud(col, k) {
      const m = 20 * k, ink2 = 'rgba(' + col.ink + ',0.62)';
      text(ctx, api, T('SCORE'), m, m + 10 * k, 10, { color: ink2 });
      text(ctx, api, pad(g.score, 6), m, m + 36 * k, 26, { spacing: 0.08 });
      text(ctx, api, T('WAVE {w}   //   CORE {hp} / {max}', { w: pad(g.wave), hp: g.hp, max: MAX_HP }), m, m + 56 * k, 11, { color: ink2 });
      const best = runs.length ? runs[0].score : 0;
      text(ctx, api, T('BEST {score}', { score: pad(Math.max(best, g.score), 6) }), g.W - m, m + 10 * k, 10, { align: 'right', color: ink2 });
      if (g.mode === 'play' && g.combo > 1) {
        text(ctx, api, T('COMBO {n}   X{m}', { n: g.combo, m: mult().toFixed(1) }), g.W - m, m + 34 * k, 16, { align: 'right' });
      }
      text(ctx, api, T('CLICK PACKETS BEFORE THEY REACH THE CORE  //  ORANGE PACKETS DEAL DOUBLE DAMAGE'), m, g.H - m, 10, { color: ink2 });
      if (g.bannerT > 0 && g.mode === 'play') {
        const a = clamp(g.bannerT / 0.4, 0, 1), y = g.cy - g.S * 0.3;
        ctx.fillStyle = 'rgba(' + col.ink + ',' + (0.85 * a).toFixed(3) + ')';
        ctx.fillRect(0, y - 20 * k, g.W, 40 * k);
        text(ctx, api, g.banner, g.cx, y + k, 18, { align: 'center', base: 'middle', spacing: 0.4, color: col.hl });
      }
    }

    function drawOverlay(t, col, k) {
      g.buttons = [];
      if (g.mode === 'play') return;
      const cx = g.cx, cy = g.cy, ink2 = 'rgba(' + col.ink + ',0.62)';
      backdrop(ctx, api, g.W, g.H, g.mode === 'title' ? 0.35 : 0.72);
      if (g.mode === 'title') {
        text(ctx, api, T('INTERCEPT'), cx, cy - g.S * 0.2, 40, { align: 'center', spacing: 0.4 });
        text(ctx, api, T('INTRUSION DRILL // DEFEND THE CORE'), cx, cy - g.S * 0.2 + 30 * k, 12, { align: 'center', color: ink2 });
        if (Math.sin(t * 4) > -0.3) text(ctx, api, T('CLICK TO BEGIN'), cx, cy + g.S * 0.22, 15, { align: 'center', spacing: 0.4 });
        const best = runs.length ? runs[0] : null;
        text(ctx, api, best ? T('TERMINAL RECORD {score}  //  WAVE {w}', { score: pad(best.score, 6), w: pad(best.wave) }) : T('NO RECORD'),
          cx, cy + g.S * 0.22 + 28 * k, 11, { align: 'center', color: ink2 });
      } else if (g.mode === 'paused') {
        text(ctx, api, T('PAUSED'), cx, cy - 10 * k, 34, { align: 'center', spacing: 0.4 });
        text(ctx, api, T('CLICK TO RESUME'), cx, cy + 24 * k, 13, { align: 'center', color: ink2, spacing: 0.3 });
      } else if (g.mode === 'over') {
        text(ctx, api, T('CORE COMPROMISED'), cx, cy - 70 * k, 32, { align: 'center', spacing: 0.3, color: 'rgb(' + col.accent + ')' });
        text(ctx, api, T('SCORE {score}   //   WAVE {w}   //   ACCURACY {acc}%', {
          score: pad(g.score, 6), w: pad(g.wave), acc: Math.round((g.shots ? g.hits / g.shots : 0) * 100)
        }), cx, cy - 30 * k, 14, { align: 'center' });
        if (g.newBest) text(ctx, api, T('NEW TERMINAL RECORD'), cx, cy - 6 * k, 12, { align: 'center', spacing: 0.4, color: ink2 });
        const bw = 150 * k, bh = 40 * k, gap = 16 * k;
        g.buttons = [
          { id: 'retry', label: T('RETRY'), x: cx - bw - gap / 2, y: cy + 24 * k, w: bw, h: bh },
          { id: 'title', label: T('BACK'), x: cx + gap / 2, y: cy + 24 * k, w: bw, h: bh }
        ];
        drawButtons(ctx, api, g.buttons, g.hot);
      }
    }

    function drawReticle(col, k) {
      if (g.mode !== 'play' || g.mx < 0) return;
      const r = 11 * k, x = g.mx, y = g.my;
      ctx.strokeStyle = 'rgb(' + col.ink + ')';
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      ctx.moveTo(x - r * 1.6, y);
      ctx.lineTo(x - r * 0.6, y);
      ctx.moveTo(x + r * 0.6, y);
      ctx.lineTo(x + r * 1.6, y);
      ctx.moveTo(x, y - r * 1.6);
      ctx.lineTo(x, y - r * 0.6);
      ctx.moveTo(x, y + r * 0.6);
      ctx.lineTo(x, y + r * 1.6);
      ctx.stroke();
      ctx.strokeRect(x - 2 * k, y - 2 * k, 4 * k, 4 * k);
    }

    canvas.addEventListener('pointermove', (e) => {
      if (!g.visible) return;
      const p = pointerPos(canvas, e);
      g.mx = p.x;
      g.my = p.y;
      g.lastMove = performance.now();
      const b = hitButton(g.buttons, p);
      g.hot = b ? b.id : '';
    });
    canvas.addEventListener('pointerleave', () => {
      g.mx = -1;
      if (g.mode === 'play') g.mode = 'paused';
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!g.visible || e.button > 0) return;
      const p = pointerPos(canvas, e);
      g.mx = p.x;
      g.my = p.y;
      g.lastMove = performance.now();
      if (g.mode === 'title') {
        start();
      } else if (g.mode === 'paused') {
        g.mode = 'play';
      } else if (g.mode === 'over') {
        if (performance.now() - g.overAt < 700) return;
        const b = hitButton(g.buttons, p);
        if (b && b.id === 'retry') start();
        else if (b && b.id === 'title') g.mode = 'title';
      } else {
        fire(p);
      }
    });

    return {
      show() { g.visible = true; },
      hide() {
        g.visible = false;
        if (g.mode === 'play') g.mode = 'paused';
      },
      busy() { return g.visible && g.mode === 'play'; },
      stats() { return { runs: runs, last: last }; },
      frame(dt, t) {
        if (!g.visible) return;
        api.fit(canvas);
        const k = api.dpr(), col = api.colors();
        g.W = canvas.width;
        g.H = canvas.height;
        g.S = Math.min(g.W, g.H);
        g.cx = g.W / 2;
        g.cy = g.H / 2;
        canvas.style.cursor = g.mode === 'play' ? 'none' : 'default';
        if (g.mode === 'play') update(dt);
        updateFx(dt);
        ctx.clearRect(0, 0, g.W, g.H);
        ctx.save();
        if (g.shake > 0) ctx.translate(rand(-1, 1) * g.shake * 14 * k, rand(-1, 1) * g.shake * 14 * k);
        drawField(t, col, k);
        ctx.restore();
        drawHud(col, k);
        drawOverlay(t, col, k);
        drawReticle(col, k);
      }
    };
  }

  // ======================================================================
  // LOGIC LOCK: rotate tiles until every terminal is connected to the source.
  // Boards are random spanning trees, so every lock has a solution.
  // ======================================================================

  function logicLock(canvas, api) {
    const ctx = canvas.getContext('2d');
    const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]; // dx, dy, bit, opposite bit (N E S W)
    const L = {
      visible: false,
      level: api.store.get('logic.level', 1),
      solved: api.store.get('logic.solved', 0),
      best: api.store.get('logic.best', {}),
      n: 5, shownLevel: 1, cells: [], rot: [], anim: null, powered: null, src: 0,
      started: 0, moves: 0, won: false, wonAt: 0, time: 0, newBest: false,
      hover: -1, buttons: [], hot: '', board: { x: 0, y: 0, cs: 1 }
    };
    const sizeFor = (lv) => Math.min(8, 4 + Math.ceil(lv / 2));
    const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
    const rotMask = (m, r) => {
      for (let i = 0; i < r; i++) m = ((m << 1) | (m >> 3)) & 15; // one clockwise quarter turn
      return m;
    };
    const maskAt = (i) => rotMask(L.cells[i], L.rot[i]);

    function computePower() {
      const n = L.n, p = new Uint8Array(n * n), stack = [L.src];
      p[L.src] = 1;
      let count = 1;
      while (stack.length) {
        const i = stack.pop(), m = maskAt(i), x = i % n, y = Math.floor(i / n);
        for (let d = 0; d < 4; d++) {
          if (!(m & DIRS[d][2])) continue;
          const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const ni = ny * n + nx;
          if (p[ni] || !(maskAt(ni) & DIRS[d][3])) continue;
          p[ni] = 1;
          count++;
          stack.push(ni);
        }
      }
      L.powered = p;
      return count === n * n;
    }

    // Randomized Prim's: grow a tree from the centre source, then scramble every tile.
    function generate() {
      const n = sizeFor(L.level), total = n * n;
      L.n = n;
      L.shownLevel = L.level;
      const cells = new Array(total).fill(0);
      const src = Math.floor(n / 2) * n + Math.floor(n / 2);
      const inTree = new Uint8Array(total);
      const frontier = [];
      const grow = (i) => {
        inTree[i] = 1;
        const x = i % n, y = Math.floor(i / n);
        for (let d = 0; d < 4; d++) {
          const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
          if (nx >= 0 && ny >= 0 && nx < n && ny < n && !inTree[ny * n + nx]) frontier.push([i, d]);
        }
      };
      grow(src);
      while (frontier.length) {
        const j = Math.floor(Math.random() * frontier.length);
        const edge = frontier[j];
        frontier[j] = frontier[frontier.length - 1];
        frontier.pop();
        const i = edge[0], d = edge[1];
        const ni = (Math.floor(i / n) + DIRS[d][1]) * n + (i % n) + DIRS[d][0];
        if (inTree[ni]) continue;
        cells[i] |= DIRS[d][2];
        cells[ni] |= DIRS[d][3];
        grow(ni);
      }
      L.cells = cells;
      L.src = src;
      do {
        L.rot = cells.map(() => Math.floor(Math.random() * 4));
      } while (computePower());
      L.anim = new Float32Array(total);
      L.started = 0;
      L.moves = 0;
      L.won = false;
      L.time = 0;
      L.newBest = false;
    }

    function win() {
      L.won = true;
      L.wonAt = performance.now();
      L.time = (L.wonAt - L.started) / 1000;
      const n = L.n;
      L.newBest = !L.best[n] || L.time < L.best[n];
      if (L.newBest) L.best[n] = Math.round(L.time * 10) / 10;
      L.solved++;
      L.level++;
      api.store.set('logic.best', L.best);
      api.store.set('logic.solved', L.solved);
      api.store.set('logic.level', L.level);
      api.say('Report', T('Logic lock released in {time} with {moves}.', { time: fmtTime(L.time), moves: TN(L.moves, '{n} rotation|{n} rotations') }) +
        (L.newBest ? ' ' + T('New best for {size} x {size}.', { size: n }) : ''));
    }

    function cellAt(p) {
      const b = L.board, n = L.n;
      const cx = Math.floor((p.x - b.x) / b.cs), cy = Math.floor((p.y - b.y) / b.cs);
      return cx >= 0 && cy >= 0 && cx < n && cy < n ? cy * n + cx : -1;
    }

    canvas.addEventListener('pointermove', (e) => {
      if (!L.visible) return;
      const p = pointerPos(canvas, e);
      L.hover = cellAt(p);
      const b = hitButton(L.buttons, p);
      L.hot = b ? b.id : '';
    });
    canvas.addEventListener('pointerleave', () => {
      L.hover = -1;
      L.hot = '';
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!L.visible || e.button > 0 || !L.cells.length) return;
      const p = pointerPos(canvas, e);
      if (hitButton(L.buttons, p)) {
        generate();
        return;
      }
      if (L.won) {
        if (performance.now() - L.wonAt > 600) generate();
        return;
      }
      const i = cellAt(p);
      if (i < 0) return;
      L.rot[i] = (L.rot[i] + 1) % 4;
      L.anim[i] = -90;
      L.moves++;
      if (!L.started) L.started = performance.now();
      if (computePower()) win();
    });

    function drawTile(i, x, y, cs, col, k, t) {
      const ink = col.ink, m = L.cells[i], on = L.powered[i];
      const half = cs / 2, lw = Math.max(2 * k, cs * 0.13);
      ctx.save();
      ctx.translate(x + half, y + half);
      ctx.rotate((L.rot[i] * 90 + L.anim[i]) * Math.PI / 180);
      const pipe = on ? 'rgb(' + ink + ')' : 'rgba(' + ink + ',0.28)';
      ctx.strokeStyle = pipe;
      ctx.lineWidth = lw;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      if (m & 1) { ctx.moveTo(0, 0); ctx.lineTo(0, -half); }
      if (m & 2) { ctx.moveTo(0, 0); ctx.lineTo(half, 0); }
      if (m & 4) { ctx.moveTo(0, 0); ctx.lineTo(0, half); }
      if (m & 8) { ctx.moveTo(0, 0); ctx.lineTo(-half, 0); }
      ctx.stroke();
      if (i === L.src) {
        const s = cs * 0.3 * (1 + 0.06 * Math.sin(t * 4));
        ctx.fillStyle = 'rgb(' + col.accent + ')';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = 'rgb(' + ink + ')';
        ctx.lineWidth = 1.5 * k;
        ctx.strokeRect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5);
      } else if (bits(m) === 1) {
        const s = cs * 0.34;
        ctx.fillStyle = on ? 'rgb(' + ink + ')' : 'rgb(' + col.paper + ')';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = on ? 'rgb(' + ink + ')' : 'rgba(' + ink + ',0.45)';
        ctx.lineWidth = 1.5 * k;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        if (on) {
          ctx.fillStyle = col.hl;
          ctx.fillRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36);
        }
      } else {
        ctx.fillStyle = pipe;
        ctx.fillRect(-lw / 2, -lw / 2, lw, lw);
      }
      ctx.restore();
    }

    return {
      show() {
        L.visible = true;
        if (!L.cells.length) generate();
      },
      hide() { L.visible = false; },
      busy() { return L.visible && !!L.started && !L.won; },
      stats() { return { best: L.best, solved: L.solved, level: L.level, size: sizeFor(L.level) }; },
      frame(dt, t) {
        if (!L.visible || !L.cells.length) return;
        api.fit(canvas);
        const k = api.dpr(), col = api.colors(), ink = col.ink, ink2 = 'rgba(' + ink + ',0.62)';
        const W = canvas.width, H = canvas.height, m = 20 * k;
        ctx.clearRect(0, 0, W, H);
        const top = 74 * k, bottom = 76 * k;
        const B = Math.max(40 * k, Math.min(W - 60 * k, H - top - bottom));
        const n = L.n, cs = B / n;
        const ox = (W - B) / 2, oy = top + (H - top - bottom - B) / 2;
        L.board = { x: ox, y: oy, cs: cs };
        const decay = Math.pow(1e-5, dt);
        for (let i = 0; i < L.anim.length; i++) {
          if (!L.anim[i]) continue;
          L.anim[i] *= decay;
          if (Math.abs(L.anim[i]) < 0.5) L.anim[i] = 0;
        }

        ctx.strokeStyle = 'rgba(' + ink + ',0.5)';
        ctx.lineWidth = k;
        ctx.strokeRect(ox - 8 * k, oy - 8 * k, B + 16 * k, B + 16 * k);
        let lit = 0;
        for (let i = 0; i < n * n; i++) {
          const x = ox + (i % n) * cs, y = oy + Math.floor(i / n) * cs;
          if (L.powered[i]) lit++;
          ctx.strokeStyle = 'rgba(' + ink + ',0.1)';
          ctx.strokeRect(x + 0.5 * k, y + 0.5 * k, cs - k, cs - k);
          if (i === L.hover && !L.won) {
            ctx.fillStyle = 'rgba(' + ink + ',0.08)';
            ctx.fillRect(x, y, cs, cs);
          }
          drawTile(i, x, y, cs, col, k, t);
        }

        const secs = L.won ? L.time : L.started ? (performance.now() - L.started) / 1000 : 0;
        text(ctx, api, T('LOGIC LOCK // LEVEL {n}', { n: pad(L.shownLevel) }), m, m + 14 * k, 16);
        text(ctx, api, T('{size} X {size} BOARD  //  POWERED {lit} / {total}', { size: n, lit: lit, total: n * n }), m, m + 36 * k, 11, { color: ink2 });
        text(ctx, api, T('TIME {t}', { t: fmtTime(secs) }), W - m, m + 14 * k, 16, { align: 'right' });
        const best = L.best[n];
        text(ctx, api, T('ROTATIONS {n}', { n: L.moves }) + (best ? '  //  ' + T('BEST {t}', { t: fmtTime(best) }) : ''), W - m, m + 36 * k, 11, { align: 'right', color: ink2 });
        text(ctx, api, T('CLICK A TILE TO ROTATE IT  //  CONNECT EVERY TERMINAL TO THE ORANGE SOURCE'), m, H - m, 10, { color: ink2 });

        const bw = 160 * k, bh = 36 * k;
        L.buttons = L.won ? [] : [{ id: 'new', label: T('NEW LOCK'), x: W - m - bw, y: H - m - bh + 8 * k, w: bw, h: bh }];
        drawButtons(ctx, api, L.buttons, L.hot);

        if (L.won) {
          const y = oy + B / 2;
          ctx.fillStyle = 'rgba(' + ink + ',0.9)';
          ctx.fillRect(0, y - 52 * k, W, 104 * k);
          text(ctx, api, T('LOCK RELEASED'), W / 2, y - 14 * k, 26, { align: 'center', spacing: 0.4, color: col.hl });
          text(ctx, api, fmtTime(L.time) + '  //  ' + TN(L.moves, '{n} ROTATION|{n} ROTATIONS') + (L.newBest ? '  //  ' + T('NEW BEST') : ''), W / 2, y + 14 * k, 13, { align: 'center', color: col.hl });
          if (Math.sin(t * 4) > -0.3) text(ctx, api, T('CLICK FOR THE NEXT LOCK'), W / 2, y + 38 * k, 11, { align: 'center', color: col.hl, spacing: 0.3 });
        }
      }
    };
  }

  // ======================================================================
  // GARDEN: click to plant Lunar Tears; the cursor stirs the wind.
  // ======================================================================

  // Moon phase from the mean synodic month, measured from a known new moon.
  function moon(date) {
    const syn = 29.530588853;
    let age = ((date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % syn;
    if (age < 0) age += syn;
    const phase = age / syn; // 0 new, 0.5 full
    // English keys (main.js compares against 'FULL MOON'); translate them for display.
    const names = [K('NEW MOON'), K('WAXING CRESCENT'), K('FIRST QUARTER'), K('WAXING GIBBOUS'),
      K('FULL MOON'), K('WANING GIBBOUS'), K('LAST QUARTER'), K('WANING CRESCENT')];
    return {
      phase: phase,
      illum: (1 - Math.cos(phase * TAU)) / 2,
      name: names[Math.floor(phase * 8 + 0.5) % 8],
      toFull: ((0.5 - phase + 1) % 1) * syn
    };
  }

  // Lit side on the right while waxing, left while waning; the terminator is a half-ellipse.
  function drawMoon(ctx, x, y, r, phase, col, k) {
    ctx.lineWidth = k;
    ctx.strokeStyle = 'rgba(' + col.ink + ',0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.25, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([3 * k, 6 * k]);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.45, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(' + col.ink + ',0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    const ex = r * Math.cos(phase * TAU);
    ctx.fillStyle = 'rgb(' + col.dust + ')';
    ctx.beginPath();
    if (phase <= 0.5) ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
    else ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5, false);
    if (phase <= 0.5) ctx.ellipse(x, y, Math.abs(ex), r, 0, Math.PI / 2, -Math.PI / 2, ex > 0);
    else ctx.ellipse(x, y, Math.abs(ex), r, 0, -Math.PI / 2, Math.PI / 2, ex > 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + col.ink + ',0.6)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }

  function garden(canvas, api) {
    const ctx = canvas.getContext('2d');
    const MAX = 36;
    const WINDS = ['cursor', 'calm', 'storm'];
    const hash = (n) => {
      const h = Math.sin(n * 91.345 + 12.9898) * 43758.5453;
      return h - Math.floor(h);
    };
    const savedWind = api.store.get('garden.wind', 'cursor');
    const gd = {
      visible: false, t: 0,
      flowers: [], petals: [], motes: [],
      wind: WINDS.includes(savedWind) ? savedWind : 'cursor',
      total: api.store.get('garden.total', 0),
      mx: -1, my: -1, vx: 0, lastMoveT: 0,
      W: 1, H: 1, ground: 1, base: 0,
      skyline: [], grass: []
    };

    function makeFlower(x, d, s, grown, born) {
      return {
        x: x, d: d, s: s, born: born,
        h: 0.75 + hash(s) * 0.5,
        petals: 5 + Math.floor(hash(s + 7) * 2),
        ph: hash(s + 3) * TAU,
        tilt: (hash(s + 11) - 0.5) * 0.3,
        grow: grown ? 1 : 0, bloom: grown ? 1 : 0,
        bend: 0, bv: 0, wither: 0
      };
    }
    api.store.get('garden.flowers', []).forEach((f, i) => {
      if (f && typeof f.x === 'number') gd.flowers.push(makeFlower(clamp(f.x, 0, 1), clamp(f.d || 0, 0, 1), f.s || i + 1, true, -1000 + i));
    });
    gd.flowers.sort((a, b) => a.d - b.d);

    // Ruined skyline and grass, seeded so the scene is the same every visit.
    (function buildScene() {
      let x = -0.02, i = 0;
      while (x < 1.02) {
        const w = 0.03 + hash(i * 3.1) * 0.07;
        gd.skyline.push({ x: x, w: w, h: 0.08 + hash(i * 5.7 + 1) * 0.22, jag: hash(i * 7.3 + 2), vine: hash(i * 2.9 + 4) });
        x += w + hash(i * 1.7 + 5) * 0.02;
        i++;
      }
      for (let j = 0; j < 160; j++) gd.grass.push({ x: hash(j * 4.1 + 9), d: hash(j * 6.3 + 2), h: 0.4 + hash(j * 8.7 + 3) * 0.6, ph: hash(j * 2.2) * TAU });
      gd.grass.sort((a, b) => a.d - b.d);
      for (let j = 0; j < 20; j++) gd.motes.push({ x: Math.random(), y: Math.random(), ph: Math.random() * TAU, s: rand(1.5, 3) });
    })();

    const alive = () => gd.flowers.filter((f) => !f.wither);
    const save = () => api.store.set('garden.flowers', alive().map((f) => ({ x: +f.x.toFixed(4), d: +f.d.toFixed(3), s: f.s })));
    const baseY = (f) => gd.ground + f.d * (gd.H * 0.97 - gd.ground);
    const scaleOf = (d) => 0.55 + 0.6 * d;

    function plant(x, d) {
      const live = alive();
      if (live.length >= MAX) live.reduce((a, b) => (a.born < b.born ? a : b)).wither = 0.001;
      const f = makeFlower(x, d, Math.floor(Math.random() * 1e6) + 1, false, gd.t);
      let at = gd.flowers.findIndex((o) => o.d > d);
      if (at < 0) at = gd.flowers.length;
      gd.flowers.splice(at, 0, f);
      gd.total++;
      api.store.set('garden.total', gd.total);
      save();
      if (gd.total === 1) api.say('Report', T('Lunar Tear planted. A rare flower; local legend says it grants wishes.'));
      else if ([10, 25, 50, 100, 250, 500, 1000].includes(gd.total)) api.say('Report', T('Lunar Tears planted: {n}. Statistically improbable.', { n: gd.total }));
    }

    function shed(f, n) {
      const sc = scaleOf(f.d), H = f.h * gd.H * 0.24 * sc;
      for (let i = 0; i < n; i++) {
        gd.petals.push({
          x: f.x * gd.W + f.bend * H * 0.6, y: baseY(f) - H,
          vx: rand(-20, 20), vy: rand(-10, 10), rot: Math.random() * TAU, vr: rand(-3, 3),
          life: 1, s: H * 0.12
        });
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!gd.visible || e.button > 0) return;
      const p = pointerPos(canvas, e);
      const d = p.y > gd.ground ? clamp((p.y - gd.ground) / (gd.H * 0.97 - gd.ground), 0, 1) : rand(0, 0.25);
      plant(clamp(p.x / gd.W, 0.01, 0.99), d);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!gd.visible) return;
      const p = pointerPos(canvas, e);
      const now = performance.now();
      if (gd.mx >= 0) {
        const v = (p.x - gd.mx) / gd.W / (Math.max(8, now - gd.lastMoveT) / 1000); // screen widths per second
        gd.vx = gd.vx * 0.6 + clamp(v, -6, 6) * 0.4;
      }
      gd.mx = p.x;
      gd.my = p.y;
      gd.lastMoveT = now;
    });
    canvas.addEventListener('pointerleave', () => { gd.mx = -1; });

    function baseWind(t) {
      if (gd.wind === 'calm') return 0.03 * Math.sin(t * 0.5);
      if (gd.wind === 'storm') return 0.75 + 0.25 * Math.sin(t * 1.3) + 0.12 * Math.sin(t * 3.1);
      return 0.12 * Math.sin(t * 0.37) + 0.06 * Math.sin(t * 1.1);
    }

    // Local gust from the cursor's sideways speed, strongest right under it.
    function gustAt(x, y) {
      if (gd.wind !== 'cursor' || gd.mx < 0) return 0;
      const dist = Math.hypot(x - gd.mx, (y - gd.my) * 0.6) / gd.W;
      return gd.vx * Math.max(0, 1 - dist / 0.16) * 0.35;
    }

    function update(dt) {
      gd.t += dt;
      const t = gd.t;
      gd.base = baseWind(t);
      gd.vx *= Math.pow(0.02, dt);
      for (let i = gd.flowers.length - 1; i >= 0; i--) {
        const f = gd.flowers[i];
        if (f.grow < 1) f.grow = Math.min(1, f.grow + dt / 2.2);
        else if (f.bloom < 1) f.bloom = Math.min(1, f.bloom + dt / 1.4);
        if (f.wither > 0) {
          if (f.wither < 0.01) shed(f, 3);
          f.wither += dt / 2.5;
          if (f.wither >= 1) {
            gd.flowers.splice(i, 1);
            continue;
          }
        }
        const H = f.h * gd.H * 0.24 * scaleOf(f.d);
        const target = gd.base + gustAt(f.x * gd.W, baseY(f) - H);
        f.bv += ((target - f.bend) * 28 - f.bv * 5) * dt;
        f.bend = clamp(f.bend + f.bv * dt, -1.3, 1.3);
        if (f.bloom > 0.9 && !f.wither && Math.random() < dt * (0.004 + Math.abs(f.bv) * 0.03 + (gd.wind === 'storm' ? 0.06 : 0))) shed(f, 1);
      }
      for (let i = gd.petals.length - 1; i >= 0; i--) {
        const p = gd.petals[i];
        const wx = (gd.base + gd.vx * 0.3) * gd.W * 0.25;
        p.vx += (wx - p.vx) * Math.min(1, dt * 1.5);
        p.vy += (18 * api.dpr() - p.vy) * Math.min(1, dt) + Math.sin(t * 3 + p.rot) * 6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt * 0.22;
        if (p.life <= 0 || p.y > gd.H + 20 || p.x < -40 || p.x > gd.W + 40) gd.petals.splice(i, 1);
      }
      for (const m of gd.motes) {
        m.y -= dt * 0.015;
        m.x += (Math.sin(t * 0.5 + m.ph) * 0.006 + gd.base * 0.01) * dt;
        if (m.y < 0.05) {
          m.y = 0.95;
          m.x = Math.random();
        }
      }
    }

    function leaf(x, y, len, ang, col, k) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const tx = x + c * len, ty = y + s * len;
      const nx = -s * len * 0.28, ny = c * len * 0.28;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + c * len * 0.5 + nx, y + s * len * 0.5 + ny, tx, ty);
      ctx.quadraticCurveTo(x + c * len * 0.5 - nx, y + s * len * 0.5 - ny, x, y);
      ctx.fill();
    }

    function drawFlower(f, col, k, t) {
      const sc = scaleOf(f.d), grow = easeOut(f.grow);
      const H = f.h * gd.H * 0.24 * sc * grow;
      if (H < 1) return;
      const bx = f.x * gd.W, by = baseY(f);
      const bend = f.bend + Math.sin(t * 1.6 + f.ph) * 0.035 + f.wither * 0.9;
      const tipX = bx + bend * H * 0.62 + f.tilt * H * 0.2;
      const tipY = by - H * (1 - 0.22 * Math.min(1, bend * bend)) + f.wither * H * 0.25;
      const cX = bx + bend * H * 0.12, cY = by - H * 0.55;
      ctx.globalAlpha = 1 - f.wither;
      const stemA = (0.55 + 0.4 * f.d).toFixed(2);
      ctx.strokeStyle = 'rgba(' + col.ink + ',' + stemA + ')';
      ctx.lineWidth = Math.max(1, 2.2 * k * sc);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(cX, cY, tipX, tipY);
      ctx.stroke();
      const lt = 0.35, u = 1 - lt;
      const lx = u * u * bx + 2 * u * lt * cX + lt * lt * tipX;
      const ly = u * u * by + 2 * u * lt * cY + lt * lt * tipY;
      ctx.fillStyle = 'rgba(' + col.ink + ',' + (0.45 + 0.35 * f.d).toFixed(2) + ')';
      leaf(lx, ly, H * 0.22, -0.7 + bend * 0.5, col, k);
      leaf(lx, ly - H * 0.08, H * 0.18, Math.PI + 0.7 + bend * 0.5, col, k);

      const bl = easeOut(f.bloom);
      const r = H * 0.2 * (0.25 + 0.75 * bl);
      const ang = Math.atan2(tipY - cY, tipX - cX) + Math.PI / 2;
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(ang);
      if (bl > 0.05) {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
        glow.addColorStop(0, 'rgba(' + col.dust + ',' + (0.35 + api.bass() * 0.35).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(' + col.dust + ',0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
      }
      ctx.fillStyle = 'rgb(' + col.dust + ')';
      ctx.strokeStyle = 'rgba(' + col.ink + ',0.8)';
      ctx.lineWidth = Math.max(1, k * sc);
      const n = f.petals, open = 0.15 + 0.85 * bl;
      for (let i = 0; i < n; i++) {
        // Closed bud: petals bunch upward; open: a star facing out.
        const a = -Math.PI / 2 + (i / n - 0.5 + 0.5 / n) * TAU * open;
        const len = r * (0.8 + 0.2 * bl), wd = 0.32;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a - wd) * len * 0.6, Math.sin(a - wd) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len);
        ctx.quadraticCurveTo(Math.cos(a + wd) * len * 0.6, Math.sin(a + wd) * len * 0.6, 0, 0);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgb(' + col.ink + ')';
      const c = Math.max(1.5 * k, r * 0.14);
      ctx.fillRect(-c / 2, -c / 2, c, c);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function draw(t) {
      const col = api.colors(), k = api.dpr(), W = gd.W, H = gd.H, G = gd.ground;
      const ink2 = 'rgba(' + col.ink + ',0.62)';
      ctx.clearRect(0, 0, W, H);

      const m = moon(new Date());
      drawMoon(ctx, W * 0.84, H * 0.2, Math.min(W, H) * 0.065, m.phase, col, k);

      // ruined skyline with hanging vines
      for (const b of gd.skyline) {
        const X = b.x * W, bw = b.w * W, bh = b.h * H * 0.9;
        ctx.fillStyle = 'rgba(' + col.ink + ',0.08)';
        ctx.beginPath();
        ctx.moveTo(X, G);
        ctx.lineTo(X, G - bh);
        ctx.lineTo(X + bw * 0.35, G - bh);
        ctx.lineTo(X + bw * 0.5, G - bh * (0.85 - 0.25 * b.jag));
        ctx.lineTo(X + bw * 0.7, G - bh * 0.92);
        ctx.lineTo(X + bw, G - bh * 0.92);
        ctx.lineTo(X + bw, G);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(' + col.paper + ',0.5)';
        for (let wy = G - bh * 0.8; wy < G - 10 * k; wy += H * 0.04) {
          for (let c = 0; c < 3; c++) ctx.fillRect(X + bw * (0.18 + c * 0.25), wy, bw * 0.1, H * 0.014);
        }
        if (b.vine > 0.5) {
          ctx.strokeStyle = 'rgba(' + col.ink + ',0.14)';
          ctx.lineWidth = k;
          ctx.beginPath();
          const vx = X + bw * b.vine * 0.8;
          ctx.moveTo(vx, G - bh * 0.9);
          ctx.quadraticCurveTo(vx + Math.sin(t * 0.7 + b.jag * 6) * 4 * k + gd.base * 6 * k, G - bh * 0.5, vx + 2 * k, G - bh * 0.3);
          ctx.stroke();
        }
      }

      // field with perspective rows
      ctx.strokeStyle = 'rgba(' + col.ink + ',0.45)';
      ctx.lineWidth = k;
      ctx.beginPath();
      ctx.moveTo(0, G);
      ctx.lineTo(W, G);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(' + col.ink + ',0.08)';
      for (let i = 1; i <= 6; i++) {
        const y = G + (H - G) * Math.pow(i / 6, 1.6);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      for (const gb of gd.grass) {
        const x = gb.x * W, y = G + gb.d * (H * 0.97 - G), h = gb.h * (8 + 14 * gb.d) * k;
        const bend = gd.base + gustAt(x, y - h) * 0.8 + Math.sin(t * 1.9 + gb.ph) * 0.08;
        ctx.strokeStyle = 'rgba(' + col.ink + ',' + (0.2 + 0.35 * gb.d).toFixed(2) + ')';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x, y - h * 0.6, x + bend * h * 0.7, y - h);
        ctx.stroke();
      }

      for (const f of gd.flowers) drawFlower(f, col, k, t);

      ctx.fillStyle = 'rgb(' + col.dust + ')';
      ctx.strokeStyle = 'rgba(' + col.ink + ',0.5)';
      ctx.lineWidth = k;
      for (const p of gd.petals) {
        ctx.save();
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.s, p.s * 0.4, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      for (const mo of gd.motes) {
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + mo.ph));
        ctx.fillStyle = 'rgba(' + col.dust + ',' + a.toFixed(3) + ')';
        ctx.fillRect(mo.x * W, mo.y * G, mo.s * k, mo.s * k);
      }

      const mg = 20 * k, live = alive().length;
      text(ctx, api, T('LUNAR TEAR FIELD'), mg, mg + 14 * k, 16);
      text(ctx, api, T('IN FIELD {live} / {max}  //  PLANTED {total}  //  {moon}  //  WIND {wind}', {
        live: live, max: MAX, total: gd.total, moon: T(m.name), wind: T(gd.wind.toUpperCase())
      }), mg, mg + 36 * k, 11, { color: ink2 });
      if (!live && Math.sin(t * 3) > -0.4) {
        text(ctx, api, T('CLICK THE GROUND TO PLANT A LUNAR TEAR'), W / 2, G + (H - G) * 0.5, 14, { align: 'center', spacing: 0.3 });
      }
    }

    return {
      show() {
        gd.visible = true;
        gd.mx = -1;
      },
      hide() { gd.visible = false; },
      busy() { return false; },
      stats() { return { alive: alive().length, total: gd.total }; },
      cycleWind() {
        gd.wind = WINDS[(WINDS.indexOf(gd.wind) + 1) % WINDS.length];
        api.store.set('garden.wind', gd.wind);
      },
      windLabel() { return gd.wind.toUpperCase(); },
      clear() {
        const live = alive();
        if (!live.length) return;
        for (const f of live) f.wither = 0.001;
        api.store.set('garden.flowers', []);
        api.say('Report', T('Field cleared. {flowers} returned to the soil.', { flowers: TN(live.length, '{n} Lunar Tear|{n} Lunar Tears') }));
      },
      frame(dt, t) {
        if (!gd.visible) return;
        api.fit(canvas);
        gd.W = canvas.width;
        gd.H = canvas.height;
        gd.ground = gd.H * 0.68;
        update(dt);
        draw(gd.t);
      }
    };
  }

  window.YoRHaGames = { intercept: intercept, logic: logicLock, garden: garden, moon: moon, drawMoon: drawMoon };
})();
