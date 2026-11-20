/* YoRHa Terminal -- BREACH: a 3D intrusion drill for the HACKING place.
   Built on three.js r149 (vendor/three.min.js, MIT licence in vendor/three.LICENSE.txt). Every shape is made
   in code; there are no assets.

   How it plays: the probe follows the cursor and fires on its own at the nearest target it can see. A click
   sends a pulse that clears shootable shots around it and pushes the others away. Accent shots can be shot
   down; ringed shots cannot and must be dodged. Nodes shield a core until they are destroyed; armored
   turrets are only open from behind. Destroy every core before the timer runs out. Three hits end the run.
   Each cleared breach offers a patch (an upgrade) that lasts for the rest of the run.

   Built to run on weak PCs:
   - three.js is only loaded the first time BREACH is opened.
   - No lights and no shadow maps: shading is baked into vertex colours once, so every material is the
     cheapest unlit kind. Soft blob shadows under floating things give the depth.
   - Everything that repeats (blocks, pillars, shots, debris) is one instanced draw call.
   - Shots, debris and score pop-ups come from fixed pools, so nothing is allocated per frame.
   - The render resolution drops by itself when frames run slow and climbs back when there is headroom.
     Weak machines (4 or fewer CPU threads, or 4 GB of memory or less) start lower, without anti-aliasing.
   - Menus redraw at 30 fps, nothing is drawn while the game is hidden, and the WebGL context with all of
     its GPU memory is released 30 seconds after the game is left (5 minutes when a run is paused).

   Factory: window.YoRHaGames3D.breach(canvas, api) -> { show, hide, frame(dt, t), busy, stats }.
   canvas becomes the HUD and takes the pointer; the WebGL canvas is created underneath it when needed.
   api is the object main.js gives games.js (store, dpr, fit, font, colors, bass, unit, say). */
(function () {
  'use strict';

  const BASE = ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');
  const THREE_SRC = BASE + 'vendor/three.min.js';
  let threeState = window.THREE ? 'ready' : 'idle';
  const threeWaiters = [];

  function loadThree(done) {
    // Another 3D game on the page may have loaded three.js already.
    if (window.YoRHaThreeLoader) return window.YoRHaThreeLoader(THREE_SRC, done);
    if (threeState === 'ready' || window.THREE) { threeState = 'ready'; return done(true); }
    if (threeState === 'failed') return done(false);
    threeWaiters.push(done);
    if (threeState === 'loading') return;
    threeState = 'loading';
    const s = document.createElement('script');
    s.src = THREE_SRC;
    const finish = (ok) => {
      threeState = ok && window.THREE ? 'ready' : 'failed';
      threeWaiters.splice(0).forEach((f) => f(threeState === 'ready'));
    };
    s.onload = () => finish(true);
    s.onerror = () => finish(false);
    document.head.appendChild(s);
  }

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const easeOut = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
  const easeBack = (p) => {
    p = clamp(p, 0, 1) - 1;
    return 1 + 2.70158 * p * p * p + 1.70158 * p * p;
  };
  const angDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : m)) : s);
  const T = (k, v) => (window.YoRHaI18N ? window.YoRHaI18N.t(k, v) : fill(k, v));
  const TN = (n, k, v) => (window.YoRHaI18N ? window.YoRHaI18N.n(n, k, v) :
    fill(k.split('|')[n === 1 ? 0 : 1], Object.assign({ n: n }, v || {})));
  const K = (k) => k;

  const KINDS = {
    sweep: { name: K('SWEEP'), time: 30, hint: K('DESTROY EVERY CORE  //  ACCENT SHOTS CAN BE SHOT DOWN, RINGED SHOTS CANNOT') },
    fortress: { name: K('FORTRESS'), time: 45, hint: K('NODES SHIELD THE CORE  //  ARMORED TURRETS ARE OPEN FROM BEHIND') },
    corridor: { name: K('CORRIDOR'), time: 45, hint: K('SHOOT A PATH THROUGH THE WALLS  //  THE CORE WAITS AT THE END') }
  };
  const ORDER = ['sweep', 'sweep', 'fortress', 'corridor', 'sweep', 'fortress', 'corridor'];
  const PATCHES = [
    { id: 'rate', name: K('OVERCLOCK'), desc: K('Fire rate +30%.'), max: 3 },
    { id: 'split', name: K('SPLIT FIRE'), desc: K('One more shot in every volley.'), max: 2 },
    { id: 'damage', name: K('HEAVY ROUNDS'), desc: K('Shots deal 50% more damage.'), max: 2 },
    { id: 'pierce', name: K('PIERCING ROUNDS'), desc: K('Shots fly on through the shots they destroy.'), max: 1 },
    { id: 'pulse', name: K('PULSE AMPLIFIER'), desc: K('The pulse recharges faster and reaches further.'), max: 2 },
    { id: 'barrier', name: K('BARRIER'), desc: K('Absorbs the first hit in every breach.'), max: 1 },
    { id: 'time', name: K('TIME DILATION'), desc: K('Eight more seconds on every timer.'), max: 2 },
    { id: 'speed', name: K('THRUSTERS'), desc: K('The probe moves 15% faster.'), max: 2 }
  ];
  const CONTROLS = K('MOVE WITH THE CURSOR  //  FIRING IS AUTOMATIC  //  CLICK FOR A PULSE');

  const SHIP_R = 0.28;
  const SHOT_SPEED = 30;
  const SHOT_LIFE = 0.55;
  const FLY = 0.5; // height of the probe and of every shot
  const RANGE = 14; // auto-aim reach
  const SHIELD_HALF = Math.PI * 0.42; // armored turret shield arc, each side of its facing
  // Baked light direction (from upper left, towards the camera side); top faces come out at 1.0.
  const LX = -0.42, LY = 0.82, LZ = 0.39;
  const SHAPES = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 1], [2, 0]]
  ];

  function breach(canvas, api) {
    // api.quality ('low' or 'high') overrides the hardware guess.
    const LOW = api.quality ? api.quality === 'low' : (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
    const PIX_CAP = LOW ? 1600 * 900 : 2560 * 1440;
    const MAX_EB = LOW ? 420 : 560;
    const MAX_SHOTS = 160;
    const MAX_SHARDS = LOW ? 220 : 380;
    const MAX_BLOCKS = 420;
    const MAX_COVERS = 260;
    const MAX_BLOBS = 48;
    const MAX_FLOATS = 24;

    const hx = canvas.getContext('2d');
    canvas.style.position = 'relative';
    canvas.style.zIndex = '1';

    const g = {
      visible: false, ready: false, loading: false, failed: false, lost: false,
      mode: 'title', prev: 'play', modeT: 0, t: 0, acc: 0,
      stage: 0, score: 0, left: 0, timeMax: 1, hits: 0, fired: 0, hitStage: false, runT: 0, clearBonus: 0,
      stopT: 0, slowT: 0, shake: 0, dive: 0, flash: 0, hurt: 0,
      banner: null, hint: null, retarget: 0, camZ: 0, rw: 0, rh: 0,
      hasMouse: false, px: 0, py: 0, hot: '', buttons: [], cards: [],
      reason: '', newBest: false, overAt: 0, seenHint: {}, hideAt: 0, god: false
    };
    const Q = { scale: LOW ? 0.8 : 1, max: LOW ? 0.9 : 1, base: 0, warm: [], acc: 0, n: 0, good: 0 };
    const up = {};
    const resetUp = () => PATCHES.forEach((p) => { up[p.id] = 0; });
    resetUp();

    let runs = api.store.get('breach.runs', []);
    let last = api.store.get('breach.last', null);
    if (!Array.isArray(runs)) runs = [];

    const P = {
      x: 0, z: 0, vx: 0, vz: 0, aim: -Math.PI / 2, tx: 0, tz: 0, hp: 3, inv: 0, barrier: 0, cool: 0,
      pulse: 0, pulseMax: 7, target: null, targetGen: 0, kick: 0, dead: false, rise: 0.15
    };
    const S = {
      kind: 'sweep', lane: false, attract: false, R: 9.5, rad: 8, half: 4.5, zMin: 0, zMax: 0,
      spawnX: 0, spawnZ: 0, introT: 9, introLen: 1.2, platform: null,
      solids: [], turrets: [], nodes: [], cores: [], grid: new Map()
    };

    let THREE = null, renderer = null, glc = null, scene = null, camera = null, world = null;
    let M = null, G = null, I = null, ship = null, marker = null, barrierMesh = null, dust = null, rings = null;
    let pal = null, tmpC = null, ndc = null, pv = null, dummy = null;
    let EB = null, SH = null, SD = null, FL = null;
    let ebN = 0, shN = 0, sdN = 0, flN = 0, gen = 0;
    let releaseTimer = 0;
    const CP = { x: 0, z: 0 };
    const NB = new Array(9);
    let nbN = 0;
    const CE = new Array(48), CS = new Float32Array(48);
    let cN = 0;

    // ---------- small helpers ----------

    function pool(n, make) {
      const a = new Array(n);
      for (let i = 0; i < n; i++) a[i] = make();
      return a;
    }

    function rgb(s, c) {
      const p = String(s).split(',');
      return c.setRGB((Number(p[0]) || 0) / 255, (Number(p[1]) || 0) / 255, (Number(p[2]) || 0) / 255);
    }

    // Matrix writers for instanced meshes: translation + uniform scale, or + yaw towards (dx, dz).
    function setTS(a, i, x, y, z, s) {
      const o = i * 16;
      a[o] = s; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
      a[o + 4] = 0; a[o + 5] = s; a[o + 6] = 0; a[o + 7] = 0;
      a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = s; a[o + 11] = 0;
      a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    }
    function setYaw(a, i, x, y, z, dx, dz, s) {
      const o = i * 16;
      a[o] = dz * s; a[o + 1] = 0; a[o + 2] = -dx * s; a[o + 3] = 0;
      a[o + 4] = 0; a[o + 5] = s; a[o + 6] = 0; a[o + 7] = 0;
      a[o + 8] = dx * s; a[o + 9] = 0; a[o + 10] = dz * s; a[o + 11] = 0;
      a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    }
    // Rotation.y that points a model's nose (-z) along the angle a (direction (cos a, sin a) on x/z).
    const yawFor = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));

    // Flat shading baked into vertex colours from a fixed light, so materials need no lights at all.
    function bake(geo, lift) {
      const g2 = geo.index ? geo.toNonIndexed() : geo;
      if (g2 !== geo) geo.dispose();
      const p = g2.attributes.position.array, n = p.length / 3, col = new Float32Array(n * 3);
      for (let v = 0; v + 2 < n; v += 3) {
        const o = v * 3;
        const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2];
        const wx = p[o + 6] - p[o], wy = p[o + 7] - p[o + 1], wz = p[o + 8] - p[o + 2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        const d = Math.max(0, nx * LX + ny * LY + nz * LZ);
        const s = Math.min(1.05, 0.55 + 0.45 * d / LY + (lift || 0));
        for (let k = 0; k < 9; k++) col[o + k] = s;
      }
      g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (g2.attributes.normal) g2.deleteAttribute('normal');
      if (g2.attributes.uv) g2.deleteAttribute('uv');
      return g2;
    }

    function disposeObj(o) {
      o.traverse((m) => {
        if (m.userData.own && m.geometry) m.geometry.dispose();
        if (m.userData.ownMat && m.material) m.material.dispose();
      });
    }

    // ---------- 3D setup and teardown ----------

    function init() {
      if (g.loading || g.ready || g.failed) return;
      g.loading = true;
      loadThree((ok) => {
        g.loading = false;
        if (!ok) { g.failed = true; return; }
        THREE = window.THREE;
        try {
          build3D();
          g.ready = true;
          toTitle();
        } catch (e) {
          g.failed = true;
          release();
          if (window.console) console.warn('[BREACH] 3D view unavailable:', e);
        }
      });
    }

    function build3D() {
      glc = document.createElement('canvas');
      glc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:block;';
      (canvas.parentNode || document.body).insertBefore(glc, canvas);
      renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: !LOW, alpha: true, stencil: false, powerPreference: 'default' });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); g.lost = true; });
      glc.addEventListener('webglcontextrestored', () => { g.lost = false; });
      g.rw = g.rh = 0;

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xffffff, 30, 82);
      camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 160);
      world = new THREE.Group();
      scene.add(world);
      tmpC = new THREE.Color();
      ndc = new THREE.Vector2();
      pv = new THREE.Vector3();
      dummy = new THREE.Object3D();
      pal = {
        key: '', ink: new THREE.Color(), paper: new THREE.Color(), accent: new THREE.Color(), dust: new THREE.Color(),
        cover: new THREE.Color(), hard: new THREE.Color(), hardRing: new THREE.Color(),
        white: new THREE.Color(1, 1, 1), black: new THREE.Color(0, 0, 0), dark: false
      };

      makeMaterials();
      makeGeometries();
      makeInstances();
      makeActors();
      makeDecor();

      EB = pool(MAX_EB, () => ({ x: 0, z: 0, vx: 0, vz: 0, hard: false, t: 0, ghost: 0, gen: 0, alive: false }));
      SH = pool(MAX_SHOTS, () => ({ x: 0, z: 0, vx: 0, vz: 0, life: 0, dmg: 1 }));
      SD = pool(MAX_SHARDS, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, wr: 0, life: 0, s: 1, c: null }));
      FL = pool(MAX_FLOATS, () => ({ x: 0, y: 0, z: 0, text: '', t: 0, dur: 1 }));
      ebN = shN = sdN = flN = 0;
      applyPalette(true);
    }

    function release() {
      clearTimeout(releaseTimer);
      if (scene) {
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        });
      }
      if (G) for (const k in G) G[k].dispose();
      if (M) for (const k in M) { if (M[k].map) M[k].map.dispose(); M[k].dispose(); }
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      if (glc && glc.parentNode) glc.parentNode.removeChild(glc);
      renderer = scene = camera = world = glc = null;
      M = G = I = ship = marker = barrierMesh = dust = rings = null;
      EB = SH = SD = FL = null;
      ebN = shN = sdN = flN = 0;
      S.solids = []; S.turrets = []; S.nodes = []; S.cores = []; S.grid = new Map(); S.platform = null;
      P.target = null;
      g.ready = false;
      g.lost = false;
      g.rw = g.rh = 0;
      g.mode = 'title';
      g.banner = g.hint = null;
    }

    function makeMaterials() {
      const B = (o) => new THREE.MeshBasicMaterial(o || {});
      M = {
        floor: B({ vertexColors: true }),
        block: B({ vertexColors: true }),
        cover: B({ vertexColors: true }),
        coverDS: B({ vertexColors: true, side: THREE.DoubleSide }),
        ink: B({ vertexColors: true }),
        shield: B({ vertexColors: true, transparent: true, opacity: 0.9 }),
        ship: B({ vertexColors: true }),
        shipEdge: B({ side: THREE.BackSide }),
        accent: B(),
        shot: B(),
        soft: B(),
        softHalo: B({ transparent: true, opacity: 0.32, depthWrite: false }),
        hard: B(),
        hardRing: B({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
        shard: B({ vertexColors: true }),
        ring: B({ transparent: true, opacity: 0.85, depthWrite: false }),
        marker: B({ transparent: true, opacity: 0.5, depthWrite: false }),
        blob: B({ transparent: true, opacity: 0.22, depthWrite: false, map: blobTexture() }),
        frag: B({ vertexColors: true }),
        grid: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.2, depthWrite: false }),
        tether: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false }),
        dust: new THREE.PointsMaterial({ size: 0.08, transparent: true, opacity: 0.32, depthWrite: false })
      };
    }

    function blobTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    }

    function shellGeometry(r) {
      const src = new THREE.IcosahedronGeometry(r, 1);
      const p = src.attributes.position.array, out = new Float32Array(p.length);
      for (let i = 0; i + 8 < p.length; i += 9) {
        const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
        for (let k = 0; k < 9; k += 3) {
          out[i + k] = cx + (p[i + k] - cx) * 0.8;
          out[i + k + 1] = cy + (p[i + k + 1] - cy) * 0.8;
          out[i + k + 2] = cz + (p[i + k + 2] - cz) * 0.8;
        }
      }
      src.dispose();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
      return geo;
    }

    function shipGeometry() {
      const s = new THREE.Shape();
      s.moveTo(0, 0.56);
      s.lineTo(0.4, -0.38);
      s.lineTo(0, -0.17);
      s.lineTo(-0.4, -0.38);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -0.06, 0);
      return geo;
    }

    function flat(geo) {
      geo.rotateX(-Math.PI / 2);
      return geo;
    }

    function makeGeometries() {
      G = {
        block: bake(new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(0, 0.45, 0)),
        cover: bake(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 6).translate(0, 0.6, 0), 0.02),
        turBase: bake(new THREE.CylinderGeometry(0.5, 0.62, 0.32, 6).translate(0, 0.16, 0)),
        turHead: bake(new THREE.OctahedronGeometry(0.42, 0)),
        turShield: bake(new THREE.CylinderGeometry(0.86, 0.86, 1.0, 12, 1, true, -SHIELD_HALF, SHIELD_HALF * 2)),
        nodeBase: bake(new THREE.CylinderGeometry(0.3, 0.4, 0.2, 6).translate(0, 0.1, 0)),
        nodeHead: bake(new THREE.OctahedronGeometry(0.34, 0).scale(1, 1.7, 1)),
        core: bake(new THREE.IcosahedronGeometry(0.78, 0)),
        coreRing: new THREE.TorusGeometry(1.05, 0.035, 4, 40),
        shield: bake(shellGeometry(1.4)),
        ship: bake(shipGeometry(), 0.05),
        engine: new THREE.SphereGeometry(0.09, 6, 4),
        shot: new THREE.BoxGeometry(0.08, 0.08, 0.55),
        ball: new THREE.SphereGeometry(0.2, 8, 6),
        halo: flat(new THREE.CircleGeometry(0.4, 16)),
        ring: flat(new THREE.RingGeometry(0.29, 0.37, 20)),
        shard: bake(new THREE.BoxGeometry(0.16, 0.16, 0.16)),
        fxRing: flat(new THREE.RingGeometry(0.92, 1, 40)),
        blob: flat(new THREE.PlaneGeometry(1, 1)),
        marker: flat(new THREE.RingGeometry(0.22, 0.28, 20)),
        barrier: flat(new THREE.RingGeometry(0.58, 0.63, 32))
      };
    }

    function makeInstances() {
      const inst = (geo, mat, n, colors) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.count = 0;
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (colors) {
          m.setColorAt(0, pal.white);
          m.instanceColor.setUsage(THREE.DynamicDrawUsage);
        }
        scene.add(m);
        return m;
      };
      I = {
        blocks: inst(G.block, M.block, MAX_BLOCKS, true),
        covers: inst(G.cover, M.cover, MAX_COVERS),
        shots: inst(G.shot, M.shot, MAX_SHOTS),
        soft: inst(G.ball, M.soft, MAX_EB),
        halo: LOW ? null : inst(G.halo, M.softHalo, MAX_EB),
        hard: inst(G.ball, M.hard, MAX_EB),
        ring: inst(G.ring, M.hardRing, MAX_EB),
        shards: inst(G.shard, M.shard, MAX_SHARDS, true),
        blobs: inst(G.blob, M.blob, MAX_BLOBS),
        frags: inst(G.block, M.frag, 26)
      };
    }

    function makeActors() {
      ship = new THREE.Group();
      const edge = new THREE.Mesh(G.ship, M.shipEdge);
      edge.scale.set(1.2, 1.6, 1.2);
      const body = new THREE.Mesh(G.ship, M.ship);
      const eng = new THREE.Mesh(G.engine, M.accent);
      eng.position.set(0, 0.02, 0.25);
      ship.add(edge, body, eng);
      ship.userData.eng = eng;
      ship.rotation.order = 'YXZ';
      scene.add(ship);
      marker = new THREE.Mesh(G.marker, M.marker);
      scene.add(marker);
      barrierMesh = new THREE.Mesh(G.barrier, M.ring);
      scene.add(barrierMesh);
      rings = [];
      for (let i = 0; i < 20; i++) {
        const m = new THREE.Mesh(G.fxRing, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        m.visible = false;
        m.fx = { t: 0, dur: 1, r0: 0, r1: 1, a: 1 };
        scene.add(m);
        rings.push(m);
      }
    }

    function makeDecor() {
      const n = LOW ? 110 : 200, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = rand(-34, 34);
        pos[i * 3 + 1] = rand(-14, 9);
        pos[i * 3 + 2] = rand(-36, 30);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      dust = new THREE.Points(geo, M.dust);
      dust.frustumCulled = false;
      scene.add(dust);
      // Fragments drifting far below the platform, for depth.
      const a = I.frags.instanceMatrix.array;
      I.frags.userData.list = [];
      for (let i = 0; i < 26; i++) {
        const f = { x: rand(-26, 26), y: rand(-34, -16), z: rand(-34, 22), s: rand(0.35, 1.1), r: rand(0, TAU), w: rand(-0.3, 0.3) };
        I.frags.userData.list.push(f);
        setTS(a, i, f.x, f.y, f.z, f.s);
      }
      I.frags.count = 26;
    }

    function applyPalette(force) {
      const col = api.colors();
      const key = col.ink + '|' + col.paper + '|' + col.accent + '|' + (col.dust || '');
      if (!force && key === pal.key) return;
      pal.key = key;
      rgb(col.ink, pal.ink);
      rgb(col.paper, pal.paper);
      rgb(col.accent, pal.accent);
      rgb(col.dust || col.paper, pal.dust);
      pal.dark = 0.299 * pal.paper.r + 0.587 * pal.paper.g + 0.114 * pal.paper.b < 0.45;
      pal.cover.copy(pal.paper).lerp(pal.dark ? pal.ink : pal.white, pal.dark ? 0.3 : 0.62);
      pal.hard.set(pal.dark ? 0xb596ea : 0x3a2257);
      pal.hardRing.set(pal.dark ? 0x8d66d2 : 0x7c55b6);
      M.floor.color.copy(pal.paper);
      M.cover.color.copy(pal.cover);
      M.coverDS.color.copy(pal.cover);
      M.ink.color.copy(pal.ink);
      M.shield.color.copy(pal.cover);
      M.ship.color.copy(pal.dark ? pal.ink : pal.dust);
      M.shipEdge.color.copy(pal.dark ? pal.paper : pal.ink);
      M.accent.color.copy(pal.accent);
      M.shot.color.copy(pal.ink);
      M.soft.color.copy(pal.accent);
      M.softHalo.color.copy(pal.accent);
      M.hard.color.copy(pal.hard);
      M.hardRing.color.copy(pal.hardRing);
      M.ring.color.copy(pal.accent);
      M.marker.color.copy(pal.ink);
      M.blob.color.copy(pal.dark ? pal.black : pal.ink);
      M.blob.opacity = pal.dark ? 0.5 : 0.24;
      M.frag.color.copy(pal.paper).lerp(pal.ink, 0.22);
      M.grid.color.copy(pal.ink);
      M.tether.color.copy(pal.accent);
      M.dust.color.copy(pal.ink);
      scene.fog.color.copy(pal.paper);
    }

    // ---------- stage geometry ----------

    function hexCorner(r, i) {
      const a = i * TAU / 6 + Math.PI / 6;
      return [Math.cos(a) * r, -Math.sin(a) * r];
    }

    function setArena(R) {
      S.lane = false;
      S.R = R;
      S.rad = R * 0.866 - 0.45;
      const shape = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + Math.PI / 6;
        if (i) shape.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        else shape.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -0.8, 0);
      const plat = new THREE.Mesh(bake(geo), M.floor);
      plat.userData.own = true;
      const pts = [];
      const seg = (p, q) => pts.push(p[0], 0, p[1], q[0], 0, q[1]);
      for (let k = 1; k <= 4; k++) for (let i = 0; i < 6; i++) seg(hexCorner(R * k / 4.6, i), hexCorner(R * k / 4.6, i + 1));
      for (let i = 0; i < 6; i++) seg(hexCorner(R * 0.12, i), hexCorner(R - 0.3, i));
      for (let i = 0; i < 6; i++) seg(hexCorner(R - 0.3, i), hexCorner(R - 0.3, i + 1));
      addPlatform(plat, pts);
      S.spawnX = 0;
      S.spawnZ = S.rad - 1.2;
    }

    function setLane(L) {
      S.lane = true;
      S.half = 4.5;
      S.zMax = 2.5;
      S.zMin = -L - 7;
      const z0 = S.zMin - 2, z1 = S.zMax + 2, w = S.half + 0.7;
      const geo = new THREE.BoxGeometry(w * 2, 0.8, z1 - z0).translate(0, -0.4, (z0 + z1) / 2);
      const plat = new THREE.Mesh(bake(geo), M.floor);
      plat.userData.own = true;
      const pts = [];
      for (let x = -S.half; x <= S.half + 0.01; x += 1) pts.push(x, 0, z1, x, 0, z0);
      for (let z = Math.ceil(z0); z <= z1; z += 3) pts.push(-S.half, 0, z, S.half, 0, z);
      pts.push(-w + 0.15, 0, z1, -w + 0.15, 0, z0, w - 0.15, 0, z1, w - 0.15, 0, z0);
      addPlatform(plat, pts);
      S.spawnX = 0;
      S.spawnZ = 1;
    }

    function addPlatform(plat, pts) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(lg, M.grid);
      lines.userData.own = true;
      lines.position.y = 0.015;
      S.platform = new THREE.Group();
      S.platform.add(plat, lines);
      world.add(S.platform);
    }

    function inBounds(x, z, m) {
      if (S.lane) return Math.abs(x) <= S.half - m + 0.5 && z <= S.zMax - m && z >= S.zMin + m;
      return x * x + z * z <= (S.rad - m) * (S.rad - m);
    }

    function inArea(x, z, m) {
      if (S.lane) return Math.abs(x) < S.half + 0.7 + m && z < S.zMax + 2 + m && z > S.zMin - 2 - m;
      const r = S.R * 0.95 + m;
      return x * x + z * z < r * r;
    }

    function onPlatform(x, z) {
      if (S.lane) return Math.abs(x) < S.half + 0.7 && z < S.zMax + 2 && z > S.zMin - 2;
      const r = S.R * 0.86;
      return x * x + z * z < r * r;
    }

    function clampPoint(x, z, m) {
      if (S.lane) {
        CP.x = clamp(x, -S.half + m, S.half - m);
        CP.z = clamp(z, S.zMin + m, S.zMax - m);
      } else {
        const lim = S.rad - m, d = Math.hypot(x, z);
        if (d > lim) { x *= lim / d; z *= lim / d; }
        CP.x = x;
        CP.z = z;
      }
      return CP;
    }

    // Solids live in a coarse grid (cell = 1 unit) so shots and bullets only test their neighbours.
    const cellKey = (ix, iz) => (ix + 2048) * 8192 + (iz + 2048);
    function gridAdd(o) {
      const k = cellKey(Math.floor(o.x + 0.5), Math.floor(o.z + 0.5));
      let a = S.grid.get(k);
      if (!a) S.grid.set(k, a = []);
      a.push(o);
    }
    function gather(x, z) {
      nbN = 0;
      const ix = Math.floor(x + 0.5), iz = Math.floor(z + 0.5);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const a = S.grid.get(cellKey(ix + i, iz + j));
          if (a) NB[nbN++] = a;
        }
      }
    }
    // First live solid touching a point: blocks by box half-size hb, pillars by radius rc.
    function solidAt(x, z, hb, rc) {
      gather(x, z);
      const rc2 = rc * rc;
      for (let c = 0; c < nbN; c++) {
        const a = NB[c];
        for (let n = 0; n < a.length; n++) {
          const o = a[n];
          if (o.dead) continue;
          if (o.kind === 'block') {
            if (Math.abs(o.x - x) < hb && Math.abs(o.z - z) < hb) return o;
          } else {
            const dx = o.x - x, dz = o.z - z;
            if (dx * dx + dz * dz < rc2) return o;
          }
        }
      }
      return null;
    }

    function addSolid(kind, x, z) {
      const o = { kind: kind, x: x, z: z, hp: 2, max: 2, dead: false, flash: 0, kick: 0, rise: 0, crumble: -1 };
      S.solids.push(o);
      gridAdd(o);
      return o;
    }

    function freeSpot(x, z, r) {
      if (!inBounds(x, z, 0.6)) return false;
      for (const o of S.solids) if (Math.hypot(o.x - x, o.z - z) < r) return false;
      for (const e of S.turrets) if (Math.hypot(e.x - x, e.z - z) < r + 0.5) return false;
      for (const e of S.nodes) if (Math.hypot(e.x - x, e.z - z) < r + 0.4) return false;
      for (const c of S.cores) if (Math.hypot(c.x - x, c.z - z) < r + 1.6) return false;
      return Math.hypot(S.spawnX - x, S.spawnZ - z) >= 2.3;
    }

    function ownMat(base) {
      const m = base.clone();
      return m;
    }

    function addTurret(x, z, armored) {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(G.turBase, M.ink);
      const mat = ownMat(M.ink);
      const head = new THREE.Mesh(G.turHead, mat);
      head.userData.ownMat = true;
      head.position.y = 0.95;
      grp.add(base, head);
      let shield = null;
      if (armored) {
        shield = new THREE.Mesh(G.turShield, M.coverDS);
        shield.position.y = 0.62;
        grp.add(shield);
      }
      grp.position.set(x, 0, z);
      world.add(grp);
      const hp = 7 + g.stage;
      const e = {
        kind: 'turret', x: x, z: z, hp: hp, max: hp, armored: !!armored, face: Math.atan2(S.spawnZ - z, S.spawnX - x),
        grp: grp, head: head, mat: mat, shield: shield, fire: rand(0.8, 1.8), burst: 0, burstT: 0,
        flash: 0, kick: 0, rise: 0, crumble: -1, dead: false
      };
      S.turrets.push(e);
      return e;
    }

    function addNode(core, x, z) {
      if (!inBounds(x, z, 0.6)) {
        const c = clampPoint(x, z, 0.8);
        x = c.x;
        z = c.z;
      }
      const grp = new THREE.Group();
      const base = new THREE.Mesh(G.nodeBase, M.ink);
      const mat = ownMat(M.ink);
      const head = new THREE.Mesh(G.nodeHead, mat);
      head.userData.ownMat = true;
      head.position.y = 0.85;
      grp.add(base, head);
      grp.position.set(x, 0, z);
      world.add(grp);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute([x, 0.85, z, core.x, 0.95, core.z], 3));
      const line = new THREE.Line(lg, M.tether);
      line.userData.own = true;
      world.add(line);
      const hp = 4 + Math.floor(g.stage / 2);
      const e = { kind: 'node', core: core, x: x, z: z, hp: hp, max: hp, grp: grp, head: head, mat: mat, line: line, flash: 0, kick: 0, rise: 0, crumble: -1, dead: false };
      core.nodes++;
      S.nodes.push(e);
      return e;
    }

    function addCore(type, x, z) {
      const d = Math.max(1, g.stage);
      const grp = new THREE.Group();
      const mat = ownMat(M.ink);
      const body = new THREE.Mesh(G.core, mat);
      body.userData.ownMat = true;
      const ring = new THREE.Mesh(G.coreRing, M.ring);
      ring.rotation.x = Math.PI / 2 - 0.45;
      grp.add(body, ring);
      let shield = null, smat = null;
      if (type === 'warden') {
        smat = ownMat(M.shield);
        shield = new THREE.Mesh(G.shield, smat);
        shield.userData.ownMat = true;
        grp.add(shield);
      }
      grp.position.set(x, 0.95, z);
      world.add(grp);
      const hp = type === 'bouncer' ? 14 + 3 * d : type === 'spinner' ? 20 + 4 * d : 26 + 4 * d;
      const sp = type === 'bouncer' ? 2.1 + 0.12 * d : 0, a = rand(0, TAU);
      const c = {
        kind: 'core', type: type, x: x, z: z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, hp: hp, max: hp,
        grp: grp, body: body, ring: ring, mat: mat, shield: shield, smat: smat, nodes: 0, shieldT: 0,
        fire: rand(0.9, 1.5), aimT: 1.2, ang: rand(0, TAU), spinDir: 1, flipT: 4, rippleT: 0,
        flash: 0, kick: 0, rise: 0, dead: false
      };
      S.cores.push(c);
      return c;
    }

    function place(n, gap, fn) {
      for (let tries = 0; n > 0 && tries < 240; tries++) {
        const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (S.rad - 1);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (freeSpot(x, z, gap)) {
          fn(x, z);
          n--;
        }
      }
    }

    function cluster() {
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      for (let tries = 0; tries < 40; tries++) {
        const a = rand(0, TAU), r = rand(1.6, S.rad - 1.4);
        const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
        if (shape.every((c) => freeSpot(x0 + c[0], z0 + c[1], 0.95))) {
          shape.forEach((c) => addSolid('block', x0 + c[0], z0 + c[1]));
          return;
        }
      }
    }

    function genSweep(d) {
      setArena(9.5);
      if (S.attract) {
        addCore('spinner', 0, -1);
        place(5, 1.8, (x, z) => addSolid('cover', x, z));
        for (let i = 0; i < 6; i++) cluster();
        return;
      }
      const type = d <= 1 || Math.random() < 0.55 ? 'bouncer' : 'spinner';
      if (d >= 5 && Math.random() < 0.5) {
        addCore(type, -3, -1.5);
        addCore(type === 'bouncer' ? 'spinner' : 'bouncer', 3, -2);
      } else if (type === 'spinner') {
        addCore(type, 0, -1);
      } else {
        addCore(type, rand(-2, 2), rand(-3, 0));
      }
      place(Math.min(7, 3 + Math.floor(d / 2)), 1.8, (x, z) => addSolid('cover', x, z));
      const clusters = Math.min(9, 3 + d);
      for (let i = 0; i < clusters; i++) cluster();
      if (d >= 3) place(Math.min(2, Math.floor((d - 1) / 2)), 2.5, (x, z) => addTurret(x, z, false));
    }

    function genFortress(d) {
      setArena(11);
      const spots = d >= 6 && Math.random() < 0.6 ? [[-4.2, -2.6], [4.2, -2.6]] : [[0, -2.4]];
      const nNodes = Math.min(4, 2 + (d >= 4 ? 1 : 0) + (d >= 8 ? 1 : 0));
      for (const s of spots) {
        const c = addCore('warden', s[0], s[1]);
        const ringN = 12, gapAt = Math.floor(rand(0, ringN));
        for (let i = 0; i < ringN; i++) {
          if ((i - gapAt + ringN) % ringN < 2) continue;
          const a = i / ringN * TAU, x = s[0] + Math.cos(a) * 2.2, z = s[1] + Math.sin(a) * 2.2;
          if (inBounds(x, z, 0.5)) addSolid(Math.random() < 0.3 ? 'cover' : 'block', x, z);
        }
        const off = rand(0, TAU);
        for (let i = 0; i < nNodes; i++) {
          const a = off + i / nNodes * TAU;
          addNode(c, s[0] + Math.cos(a) * 3.6, s[1] + Math.sin(a) * 3.6);
        }
      }
      place(Math.min(4, 1 + Math.floor(d / 3)), 2.4, (x, z) => addTurret(x, z, d >= 4 && Math.random() < 0.5));
      place(4, 1.8, (x, z) => addSolid('cover', x, z));
      for (let i = 0; i < 3; i++) cluster();
    }

    function genCorridor(d) {
      const L = 40 + Math.min(24, d * 2);
      setLane(L);
      const pw = Math.min(0.6, 0.32 + 0.03 * d);
      let z = -4;
      while (z > -L + 2) {
        const depth = 1 + (Math.random() < 0.45 ? 1 : 0) + (d > 4 && Math.random() < 0.3 ? 1 : 0);
        const sparse = Math.random() < 0.3;
        const pathA = Math.floor(rand(-4, 5));
        let pathB = Math.floor(rand(-4, 5));
        if (pathB === pathA) pathB = pathA < 4 ? pathA + 1 : pathA - 1;
        for (let r = 0; r < depth; r++) {
          for (let x = -4; x <= 4; x++) {
            if (sparse) {
              const q = Math.random();
              if (q < 0.5) addSolid('block', x, z - r);
              else if (q < 0.62 && x !== pathA) addSolid('cover', x, z - r);
            } else if (x === pathA || x === pathB) {
              addSolid('block', x, z - r);
            } else {
              addSolid(Math.random() < pw ? 'cover' : 'block', x, z - r);
            }
          }
        }
        z -= depth;
        const gap = 3 + Math.floor(Math.random() * 3);
        if (d >= 2 && Math.random() < 0.45 && z - gap > -L + 2) {
          addTurret((Math.random() < 0.5 ? -1 : 1) * 3, z - Math.ceil(gap / 2), d >= 5 && Math.random() < 0.4);
        }
        z -= gap;
      }
      const cz = -L - 2.5;
      const type = d >= 4 && Math.random() < 0.5 ? 'warden' : 'spinner';
      const c = addCore(type, 0, cz);
      if (type === 'warden') {
        addNode(c, -3, cz + 1.5);
        addNode(c, 3, cz + 1.5);
      }
      addSolid('cover', -2, cz + 3.2);
      addSolid('cover', 2, cz + 3.2);
    }

    function clearWorld() {
      for (let i = world.children.length - 1; i >= 0; i--) {
        const o = world.children[i];
        world.remove(o);
        disposeObj(o);
      }
    }

    function buildStage(kind, attract) {
      clearWorld();
      S.kind = kind;
      S.attract = !!attract;
      S.solids = [];
      S.turrets = [];
      S.nodes = [];
      S.cores = [];
      S.grid = new Map();
      for (let i = 0; i < ebN; i++) EB[i].alive = false;
      ebN = shN = flN = 0;
      const d = attract ? 2 : Math.max(1, g.stage);
      if (kind === 'fortress') genFortress(d);
      else if (kind === 'corridor') genCorridor(d);
      else genSweep(d);
      let maxRise = 0;
      const delay = (o) => {
        o.rise = 0.35 + Math.hypot(o.x - S.spawnX, o.z - S.spawnZ) * (S.lane ? 0.012 : 0.03) + rand(0, 0.12);
        maxRise = Math.max(maxRise, o.rise);
      };
      S.solids.forEach(delay);
      S.turrets.forEach(delay);
      S.nodes.forEach(delay);
      S.cores.forEach(delay);
      S.introT = 0;
      S.introLen = clamp(maxRise + 0.5, 1.1, 1.9);
      P.x = S.spawnX;
      P.z = S.spawnZ;
      P.vx = P.vz = 0;
      P.aim = -Math.PI / 2;
      P.target = null;
      P.tx = P.x;
      P.tz = P.z;
      g.camZ = P.z - 3;
    }

    // ---------- run flow ----------

    function toTitle() {
      g.stage = 0;
      buildStage('sweep', true);
      S.introT = 9;
      g.mode = 'title';
      g.modeT = 0;
      g.banner = null;
      g.hint = null;
    }

    function start() {
      resetUp();
      g.stage = 0;
      g.score = 0;
      g.hits = 0;
      g.fired = 0;
      g.runT = 0;
      g.newBest = false;
      g.dive = 1;
      nextStage();
    }

    function nextStage() {
      g.stage++;
      const r = Math.random();
      const kind = g.stage <= ORDER.length ? ORDER[g.stage - 1] : (r < 0.36 ? 'sweep' : r < 0.7 ? 'fortress' : 'corridor');
      buildStage(kind, false);
      g.timeMax = g.left = KINDS[kind].time + 8 * up.time;
      P.hp = 3;
      P.inv = 0;
      P.barrier = up.barrier ? 1 : 0;
      P.pulse = 0;
      P.cool = 0.3;
      P.dead = false;
      g.hitStage = false;
      g.mode = 'intro';
      g.modeT = 0;
      g.hint = null;
      g.banner = { text: T('BREACH {n}', { n: pad(g.stage) }), sub: T(KINDS[kind].name), t0: g.t, dur: 1.5 };
    }

    function beginPlay() {
      g.mode = 'play';
      g.modeT = 0;
      g.banner = { text: T('BEGIN'), sub: '', t0: g.t, dur: 0.8 };
      const lines = [];
      if (g.stage === 1) lines.push(T(CONTROLS));
      if (!g.seenHint[S.kind]) lines.push(T(KINDS[S.kind].hint));
      g.seenHint[S.kind] = true;
      g.hint = lines.length ? { lines: lines, t0: g.t, dur: g.stage === 1 ? 7 : 5 } : null;
    }

    function stageClear(lastCore) {
      g.mode = 'clear';
      g.modeT = 0;
      for (let i = 0; i < ebN; i++) {
        const b = EB[i];
        burst(b.x, FLY, b.z, 1, b.hard ? pal.hard : pal.accent, 1.5, 0.6);
        b.alive = false;
      }
      g.score += ebN;
      ebN = 0;
      const timeBonus = Math.ceil(g.left) * 15, flawless = g.hitStage ? 0 : 150;
      g.clearBonus = timeBonus + flawless;
      g.score += g.clearBonus;
      const ox = lastCore.x, oz = lastCore.z;
      for (const o of S.solids) if (!o.dead && o.kind === 'block') o.crumble = 0.25 + Math.hypot(o.x - ox, o.z - oz) * 0.045;
      for (const e of S.turrets) if (!e.dead) e.crumble = 0.3 + Math.hypot(e.x - ox, e.z - oz) * 0.045;
      for (const e of S.nodes) if (!e.dead) e.crumble = 0.3;
      let sub = T('TIME BONUS +{n}', { n: timeBonus });
      if (flawless) sub += '   //   ' + T('NO DAMAGE +{n}', { n: flawless });
      g.banner = { text: T('BREACH COMPLETE'), sub: sub, t0: g.t + 0.45, dur: 1.9 };
      g.hint = null;
    }

    function openPatches() {
      const pool2 = PATCHES.filter((p) => up[p.id] < p.max);
      for (let i = pool2.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = pool2[i];
        pool2[i] = pool2[j];
        pool2[j] = t;
      }
      g.cards = pool2.slice(0, 3).map((p) => ({ id: p.id, p: p, rect: null }));
      if (!g.cards.length) { nextStage(); return; }
      g.mode = 'patch';
      g.modeT = 0;
      g.hot = '';
    }

    function pickPatch(id) {
      up[id]++;
      nextStage();
    }

    function fail(reason) {
      if (g.mode !== 'play') return;
      g.mode = 'down';
      g.modeT = 0;
      g.reason = reason;
      if (reason === 'integrity') {
        burst(P.x, FLY, P.z, 18, pal.dark ? pal.ink : pal.dust, 5, 0.9);
        burst(P.x, FLY, P.z, 8, pal.accent, 4, 0.6);
        spawnRing(P.x, P.z, 0.3, 3.2, 0.6, pal.accent, 0.9);
        P.dead = true;
        g.slowT = 0.8;
        g.shake = 1;
      } else {
        spawnRing(P.x, P.z, 0.3, 2.4, 0.6, pal.ink, 0.8);
        g.slowT = 0.5;
      }
      g.banner = { text: reason === 'time' ? T('TIME EXPIRED') : T('INTEGRITY LOST'), sub: '', t0: g.t, dur: 1.7, accent: true };
      g.hint = null;
      const run = { score: g.score, stages: g.stage - 1, at: Date.now() };
      last = run;
      runs.push(run);
      runs.sort((a, b) => b.score - a.score);
      runs = runs.slice(0, 10);
      g.newBest = runs[0] === run && run.score > 0;
      api.store.set('breach.runs', runs);
      api.store.set('breach.last', last);
      api.say('Report', T('Breach drill ended. {stages}, score {score}.', {
        stages: TN(run.stages, '{n} breach cleared|{n} breaches cleared'), score: run.score
      }));
      if (g.newBest) api.say('Report', T('New terminal record. Recommend continued training.'));
    }

    function pause() {
      if (g.mode !== 'play' && g.mode !== 'intro') return;
      g.prev = g.mode;
      g.mode = 'paused';
    }

    // ---------- effects ----------

    function burst(x, y, z, n, color, power, size) {
      for (let i = 0; i < n && sdN < MAX_SHARDS; i++) {
        const s = SD[sdN++], a = rand(0, TAU), v = rand(0.4, 1) * power;
        s.x = x; s.y = y; s.z = z;
        s.vx = Math.cos(a) * v;
        s.vz = Math.sin(a) * v;
        s.vy = rand(1.5, 5) * (power / 4 + 0.5);
        s.rx = rand(0, TAU);
        s.ry = rand(0, TAU);
        s.wr = rand(-12, 12);
        s.life = rand(0.7, 1.4);
        s.s = (size || 1) * rand(0.6, 1.3);
        s.c = color;
      }
    }

    function spark(x, z, color) {
      burst(x, FLY, z, 2, color, 2, 0.45);
    }

    function spawnRing(x, z, r0, r1, dur, color, alpha, y) {
      let m = null;
      for (let i = 0; i < rings.length; i++) if (!rings[i].visible) { m = rings[i]; break; }
      if (!m) return;
      m.visible = true;
      m.position.set(x, y === undefined ? 0.06 : y, z);
      m.scale.set(r0, 1, r0);
      m.material.color.copy(color);
      m.material.opacity = alpha;
      const f = m.fx;
      f.t = 0; f.dur = dur; f.r0 = r0; f.r1 = r1; f.a = alpha;
    }

    function addScore(n, x, z) {
      g.score += n;
      if (flN >= MAX_FLOATS) return;
      const f = FL[flN++];
      f.x = x; f.y = 1.3; f.z = z; f.text = '+' + n; f.t = 0; f.dur = 0.9;
    }

    function updateFx(dt) {
      for (let i = sdN - 1; i >= 0; i--) {
        const s = SD[i];
        s.life -= dt;
        s.vy -= 16 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.rx += s.wr * dt;
        s.ry += s.wr * 0.7 * dt;
        if (s.y < 0.08 && s.vy < 0 && onPlatform(s.x, s.z)) {
          s.y = 0.08;
          s.vy *= -0.32;
          s.vx *= 0.7;
          s.vz *= 0.7;
          s.wr *= 0.6;
        }
        if (s.life <= 0 || s.y < -30) {
          SD[i] = SD[sdN - 1];
          SD[sdN - 1] = s;
          sdN--;
        }
      }
      for (let i = 0; i < rings.length; i++) {
        const m = rings[i];
        if (!m.visible) continue;
        const f = m.fx;
        f.t += dt;
        const p = f.t / f.dur;
        if (p >= 1) { m.visible = false; continue; }
        const r = lerp(f.r0, f.r1, easeOut(p));
        m.scale.set(r, 1, r);
        m.material.opacity = f.a * (1 - p);
      }
      for (let i = flN - 1; i >= 0; i--) {
        const f = FL[i];
        f.t += dt;
        if (f.t >= f.dur) {
          FL[i] = FL[flN - 1];
          FL[flN - 1] = f;
          flN--;
        }
      }
    }

    // ---------- combat ----------

    function damage(e, amt) {
      e.hp -= amt;
      e.flash = 1;
      e.kick = 1;
      g.hits++;
      if (e.hp <= 0 && !e.dead) destroy(e, false);
      else if (e.kind !== 'block') spark(e.x, e.z, pal.accent);
    }

    function destroy(e, quiet) {
      e.dead = true;
      if (e.kind === 'block') {
        burst(e.x, 0.45, e.z, quiet ? 4 : 8, pal.ink, 3.2, 1);
        if (!quiet) {
          addScore(10, e.x, e.z);
          spawnRing(e.x, e.z, 0.3, 1.1, 0.3, pal.ink, 0.5);
        } else {
          g.score += 5;
        }
      } else if (e.kind === 'turret') {
        burst(e.x, 0.9, e.z, 14, pal.ink, 4.5, 1.1);
        if (e.shield) burst(e.x, 0.6, e.z, 6, pal.cover, 3.5, 1);
        spawnRing(e.x, e.z, 0.4, 2.2, 0.45, pal.accent, 0.8);
        if (!quiet) addScore(80, e.x, e.z);
        g.shake = Math.max(g.shake, 0.25);
        world.remove(e.grp);
        disposeObj(e.grp);
      } else if (e.kind === 'node') {
        burst(e.x, 0.85, e.z, 10, pal.ink, 4, 1);
        spawnRing(e.x, e.z, 0.3, 1.8, 0.4, pal.accent, 0.8);
        if (!quiet) addScore(60, e.x, e.z);
        world.remove(e.grp);
        world.remove(e.line);
        disposeObj(e.grp);
        disposeObj(e.line);
        const c = e.core;
        c.nodes--;
        if (c.nodes <= 0 && !c.dead) dropShield(c);
      } else if (e.kind === 'core') {
        burst(e.x, 0.95, e.z, 30, pal.ink, 6.5, 1.3);
        burst(e.x, 0.95, e.z, 12, pal.accent, 5, 0.8);
        spawnRing(e.x, e.z, 0.5, 6, 0.7, pal.accent, 0.9);
        spawnRing(e.x, e.z, 0.3, 3.5, 0.5, pal.ink, 0.7);
        g.stopT = 0.09;
        g.slowT = 0.45;
        g.shake = 0.9;
        g.flash = 0.6;
        addScore(250 + 50 * g.stage, e.x, e.z);
        world.remove(e.grp);
        disposeObj(e.grp);
        if (g.mode === 'play' && S.cores.every((c) => c.dead)) stageClear(e);
      }
    }

    function dropShield(c) {
      c.shieldT = 0.0001;
      burst(c.x, 0.95, c.z, 12, pal.cover, 4, 0.9);
      spawnRing(c.x, c.z, 0.8, 3, 0.45, pal.ink, 0.6);
      g.flash = Math.max(g.flash, 0.25);
      if (flN < MAX_FLOATS) {
        const f = FL[flN++];
        f.x = c.x; f.y = 2; f.z = c.z; f.text = T('SHIELD DOWN'); f.t = 0; f.dur = 1.2;
      }
    }

    function hitShip() {
      if (g.mode !== 'play' || P.inv > 0 || g.god) return false;
      if (P.barrier > 0) {
        P.barrier = 0;
        P.inv = 0.9;
        spawnRing(P.x, P.z, 0.3, 1.6, 0.35, pal.accent, 0.9);
        burst(P.x, FLY, P.z, 6, pal.accent, 3, 0.5);
        return true;
      }
      P.hp--;
      P.inv = 1.5;
      g.hitStage = true;
      g.shake = 0.6;
      g.stopT = 0.06;
      g.hurt = 1;
      burst(P.x, FLY, P.z, 5, pal.dark ? pal.ink : pal.dust, 3, 0.6);
      spawnRing(P.x, P.z, 0.2, 1.8, 0.4, pal.accent, 0.9);
      if (P.hp <= 0) fail('integrity');
      return true;
    }

    function pulse() {
      if (P.pulse > 0 || P.dead) return;
      const r = 3.6 + 0.9 * up.pulse;
      P.pulseMax = P.pulse = 7 * Math.pow(0.7, up.pulse);
      spawnRing(P.x, P.z, 0.3, r, 0.45, pal.accent, 0.9);
      spawnRing(P.x, P.z, 0.2, r * 0.7, 0.35, pal.ink, 0.6);
      let n = 0;
      for (let i = ebN - 1; i >= 0; i--) {
        const b = EB[i], dx = b.x - P.x, dz = b.z - P.z, dd = Math.hypot(dx, dz);
        if (dd > r) continue;
        if (!b.hard) {
          if (n < 30) burst(b.x, FLY, b.z, 1, pal.accent, 1.5, 0.5);
          removeBullet(i);
          n++;
        } else {
          const sp = Math.hypot(b.vx, b.vz) * 1.2, l = dd || 1;
          b.vx = dx / l * sp;
          b.vz = dz / l * sp;
        }
      }
      g.score += n;
      g.shake = Math.max(g.shake, 0.25);
    }

    function emit(x, z, a, sp, hard, r0, ghost) {
      if (ebN >= MAX_EB) return;
      const b = EB[ebN++], c = Math.cos(a), s = Math.sin(a);
      b.x = x + c * r0;
      b.z = z + s * r0;
      b.vx = c * sp;
      b.vz = s * sp;
      b.hard = !!hard;
      b.t = 0;
      b.ghost = ghost || 0;
      b.gen = ++gen;
      b.alive = true;
    }

    function aimed(x, z, n, spread, sp, hard, r0, ghost) {
      const a = Math.atan2(P.z - z, P.x - x);
      for (let i = 0; i < n; i++) emit(x, z, a + (i - (n - 1) / 2) * spread, sp, hard, r0, ghost);
    }

    function removeBullet(i) {
      const b = EB[i];
      b.alive = false;
      EB[i] = EB[ebN - 1];
      EB[ebN - 1] = b;
      ebN--;
    }

    function fireShots() {
      const n = 1 + up.split, dmg = 1 + 0.5 * up.damage;
      for (let i = 0; i < n && shN < MAX_SHOTS; i++) {
        const a = P.aim + (i - (n - 1) / 2) * 0.11, c = Math.cos(a), s = Math.sin(a), o = SH[shN++];
        o.x = P.x + c * 0.45;
        o.z = P.z + s * 0.45;
        o.vx = c * SHOT_SPEED;
        o.vz = s * SHOT_SPEED;
        o.life = SHOT_LIFE;
        o.dmg = dmg;
      }
      g.fired += n;
      P.kick = 1;
    }

    // Is the straight line from the probe to e free of pillars and raised shields?
    function clearLine(x0, z0, e) {
      const x1 = e.x, z1 = e.z, dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
      const minX = Math.min(x0, x1) - 0.7, maxX = Math.max(x0, x1) + 0.7;
      const minZ = Math.min(z0, z1) - 0.7, maxZ = Math.max(z0, z1) + 0.7;
      for (let i = 0; i < S.solids.length; i++) {
        const o = S.solids[i];
        if (o.dead || o.kind !== 'cover' || o.x < minX || o.x > maxX || o.z < minZ || o.z > maxZ) continue;
        const t = clamp(((o.x - x0) * dx + (o.z - z0) * dz) / L2, 0, 1);
        const px = x0 + dx * t - o.x, pz = z0 + dz * t - o.z;
        if (px * px + pz * pz < 0.36) return false;
      }
      for (let i = 0; i < S.cores.length; i++) {
        const c = S.cores[i];
        if (c.dead || c === e || c.nodes <= 0) continue;
        const t = clamp(((c.x - x0) * dx + (c.z - z0) * dz) / L2, 0, 1);
        const px = x0 + dx * t - c.x, pz = z0 + dz * t - c.z;
        if (px * px + pz * pz < 2.1) return false;
      }
      return true;
    }

    function consider(e, s) {
      if (cN < CE.length) {
        CE[cN] = e;
        CS[cN] = s;
        cN++;
        return;
      }
      let w = 0;
      for (let i = 1; i < cN; i++) if (CS[i] > CS[w]) w = i;
      if (s < CS[w]) { CE[w] = e; CS[w] = s; }
    }

    // Target choice: a shootable shot about to hit first, then the closest thing the probe can see.
    // Armored turrets only count from behind, shielded cores not at all.
    function pickTarget() {
      let best = null, bs = Infinity;
      for (let i = 0; i < ebN; i++) {
        const b = EB[i];
        if (b.hard) continue;
        const dx = b.x - P.x, dz = b.z - P.z, d2 = dx * dx + dz * dz;
        if (d2 > 12 || b.vx * -dx + b.vz * -dz <= 0) continue;
        if (d2 < bs) { bs = d2; best = b; }
      }
      if (best) {
        P.targetGen = best.gen;
        return best;
      }
      cN = 0;
      const R2 = RANGE * RANGE;
      for (let i = 0; i < S.solids.length; i++) {
        const o = S.solids[i];
        if (o.dead || o.kind !== 'block') continue;
        const dx = o.x - P.x, dz = o.z - P.z, d2 = dx * dx + dz * dz;
        if (d2 < R2) consider(o, Math.sqrt(d2));
      }
      for (const e of S.turrets) {
        if (e.dead) continue;
        if (e.armored && Math.abs(angDiff(e.face, Math.atan2(P.z - e.z, P.x - e.x))) < SHIELD_HALF + 0.12) continue;
        const d = Math.hypot(e.x - P.x, e.z - P.z);
        if (d < RANGE) consider(e, d - 1.5);
      }
      for (const e of S.nodes) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - P.x, e.z - P.z);
        if (d < RANGE) consider(e, d - 2.5);
      }
      for (const c of S.cores) {
        if (c.dead || c.nodes > 0) continue;
        const d = Math.hypot(c.x - P.x, c.z - P.z);
        if (d < RANGE) consider(c, d - 2);
      }
      for (let k = 0; k < 8 && cN; k++) {
        let m = -1;
        for (let i = 0; i < cN; i++) if (CS[i] < Infinity && (m < 0 || CS[i] < CS[m])) m = i;
        if (m < 0) break;
        const e = CE[m];
        CS[m] = Infinity;
        if (clearLine(P.x, P.z, e)) {
          for (let i = 0; i < cN; i++) CE[i] = null;
          P.targetGen = 0;
          return e;
        }
      }
      for (let i = 0; i < cN; i++) CE[i] = null;
      return null;
    }

    const targetAlive = (t) => (t.gen !== undefined ? t.alive && t.gen === P.targetGen : !t.dead);

    function collideShip() {
      const r = SHIP_R;
      gather(P.x, P.z);
      for (let c = 0; c < nbN; c++) {
        const a = NB[c];
        for (let n = 0; n < a.length; n++) {
          const o = a[n];
          if (o.dead) continue;
          if (o.kind === 'block') {
            const cx = clamp(P.x, o.x - 0.45, o.x + 0.45), cz = clamp(P.z, o.z - 0.45, o.z + 0.45);
            const dx = P.x - cx, dz = P.z - cz, dd = Math.hypot(dx, dz);
            if (dd >= r) continue;
            if (dd > 1e-5) {
              P.x += dx / dd * (r - dd);
              P.z += dz / dd * (r - dd);
            } else {
              const ox = P.x - o.x, oz = P.z - o.z;
              if (Math.abs(ox) > Math.abs(oz)) P.x = o.x + (ox < 0 ? -1 : 1) * (0.45 + r);
              else P.z = o.z + (oz < 0 ? -1 : 1) * (0.45 + r);
            }
          } else {
            pushCircle(o.x, o.z, 0.5 + r);
          }
        }
      }
      for (const e of S.turrets) if (!e.dead) pushCircle(e.x, e.z, 0.62 + r);
      for (const e of S.nodes) if (!e.dead) pushCircle(e.x, e.z, 0.42 + r);
      for (const c of S.cores) if (!c.dead) pushCircle(c.x, c.z, (c.nodes > 0 ? 1.42 : 0.85) + r);
    }

    function pushCircle(x, z, rr) {
      const dx = P.x - x, dz = P.z - z, dd = Math.hypot(dx, dz);
      if (dd >= rr) return;
      if (dd < 1e-5) { P.z = z + rr; return; }
      P.x = x + dx / dd * rr;
      P.z = z + dz / dd * rr;
    }

    function cursorWorld() {
      if (!g.hasMouse) return false;
      pv.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position);
      if (pv.y > -1e-4) return false;
      const t = (FLY - camera.position.y) / pv.y;
      CP.x = camera.position.x + pv.x * t;
      CP.z = camera.position.z + pv.z * t;
      return true;
    }

    function updateShip(dt, canFire) {
      if (P.dead) return;
      let tx = P.x, tz = P.z;
      if (cursorWorld()) { tx = CP.x; tz = CP.z; }
      clampPoint(tx, tz, SHIP_R + 0.05);
      tx = CP.x;
      tz = CP.z;
      P.tx = tx;
      P.tz = tz;
      const maxV = 11 * (1 + 0.15 * up.speed);
      let dvx = (tx - P.x) * 9, dvz = (tz - P.z) * 9;
      const l = Math.hypot(dvx, dvz);
      if (l > maxV) { dvx *= maxV / l; dvz *= maxV / l; }
      const k = 1 - Math.exp(-14 * dt);
      P.vx += (dvx - P.vx) * k;
      P.vz += (dvz - P.vz) * k;
      P.x += P.vx * dt;
      P.z += P.vz * dt;
      collideShip();
      clampPoint(P.x, P.z, SHIP_R);
      P.x = CP.x;
      P.z = CP.z;
      P.inv = Math.max(0, P.inv - dt);
      P.pulse = Math.max(0, P.pulse - dt);
      P.kick = Math.max(0, P.kick - dt * 8);
      P.cool = Math.max(0, P.cool - dt);
      if (!canFire) return;
      g.retarget -= dt;
      if (g.retarget <= 0 || !P.target || !targetAlive(P.target)) {
        g.retarget = 0.09;
        P.target = pickTarget();
      }
      const tg = P.target;
      let want = P.aim;
      if (tg) {
        const lead = Math.hypot(tg.x - P.x, tg.z - P.z) / SHOT_SPEED;
        want = Math.atan2(tg.z + (tg.vz || 0) * lead - P.z, tg.x + (tg.vx || 0) * lead - P.x);
      } else if (Math.hypot(P.vx, P.vz) > 1.5) {
        want = Math.atan2(P.vz, P.vx);
      }
      const turn = 15 * dt;
      P.aim += clamp(angDiff(P.aim, want), -turn, turn);
      if (tg && Math.abs(angDiff(P.aim, want)) < 0.22 && P.cool <= 0) {
        fireShots();
        P.cool = 1 / (9 * (1 + 0.3 * up.rate));
      }
    }

    function shotHit(s) {
      for (let i = 0; i < ebN; i++) {
        const b = EB[i];
        if (b.hard) continue;
        const dx = b.x - s.x, dz = b.z - s.z;
        if (dx * dx + dz * dz < 0.16) {
          burst(b.x, FLY, b.z, 2, pal.accent, 2, 0.5);
          removeBullet(i);
          g.hits++;
          g.score += 2;
          if (!up.pierce) return true;
          i--;
        }
      }
      const o = solidAt(s.x, s.z, 0.5, 0.52);
      if (o) {
        if (o.kind === 'block') damage(o, s.dmg);
        else spark(s.x, s.z, pal.cover);
        return true;
      }
      for (const e of S.turrets) {
        if (e.dead) continue;
        const dx = s.x - e.x, dz = s.z - e.z, d2 = dx * dx + dz * dz;
        if (e.armored && d2 < 0.81 && Math.abs(angDiff(e.face, Math.atan2(-s.vz, -s.vx))) < SHIELD_HALF) {
          spark(s.x, s.z, pal.cover);
          return true;
        }
        if (d2 < 0.42) { damage(e, s.dmg); return true; }
      }
      for (const e of S.nodes) {
        if (e.dead) continue;
        const dx = s.x - e.x, dz = s.z - e.z;
        if (dx * dx + dz * dz < 0.25) { damage(e, s.dmg); return true; }
      }
      for (const c of S.cores) {
        if (c.dead) continue;
        const dx = s.x - c.x, dz = s.z - c.z, d2 = dx * dx + dz * dz;
        if (c.nodes > 0 && d2 < 2.0) {
          if (c.rippleT <= 0) {
            c.rippleT = 0.12;
            spawnRing(c.x, c.z, 1.2, 1.7, 0.25, pal.cover, 0.7, 0.95);
          }
          return true;
        }
        if (d2 < 0.72) { damage(c, s.dmg); return true; }
      }
      return false;
    }

    function updateShots(dt) {
      for (let i = shN - 1; i >= 0; i--) {
        const s = SH[i];
        s.life -= dt;
        let gone = s.life <= 0;
        const steps = Math.max(1, Math.ceil(SHOT_SPEED * dt / 0.3));
        const sx = s.vx * dt / steps, sz = s.vz * dt / steps;
        for (let k = 0; k < steps && !gone; k++) {
          s.x += sx;
          s.z += sz;
          gone = shotHit(s);
        }
        if (!gone && !inArea(s.x, s.z, 1.5)) gone = true;
        if (gone) {
          SH[i] = SH[shN - 1];
          SH[shN - 1] = s;
          shN--;
        }
      }
    }

    function updateBullets(dt) {
      const live = g.mode === 'play';
      for (let i = ebN - 1; i >= 0; i--) {
        const b = EB[i];
        b.t += dt;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        if (b.t > 12 || !inArea(b.x, b.z, 2.5) || (S.lane && Math.abs(b.z - P.z) > 24)) {
          removeBullet(i);
          continue;
        }
        if (b.t > b.ghost && solidAt(b.x, b.z, 0.62, 0.68)) {
          if (Math.random() < 0.35) spark(b.x, b.z, b.hard ? pal.hard : pal.accent);
          removeBullet(i);
          continue;
        }
        if (live) {
          const dx = b.x - P.x, dz = b.z - P.z;
          if (dx * dx + dz * dz < 0.2209 && hitShip()) removeBullet(i);
        }
      }
    }

    function moveBouncer(c, dt) {
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      const lim = S.rad - 0.9, r = Math.hypot(c.x, c.z);
      if (r > lim) {
        const nx = c.x / r, nz = c.z / r, dot = c.vx * nx + c.vz * nz;
        if (dot > 0) { c.vx -= 2 * dot * nx; c.vz -= 2 * dot * nz; }
        c.x = nx * lim;
        c.z = nz * lim;
      }
      for (let i = 0; i < S.solids.length; i++) {
        const o = S.solids[i];
        if (o.dead) continue;
        const dx = c.x - o.x, dz = c.z - o.z, rr = 1.4;
        if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
        const dd = Math.hypot(dx, dz);
        if (dd >= rr || dd < 1e-4) continue;
        const nx = dx / dd, nz = dz / dd, dot = c.vx * nx + c.vz * nz;
        if (dot < 0) { c.vx -= 2 * dot * nx; c.vz -= 2 * dot * nz; }
        c.x = o.x + nx * rr;
        c.z = o.z + nz * rr;
      }
    }

    function updateEnemies(dt, firing) {
      const d = S.attract ? 2 : Math.max(1, g.stage);
      const bs = Math.min(6.2, 3.3 + 0.27 * d);
      const hr = Math.min(0.55, 0.12 + 0.06 * d);
      const rate = Math.max(0.55, 1 - 0.045 * d);
      const every = Math.max(2, Math.round(1 / hr));
      for (const c of S.cores) {
        if (c.dead) continue;
        c.rippleT -= dt;
        if (c.type === 'bouncer') moveBouncer(c, dt);
        if (!firing || (S.lane && Math.abs(c.z - P.z) > 15)) continue;
        c.fire -= dt;
        if (c.type === 'bouncer') {
          if (c.fire <= 0) {
            c.fire = rand(1.2, 1.6) * rate;
            const n = Math.min(18, 8 + d), ph = rand(0, TAU);
            for (let i = 0; i < n; i++) emit(c.x, c.z, ph + i / n * TAU, bs * 0.9, i % every === 0, 0.9);
          }
        } else if (c.type === 'spinner') {
          c.flipT -= dt;
          if (c.flipT <= 0) { c.flipT = rand(3, 5); c.spinDir *= -1; }
          c.ang += c.spinDir * 1.5 * dt;
          if (c.fire <= 0) {
            c.fire = 0.16 * rate + 0.04;
            const arms = 2 + (d >= 3 ? 1 : 0) + (d >= 7 ? 1 : 0);
            for (let i = 0; i < arms; i++) emit(c.x, c.z, c.ang + i / arms * TAU, bs * 0.8, d >= 2 && i % 2 === 1, 0.9);
          }
        } else {
          const shielded = c.nodes > 0;
          if (c.fire <= 0) {
            if (shielded) {
              c.fire = 2.6 * rate;
              const n = 18, gapAt = Math.floor(rand(0, n)), ph = rand(0, TAU);
              for (let i = 0; i < n; i++) if ((i - gapAt + n) % n >= 3) emit(c.x, c.z, ph + i / n * TAU, bs * 0.7, true, 1.5, 0.6);
            } else {
              c.fire = 0.9 * rate;
              aimed(c.x, c.z, 5, 0.16, bs, false, 0.9, 0.5);
              if (Math.random() < 0.5 + hr) aimed(c.x, c.z, 1, 0, bs * 1.15, true, 0.9, 0.5);
            }
          }
          c.aimT -= dt;
          if (shielded && c.aimT <= 0) {
            c.aimT = 1.7 * rate;
            aimed(c.x, c.z, 3, 0.2, bs * 0.85, false, 1.5, 0.6);
          }
        }
      }
      for (const e of S.turrets) {
        if (e.dead) continue;
        if (e.armored) {
          const want = Math.atan2(P.z - e.z, P.x - e.x);
          e.face += clamp(angDiff(e.face, want), -0.75 * dt, 0.75 * dt);
        }
        if (!firing || (S.lane && Math.abs(e.z - P.z) > 15) || Math.hypot(P.x - e.x, P.z - e.z) > 16) continue;
        e.fire -= dt;
        if (e.fire <= 0 && e.burst <= 0) {
          e.fire = (e.armored ? 1.7 : 1.9) * rate;
          e.burst = e.armored ? 1 : 3;
          e.burstT = 0;
        }
        if (e.burst > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0) {
            e.burstT = 0.13;
            e.burst--;
            if (e.armored) emit(e.x, e.z, e.face, bs * 1.1, true, 0.75);
            else aimed(e.x, e.z, 1, 0, bs, false, 0.6);
          }
        }
      }
    }

    function crumble(dt) {
      const tick = (e) => {
        if (e.dead || e.crumble < 0) return;
        e.crumble -= dt;
        if (e.crumble <= 0) destroy(e, true);
      };
      S.solids.forEach(tick);
      S.turrets.forEach(tick);
      S.nodes.forEach(tick);
    }

    // ---------- per-frame ----------

    function step(raw) {
      let ts = 1;
      if (g.stopT > 0) { g.stopT -= raw; ts = 0.04; }
      else if (g.slowT > 0) { g.slowT -= raw; ts = 0.33; }
      const dt = raw * ts;
      g.shake = Math.max(0, g.shake - raw * 2.4);
      g.flash = Math.max(0, g.flash - raw * 2.5);
      g.hurt = Math.max(0, g.hurt - raw * 1.8);
      g.dive = Math.max(0, g.dive - raw * 1.3);
      if (g.mode === 'paused') return 0;
      g.modeT += raw;
      S.introT += dt;
      updateFx(dt);
      switch (g.mode) {
        case 'title':
          updateEnemies(dt, true);
          updateBullets(dt);
          break;
        case 'intro':
          updateShip(dt, false);
          if (S.introT > S.introLen) beginPlay();
          break;
        case 'play':
          g.left -= dt;
          g.runT += dt;
          updateShip(dt, true);
          updateEnemies(dt, true);
          updateShots(dt);
          updateBullets(dt);
          if (g.mode === 'play' && g.left <= 0) {
            g.left = 0;
            fail('time');
          }
          break;
        case 'clear':
          updateShip(dt, false);
          updateShots(dt);
          crumble(dt);
          if (g.modeT > 2.4) openPatches();
          break;
        case 'down':
          updateShots(dt);
          updateBullets(dt);
          if (g.modeT > 1.9) {
            g.mode = 'over';
            g.modeT = 0;
            g.overAt = performance.now();
          }
          break;
        default:
          break;
      }
      return dt;
    }

    function placeCamera(raw, t) {
      const v = Math.tan(camera.fov * Math.PI / 360), elev = 1.0;
      let tx = 0, tz = 0, dist;
      if (S.lane) {
        g.camZ = lerp(g.camZ, P.z - 3, 1 - Math.exp(-5 * raw));
        tz = g.camZ;
        dist = Math.max((S.half + 1.6) / (v * camera.aspect), 7.5 / v);
      } else {
        const hx2 = S.R + 0.6, hz = S.R * 0.866 * Math.sin(elev) + 1.2;
        dist = Math.max(hx2 / (v * camera.aspect), hz / v) * 1.08;
        if (g.mode !== 'title') {
          tx = P.x * 0.1;
          tz = P.z * 0.1;
        }
      }
      const yaw = g.mode === 'title' ? t * 0.07 : 0;
      dist *= 1 + 3 * g.dive * g.dive;
      const sh = g.shake * g.shake * 0.35;
      camera.position.set(
        tx + Math.sin(yaw) * Math.cos(elev) * dist + rand(-1, 1) * sh,
        Math.sin(elev) * dist + rand(-1, 1) * sh,
        tz + Math.cos(yaw) * Math.cos(elev) * dist + rand(-1, 1) * sh
      );
      camera.lookAt(tx, 0, tz);
      camera.updateMatrixWorld();
      return tz;
    }

    function riseY(o) {
      const p = (S.introT - o.rise) / 0.5;
      if (p >= 1) return 0;
      return -3.2 * (1 - easeBack(p));
    }

    function syncScene(dt, t, camZ) {
      const fade = Math.exp(-6 * dt), kfade = Math.exp(-9 * dt);
      if (S.platform) S.platform.position.y = -5 * (1 - easeOut(S.introT / 0.45));

      const ba = I.blocks.instanceMatrix.array, ca = I.covers.instanceMatrix.array;
      let nb = 0, nc = 0;
      for (let i = 0; i < S.solids.length; i++) {
        const o = S.solids[i];
        if (o.dead) continue;
        o.flash *= fade;
        o.kick *= kfade;
        const y = riseY(o);
        if (o.kind === 'block') {
          if (nb >= MAX_BLOCKS) continue;
          setTS(ba, nb, o.x, y, o.z, 1 + o.kick * 0.1);
          tmpC.copy(pal.ink).lerp(pal.accent, o.flash);
          I.blocks.setColorAt(nb, tmpC);
          nb++;
        } else if (nc < MAX_COVERS) {
          setTS(ca, nc++, o.x, y, o.z, 1);
        }
      }
      I.blocks.count = nb;
      I.blocks.instanceMatrix.needsUpdate = true;
      I.blocks.instanceColor.needsUpdate = true;
      I.covers.count = nc;
      I.covers.instanceMatrix.needsUpdate = true;

      const bl = I.blobs.instanceMatrix.array;
      let nbl = 0;
      const blob = (x, z, h, s) => {
        if (nbl < MAX_BLOBS) setTS(bl, nbl++, x + 0.26 * h, 0.02, z - 0.24 * h, s);
      };

      for (const e of S.turrets) {
        if (e.dead) continue;
        e.flash *= fade;
        e.kick *= kfade;
        e.grp.position.y = riseY(e);
        e.head.rotation.y += dt * 2.2;
        e.head.position.y = 0.95 + Math.sin(t * 2.4 + e.x) * 0.06;
        e.head.scale.setScalar(1 + e.kick * 0.15);
        const tele = g.mode === 'play' ? clamp(1 - e.fire / 0.45, 0, 1) * 0.5 : 0;
        e.mat.color.copy(pal.ink).lerp(pal.accent, Math.max(e.flash, tele));
        if (e.armored) e.grp.rotation.y = Math.atan2(Math.cos(e.face), Math.sin(e.face));
        blob(e.x, e.z, 0.9, 1.1);
      }
      M.tether.opacity = 0.45 + 0.25 * Math.sin(t * 5);
      for (const e of S.nodes) {
        if (e.dead) continue;
        e.flash *= fade;
        e.kick *= kfade;
        e.grp.position.y = riseY(e);
        e.line.visible = S.introT > e.rise + 0.5;
        e.head.rotation.y += dt * 1.6;
        e.head.position.y = 0.85 + Math.sin(t * 3 + e.z) * 0.07;
        e.head.scale.setScalar(1 + e.kick * 0.15);
        e.mat.color.copy(pal.ink).lerp(pal.accent, e.flash);
        blob(e.x, e.z, 0.8, 0.8);
      }
      for (const c of S.cores) {
        if (c.dead) continue;
        c.flash *= fade;
        c.kick *= kfade;
        c.grp.position.set(c.x, 0.95 + riseY(c) + Math.sin(t * 1.7 + c.x) * 0.08, c.z);
        c.body.rotation.x += dt * 0.7;
        c.body.rotation.y += dt * 1.1;
        c.body.scale.setScalar(1 + c.kick * 0.1);
        c.ring.rotation.z += dt * 1.6;
        c.mat.color.copy(pal.ink).lerp(pal.accent, Math.min(1, 0.12 + 0.1 * Math.sin(t * 5) + c.flash * 0.9));
        if (c.shield) {
          if (c.nodes > 0) {
            c.shield.rotation.y -= dt * 0.4;
            c.shield.rotation.x += dt * 0.15;
            c.smat.color.copy(pal.cover);
            c.smat.opacity = 0.88;
          } else {
            c.shieldT += dt / 0.45;
            const p = easeOut(c.shieldT);
            c.shield.scale.setScalar(1 + p * 0.9);
            c.smat.opacity = 0.88 * (1 - p);
            if (c.shieldT >= 1) {
              c.grp.remove(c.shield);
              c.smat.dispose();
              c.shield = null;
              c.smat = null;
            }
          }
        }
        blob(c.x, c.z, 0.95, 1.8);
      }

      const showShip = g.mode !== 'title' && !P.dead;
      ship.visible = showShip && !(P.inv > 0 && Math.floor(P.inv * 14) % 2 === 0);
      if (showShip) {
        const back = P.kick * 0.06;
        ship.position.set(P.x - Math.cos(P.aim) * back, FLY + Math.sin(t * 3) * 0.04 + riseY(P), P.z - Math.sin(P.aim) * back);
        const lateral = (Math.cos(P.aim) * P.vz - Math.sin(P.aim) * P.vx) / 11;
        ship.rotation.set(0, yawFor(P.aim), clamp(-lateral * 0.7, -0.55, 0.55));
        ship.userData.eng.scale.setScalar(0.8 + Math.random() * 0.5);
        blob(P.x, P.z, 0.5, 0.95);
      }
      marker.visible = showShip && (g.mode === 'play' || g.mode === 'intro') && g.hasMouse;
      if (marker.visible) {
        marker.position.set(P.tx, 0.03, P.tz);
        marker.scale.setScalar(1 + 0.12 * Math.sin(t * 6));
      }
      barrierMesh.visible = showShip && P.barrier > 0;
      if (barrierMesh.visible) {
        barrierMesh.position.set(P.x, FLY, P.z);
        barrierMesh.rotation.y = t * 2;
      }
      I.blobs.count = nbl;
      I.blobs.instanceMatrix.needsUpdate = true;

      const sa = I.shots.instanceMatrix.array;
      for (let i = 0; i < shN; i++) {
        const s = SH[i];
        setYaw(sa, i, s.x, FLY, s.z, s.vx / SHOT_SPEED, s.vz / SHOT_SPEED, 1);
      }
      I.shots.count = shN;
      I.shots.instanceMatrix.needsUpdate = true;

      const so = I.soft.instanceMatrix.array, ho = I.hard.instanceMatrix.array, ro = I.ring.instanceMatrix.array;
      const lo = I.halo ? I.halo.instanceMatrix.array : null;
      let ns = 0, nh = 0;
      for (let i = 0; i < ebN; i++) {
        const b = EB[i], pop = Math.min(1, b.t * 8);
        if (b.hard) {
          setTS(ho, nh, b.x, FLY, b.z, pop);
          setTS(ro, nh, b.x, FLY, b.z, pop * (1 + 0.08 * Math.sin(t * 10 + b.x)));
          nh++;
        } else {
          setTS(so, ns, b.x, FLY, b.z, pop);
          if (lo) setTS(lo, ns, b.x, FLY - 0.03, b.z, pop * (0.9 + 0.15 * Math.sin(t * 12 + b.z)));
          ns++;
        }
      }
      I.soft.count = ns;
      I.hard.count = nh;
      I.ring.count = nh;
      I.soft.instanceMatrix.needsUpdate = true;
      I.hard.instanceMatrix.needsUpdate = true;
      I.ring.instanceMatrix.needsUpdate = true;
      if (I.halo) {
        I.halo.count = ns;
        I.halo.instanceMatrix.needsUpdate = true;
      }

      for (let i = 0; i < sdN; i++) {
        const s = SD[i];
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(s.rx, s.ry, 0);
        dummy.scale.setScalar(s.s * Math.min(1, s.life / 0.35));
        dummy.updateMatrix();
        I.shards.setMatrixAt(i, dummy.matrix);
        I.shards.setColorAt(i, s.c);
      }
      I.shards.count = sdN;
      I.shards.instanceMatrix.needsUpdate = true;
      I.shards.instanceColor.needsUpdate = true;

      // Dust drifts up and wraps around the view; fragments turn slowly far below.
      const dp = dust.geometry.attributes.position, da = dp.array;
      for (let i = 0; i < da.length; i += 3) {
        da[i + 1] += dt * 0.35;
        if (da[i + 1] > 9) da[i + 1] = -14;
        if (da[i + 2] - camZ > 30) da[i + 2] -= 66;
        else if (da[i + 2] - camZ < -36) da[i + 2] += 66;
      }
      dp.needsUpdate = true;
      const fa = I.frags.instanceMatrix.array, fl = I.frags.userData.list;
      for (let i = 0; i < fl.length; i++) {
        const f = fl[i];
        f.r += f.w * dt;
        if (f.z - camZ > 26) f.z -= 60;
        else if (f.z - camZ < -38) f.z += 60;
        setYaw(fa, i, f.x, f.y, f.z, Math.sin(f.r), Math.cos(f.r), f.s);
      }
      I.frags.instanceMatrix.needsUpdate = true;
    }

    function sizeRenderer() {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return false;
      let k = LOW ? 1 : Math.min(api.dpr(), 1.5);
      if (cw * ch * k * k > PIX_CAP) k = Math.sqrt(PIX_CAP / (cw * ch));
      k *= Q.scale;
      const w = Math.max(1, Math.round(cw * k)), h = Math.max(1, Math.round(ch * k));
      if (w !== g.rw || h !== g.rh) {
        g.rw = w;
        g.rh = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      return true;
    }

    // Resolution follows the frame rate: the host's normal frame time is measured on the light title
    // screen, then a slower average during play lowers the scale and steady headroom raises it again.
    function adapt(raw) {
      if (!Q.base) {
        Q.warm.push(raw);
        if (Q.warm.length >= 45) {
          Q.warm.sort((a, b) => a - b);
          Q.base = Math.max(1 / 240, Q.warm[22]);
          Q.warm = [];
        }
        return;
      }
      if (g.mode !== 'play') return;
      Q.acc += raw;
      Q.n++;
      if (Q.acc < 1) return;
      const avg = Q.acc / Q.n;
      Q.acc = 0;
      Q.n = 0;
      if (avg > Q.base * 1.3 + 0.003) {
        if (Q.scale > 0.5) Q.scale = Math.max(0.5, Q.scale * 0.84);
        Q.good = 0;
      } else if (avg < Q.base * 1.1) {
        if (++Q.good >= 4 && Q.scale < Q.max) {
          Q.scale = Math.min(Q.max, Q.scale * 1.1);
          Q.good = 0;
        }
      } else {
        Q.good = 0;
      }
    }

    // ---------- HUD ----------

    function text(str, x, y, size, o) {
      o = o || {};
      const k = api.dpr();
      hx.font = Math.round(size * k) + 'px ' + api.font;
      if ('letterSpacing' in hx) hx.letterSpacing = ((o.spacing !== undefined ? o.spacing : 0.18) * size * k).toFixed(1) + 'px';
      hx.textAlign = o.align || 'left';
      hx.textBaseline = o.base || 'alphabetic';
      hx.globalAlpha = o.alpha === undefined ? 1 : clamp(o.alpha, 0, 1);
      hx.fillStyle = o.color || 'rgb(' + api.colors().ink + ')';
      hx.fillText(str, x, y);
      hx.globalAlpha = 1;
    }

    function wrap(str, maxW, size) {
      hx.font = Math.round(size * api.dpr()) + 'px ' + api.font;
      if ('letterSpacing' in hx) hx.letterSpacing = '0px';
      const out = [];
      let cur = '';
      const pushWord = (w) => {
        const test = cur ? cur + ' ' + w : w;
        if (hx.measureText(test).width <= maxW || !cur) cur = test;
        else { out.push(cur); cur = w; }
      };
      for (const w of String(str).split(' ')) {
        if (hx.measureText(w).width <= maxW) { pushWord(w); continue; }
        for (const ch of w) {
          if (hx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ''; }
          cur += ch;
        }
      }
      if (cur) out.push(cur);
      return out;
    }

    function backdrop(W, H, a) {
      hx.fillStyle = 'rgba(' + api.colors().paper + ',' + a + ')';
      hx.fillRect(0, 0, W, H);
    }

    function button(b, hot, col) {
      const k = api.dpr();
      hx.fillStyle = hot ? 'rgb(' + col.ink + ')' : 'rgba(' + col.paper + ',0.95)';
      hx.fillRect(b.x, b.y, b.w, b.h);
      hx.strokeStyle = 'rgb(' + col.ink + ')';
      hx.lineWidth = k;
      hx.strokeRect(b.x + 0.5 * k, b.y + 0.5 * k, b.w - k, b.h - k);
      text(b.label, b.x + b.w / 2, b.y + b.h / 2 + k, 13, { align: 'center', base: 'middle', spacing: 0.24, color: hot ? col.hl : 'rgb(' + col.ink + ')' });
    }

    function diamond(x, y, r, filled, col) {
      hx.beginPath();
      hx.moveTo(x, y - r);
      hx.lineTo(x + r, y);
      hx.lineTo(x, y + r);
      hx.lineTo(x - r, y);
      hx.closePath();
      if (filled) {
        hx.fillStyle = col;
        hx.fill();
      } else {
        hx.strokeStyle = col;
        hx.lineWidth = api.dpr();
        hx.stroke();
      }
    }

    function toScreen(x, y, z) {
      pv.set(x, y, z).project(camera);
      CP.x = (pv.x + 1) / 2 * canvas.width;
      CP.z = (1 - pv.y) / 2 * canvas.height;
      return pv.z < 1;
    }

    function drawPlayHud(W, H, k, col, t) {
      const m = 24 * k, ink = 'rgb(' + col.ink + ')', ink2 = 'rgba(' + col.ink + ',0.62)', acc = 'rgb(' + col.accent + ')';
      text(T('BREACH {n}', { n: pad(g.stage) }) + '  //  ' + T(KINDS[S.kind].name), m, m + 12 * k, 13, { spacing: 0.3 });
      text(pad(g.score, 6), m, m + 42 * k, 26, { spacing: 0.2 });
      const bw = Math.min(420 * k, W * 0.34), bx = (W - bw) / 2, by = m + 4 * k;
      const f = clamp(g.left / g.timeMax, 0, 1), low = g.left < 6 && g.mode === 'play';
      hx.fillStyle = 'rgba(' + col.ink + ',0.18)';
      hx.fillRect(bx, by, bw, 3 * k);
      hx.fillStyle = low ? acc : ink;
      hx.fillRect(bx, by, bw * f, 3 * k);
      for (let i = 0; i <= 4; i++) hx.fillRect(bx + bw * i / 4 - 0.5 * k, by - 3 * k, k, 9 * k);
      text(g.left.toFixed(1), W / 2, by + 30 * k, 20, { align: 'center', spacing: 0.12, color: low && Math.sin(t * 12) > 0 ? acc : ink });
      for (let i = 0; i < 3; i++) diamond(W - m - (2 - i) * 22 * k - 7 * k, m + 8 * k, 7 * k, i < P.hp, i < P.hp ? ink : ink2);
      if (P.barrier > 0) {
        hx.strokeStyle = acc;
        hx.lineWidth = 1.5 * k;
        hx.strokeRect(W - m - 70 * k, m - 2 * k, 70 * k, 20 * k);
      }
      text(T('INTEGRITY'), W - m, m + 36 * k, 10, { align: 'right', color: ink2, spacing: 0.3 });
      const pf = P.pulse > 0 ? 1 - P.pulse / P.pulseMax : 1, pw = 70 * k, py = m + 46 * k;
      hx.fillStyle = 'rgba(' + col.ink + ',0.18)';
      hx.fillRect(W - m - pw, py, pw, 3 * k);
      hx.fillStyle = pf >= 1 ? acc : ink;
      hx.fillRect(W - m - pw, py, pw * pf, 3 * k);
      text(pf >= 1 ? T('PULSE READY') : T('PULSE'), W - m, py + 16 * k, 10, { align: 'right', color: pf >= 1 ? acc : ink2, spacing: 0.3 });
      for (const c of S.cores) {
        if (c.dead || c.nodes > 0 || c.hp >= c.max) continue;
        if (!toScreen(c.x, 0.95, c.z)) continue;
        const r = 34 * k;
        hx.strokeStyle = 'rgba(' + col.ink + ',0.2)';
        hx.lineWidth = 2 * k;
        hx.beginPath();
        hx.arc(CP.x, CP.z, r, 0, TAU);
        hx.stroke();
        hx.strokeStyle = acc;
        hx.beginPath();
        hx.arc(CP.x, CP.z, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(c.hp / c.max, 0, 1));
        hx.stroke();
      }
      if (g.hint) {
        const age = g.t - g.hint.t0;
        if (age > g.hint.dur) g.hint = null;
        else {
          const a = Math.min(1, age / 0.4, (g.hint.dur - age) / 0.6);
          g.hint.lines.forEach((l, i) => text(l, W / 2, H - m - (g.hint.lines.length - 1 - i) * 22 * k, 12, { align: 'center', alpha: a, color: ink2, spacing: 0.22 }));
        }
      }
    }

    function drawFloats(k, col) {
      for (let i = 0; i < flN; i++) {
        const f = FL[i];
        if (!toScreen(f.x, f.y + f.t * 1.1, f.z)) continue;
        text(f.text, CP.x, CP.z, 12, { align: 'center', alpha: 1 - f.t / f.dur, spacing: 0.15, color: 'rgb(' + col.ink + ')' });
      }
    }

    function drawBanner(W, H, k, col) {
      const b = g.banner;
      if (!b) return;
      const age = g.t - b.t0;
      if (age < 0) return;
      if (age > b.dur) { g.banner = null; return; }
      const a = Math.min(1, age / 0.18, (b.dur - age) / 0.3);
      const y = H * 0.36, bandH = (b.sub ? 92 : 70) * k, spread = easeOut(age / 0.25);
      hx.globalAlpha = a;
      hx.fillStyle = 'rgba(' + col.paper + ',0.78)';
      hx.fillRect(W / 2 - W / 2 * spread, y - 44 * k, W * spread, bandH);
      hx.fillStyle = 'rgb(' + col.ink + ')';
      hx.fillRect(W / 2 - W / 2 * spread, y - 44 * k, W * spread, k);
      hx.fillRect(W / 2 - W / 2 * spread, y - 44 * k + bandH, W * spread, k);
      hx.globalAlpha = 1;
      text(b.text, W / 2, y + 2 * k, 32, { align: 'center', spacing: 0.42, alpha: a, color: b.accent ? 'rgb(' + col.accent + ')' : undefined });
      if (b.sub) text(b.sub, W / 2, y + 30 * k, 13, { align: 'center', spacing: 0.3, alpha: a, color: 'rgba(' + col.ink + ',0.7)' });
    }

    function drawLegend(cx, y, k, col) {
      const gap = 36 * k;
      hx.fillStyle = 'rgb(' + col.accent + ')';
      hx.beginPath();
      hx.arc(cx - gap * 3.6, y - 4 * k, 6 * k, 0, TAU);
      hx.fill();
      text(T('SHOOT IT'), cx - gap * 3.6 + 14 * k, y, 11, { color: 'rgba(' + col.ink + ',0.75)', spacing: 0.25 });
      const hard = pal && pal.dark ? '#b596ea' : '#3a2257', ring = pal && pal.dark ? '#8d66d2' : '#7c55b6';
      hx.fillStyle = hard;
      hx.beginPath();
      hx.arc(cx + gap * 0.8, y - 4 * k, 6 * k, 0, TAU);
      hx.fill();
      hx.strokeStyle = ring;
      hx.lineWidth = 2 * k;
      hx.beginPath();
      hx.arc(cx + gap * 0.8, y - 4 * k, 10 * k, 0, TAU);
      hx.stroke();
      text(T('DODGE IT'), cx + gap * 0.8 + 18 * k, y, 11, { color: 'rgba(' + col.ink + ',0.75)', spacing: 0.25 });
    }

    function drawHud(t) {
      api.fit(canvas, 3000);
      const W = canvas.width, H = canvas.height, k = api.dpr(), col = api.colors();
      const ink2 = 'rgba(' + col.ink + ',0.62)';
      hx.clearRect(0, 0, W, H);
      g.buttons = [];
      if (!g.ready) {
        const msg = g.failed ? T('3D VIEW UNAVAILABLE') : T('LOADING 3D VIEW');
        text(msg, W / 2, H / 2, 16, { align: 'center', spacing: 0.4 });
        if (g.failed) text(T('This PC could not start WebGL. The other drills still work.'), W / 2, H / 2 + 28 * k, 12, { align: 'center', color: ink2 });
        return;
      }
      if (g.lost) {
        text(T('3D VIEW INTERRUPTED'), W / 2, H / 2, 16, { align: 'center', spacing: 0.4 });
        return;
      }
      const m = g.mode;
      if (m === 'play' || m === 'intro' || m === 'clear' || m === 'down' || m === 'paused') drawPlayHud(W, H, k, col, t);
      drawFloats(k, col);
      if (g.hurt > 0) {
        hx.strokeStyle = 'rgba(' + col.accent + ',' + (g.hurt * 0.6).toFixed(3) + ')';
        hx.lineWidth = 14 * k;
        hx.strokeRect(0, 0, W, H);
      }
      if (g.flash > 0 || g.dive > 0) backdrop(W, H, Math.max(g.flash * 0.5, g.dive * g.dive * 0.9));
      drawBanner(W, H, k, col);
      const cx = W / 2, cy = H / 2;
      if (m === 'title') {
        backdrop(W, H, 0.38);
        text(T('BREACH'), cx, cy - 40 * k, 60, { align: 'center', spacing: 0.55 });
        text(T('CORE INTRUSION DRILL'), cx, cy - 6 * k, 13, { align: 'center', spacing: 0.4, color: ink2 });
        if (Math.sin(t * 4) > -0.3) text(T('CLICK TO BEGIN'), cx, cy + 52 * k, 15, { align: 'center', spacing: 0.4 });
        const best = runs[0];
        text(best ? T('TERMINAL RECORD {score}  //  BREACH {n}', { score: pad(best.score, 6), n: pad(best.stages + 1) }) : T('NO RECORD'),
          cx, cy + 80 * k, 11, { align: 'center', color: ink2 });
        text(T(CONTROLS), cx, H - 60 * k, 11, { align: 'center', color: ink2, spacing: 0.25 });
        drawLegend(cx, H - 32 * k, k, col);
      } else if (m === 'paused') {
        backdrop(W, H, 0.55);
        text(T('PAUSED'), cx, cy - 10 * k, 34, { align: 'center', spacing: 0.4 });
        text(T('CLICK TO RESUME'), cx, cy + 24 * k, 13, { align: 'center', color: ink2, spacing: 0.3 });
      } else if (m === 'patch') {
        backdrop(W, H, Math.min(0.6, g.modeT * 2));
        text(T('SELECT PATCH'), cx, H * 0.3, 30, { align: 'center', spacing: 0.42 });
        text(T('BREACH {n} CLEARED  //  CHOOSE ONE UPGRADE FOR THIS RUN', { n: pad(g.stage) }), cx, H * 0.3 + 28 * k, 12, { align: 'center', color: ink2, spacing: 0.25 });
        const n = g.cards.length, gap = 18 * k, cw = Math.min(250 * k, (W - 80 * k - gap * (n - 1)) / n), ch = 150 * k;
        const x0 = (W - (cw * n + gap * (n - 1))) / 2, y0 = H * 0.42;
        g.cards.forEach((c, i) => {
          const x = x0 + i * (cw + gap), hot = g.hot === c.id, rise = easeOut((g.modeT - i * 0.08) / 0.3);
          const y = y0 + (1 - rise) * 30 * k;
          c.rect = { x: x, y: y, w: cw, h: ch };
          hx.globalAlpha = rise;
          hx.fillStyle = hot ? 'rgb(' + col.ink + ')' : 'rgba(' + col.paper + ',0.96)';
          hx.fillRect(x, y, cw, ch);
          hx.strokeStyle = 'rgb(' + col.ink + ')';
          hx.lineWidth = k;
          hx.strokeRect(x + 0.5 * k, y + 0.5 * k, cw - k, ch - k);
          hx.globalAlpha = 1;
          const fg = hot ? col.hl : 'rgb(' + col.ink + ')';
          text(T(c.p.name), x + 16 * k, y + 32 * k, 15, { spacing: 0.25, color: fg, alpha: rise });
          wrap(T(c.p.desc), cw - 32 * k, 12).forEach((l, j) => text(l, x + 16 * k, y + 60 * k + j * 18 * k, 12, { spacing: 0.04, color: fg, alpha: rise * 0.85 }));
          for (let p = 0; p < c.p.max; p++) diamond(x + 20 * k + p * 16 * k, y + ch - 20 * k, 5 * k, p < up[c.id], fg);
        });
      } else if (m === 'over') {
        backdrop(W, H, 0.6);
        text(g.reason === 'time' ? T('TIME EXPIRED') : T('INTEGRITY LOST'), cx, cy - 70 * k, 32, { align: 'center', spacing: 0.3, color: 'rgb(' + col.accent + ')' });
        const stages = Math.max(0, g.stage - 1);
        text(T('SCORE {score}   //   {stages}', { score: pad(g.score, 6), stages: TN(stages, '{n} BREACH CLEARED|{n} BREACHES CLEARED') }),
          cx, cy - 30 * k, 14, { align: 'center' });
        text(T('ACCURACY {acc}%', { acc: Math.round(Math.min(1, g.fired ? g.hits / g.fired : 0) * 100) }), cx, cy - 8 * k, 12, { align: 'center', color: ink2 });
        if (g.newBest) text(T('NEW TERMINAL RECORD'), cx, cy + 12 * k, 12, { align: 'center', spacing: 0.4, color: ink2 });
        const bw = 150 * k, bh = 40 * k, gp = 16 * k;
        g.buttons = [
          { id: 'retry', label: T('RETRY'), x: cx - bw - gp / 2, y: cy + 34 * k, w: bw, h: bh },
          { id: 'back', label: T('BACK'), x: cx + gp / 2, y: cy + 34 * k, w: bw, h: bh }
        ];
        g.buttons.forEach((b) => button(b, g.hot === b.id, col));
      }
    }

    // ---------- input ----------

    function pointer(e) {
      const r = canvas.getBoundingClientRect();
      const u = (e.clientX - r.left) / Math.max(1, r.width), v = (e.clientY - r.top) / Math.max(1, r.height);
      g.px = u * canvas.width;
      g.py = v * canvas.height;
      if (ndc) ndc.set(u * 2 - 1, -(v * 2 - 1));
      g.hasMouse = true;
    }

    function hitRect(list) {
      for (const b of list) {
        const r = b.rect || b;
        if (r && g.px >= r.x && g.px <= r.x + r.w && g.py >= r.y && g.py <= r.y + r.h) return b.id;
      }
      return '';
    }

    canvas.addEventListener('pointermove', (e) => {
      if (!g.visible) return;
      pointer(e);
      g.hot = g.mode === 'patch' ? hitRect(g.cards) : g.mode === 'over' ? hitRect(g.buttons) : '';
    });
    canvas.addEventListener('pointerleave', () => {
      pause();
      g.hot = '';
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!g.visible || e.button > 0 || !g.ready) return;
      pointer(e);
      switch (g.mode) {
        case 'title':
          start();
          break;
        case 'paused':
          g.mode = g.prev || 'play';
          break;
        case 'play':
          pulse();
          break;
        case 'patch': {
          const id = hitRect(g.cards);
          if (id && g.modeT > 0.35) pickPatch(id);
          break;
        }
        case 'over': {
          if (performance.now() - g.overAt < 700) return;
          const id = hitRect(g.buttons);
          if (id === 'retry') start();
          else if (id === 'back') toTitle();
          break;
        }
        default:
          break;
      }
    });

    const api3d = {
      show() {
        g.visible = true;
        clearTimeout(releaseTimer);
      },
      hide() {
        g.visible = false;
        pause();
        clearTimeout(releaseTimer);
        const inRun = g.mode !== 'title' && g.mode !== 'over';
        releaseTimer = setTimeout(() => { if (!g.visible) release(); }, inRun ? 300000 : 30000);
      },
      busy() {
        return g.visible && (g.mode === 'play' || g.mode === 'intro' || g.mode === 'clear' || g.mode === 'down');
      },
      stats() {
        return { runs: runs, last: last };
      },
      frame(dt, t) {
        if (!g.visible) return;
        dt = Math.min(0.05, Math.max(0, dt || 0));
        if (!g.ready) {
          if (!g.loading && !g.failed) init();
          drawHud(t || 0);
          return;
        }
        if (g.lost) {
          drawHud(t || 0);
          return;
        }
        adapt(dt);
        const live = g.mode === 'play' || g.mode === 'intro' || g.mode === 'clear' || g.mode === 'down';
        g.acc += dt;
        if (!live && g.acc < 1 / 31) return;
        const raw = live ? dt : Math.min(0.05, g.acc);
        g.acc = 0;
        if (!sizeRenderer()) return;
        applyPalette(false);
        g.t += raw;
        const sdt = step(raw);
        const camZ = placeCamera(raw, g.t);
        syncScene(sdt, g.t, camZ);
        renderer.render(scene, camera);
        drawHud(g.t);
        canvas.style.cursor = g.mode === 'play' || g.mode === 'intro' ? 'none' : 'default';
      }
    };

    if (api.debug) {
      api3d.debug = {
        g: g, P: P, S: S, Q: Q, up: up,
        info() {
          return {
            mode: g.mode, stage: g.stage, kind: S.kind, score: g.score, hp: P.hp, left: g.left,
            bullets: ebN, shots: shN, shards: sdN, solids: S.solids.filter((o) => !o.dead).length,
            cores: S.cores.filter((c) => !c.dead).length, scale: Q.scale, base: Q.base, low: LOW,
            size: [g.rw, g.rh], calls: renderer ? renderer.info.render.calls : 0, tris: renderer ? renderer.info.render.triangles : 0,
            geos: renderer ? renderer.info.memory.geometries : 0, ready: g.ready
          };
        },
        start: start,
        stage(kind) {
          if (g.mode === 'title' || g.mode === 'over') start();
          buildStage(kind, false);
          g.mode = 'intro';
          g.modeT = 0;
        },
        win() {
          S.cores.forEach((c) => { if (!c.dead) { c.nodes = 0; damage(c, 9999); } });
        },
        god(on) { g.god = !!on; },
        release: release
      };
    }
    return api3d;
  }

  window.YoRHaGames3D = Object.assign(window.YoRHaGames3D || {}, { breach: breach });
})();
