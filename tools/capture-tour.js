/* Dev-only tour for tools/capture.html: the Workshop preview, 152 frames at 80 ms (12.16 s).
   Hub (menu hover down to HACKING and GARDEN) -> wipe -> GARDEN planting -> wipe -> BREACH title, dive and play.
   Crops change only on frames where the wipe covers the screen. */
(function () {
  'use strict';
  const cap = window.cap;
  cap.TOTAL = 152;
  const CROP = {
    hub: [510, 470, 900],
    garden: [1164, 690, 620],
    breach: [1157, 559, 750]
  };

  // Fresh state for the dev origin: no saved flowers, no BREACH records.
  try {
    localStorage.removeItem('yorha.garden.flowers');
    localStorage.removeItem('yorha.breach.runs');
    localStorage.removeItem('yorha.breach.last');
  } catch (e) { /* ignore */ }

  cap.start = async function () {
    const wp = document.getElementById('wp');
    if (!wp.contentWindow || wp.contentDocument.readyState !== 'complete') {
      await new Promise((r) => wp.addEventListener('load', r, { once: true }));
    }
    // three.js ready before BREACH is opened, so no frame shows the loading text.
    const d = wp.contentDocument;
    if (!wp.contentWindow.THREE) {
      await new Promise((r) => {
        const s = d.createElement('script');
        s.src = '../vendor/three.min.js';
        s.onload = r;
        s.onerror = r;
        d.head.appendChild(s);
      });
    }
    await new Promise((r) => setTimeout(r, 1800)); // let start-up timers and the first panel settle
    cap.virtualize();
    cap.crop.apply(null, CROP.hub);
    for (let i = 0; i < 6; i++) cap.step(cap.FRAME);
    cap.info('ready');
    return 'ready';
  };

  const menu = (p) => cap.$('#menu li[data-panel="' + p + '"]');
  const hover = (el) => el && el.dispatchEvent(new cap.W.MouseEvent('mouseenter', { bubbles: false }));
  function gardenPlant(x) {
    const c = cap.$('#g-garden'), r = c.getBoundingClientRect();
    cap.fire(c, 'pointermove', r.width * x, r.height * 0.8);
    cap.fire(c, 'pointerdown', r.width * x, r.height * 0.8);
    cap.fire(c, 'pointerup', r.width * x, r.height * 0.8);
  }
  function gardenMove(x, y) {
    const c = cap.$('#g-garden'), r = c.getBoundingClientRect();
    cap.fire(c, 'pointermove', r.width * x, r.height * y);
  }
  function breachPointer(type, x, y) {
    const c = cap.$('#g-breach'), r = c.getBoundingClientRect();
    cap.fire(c, type, r.width * x, r.height * y);
  }

  const PLANTS = { 38: 0.47, 41: 0.56, 44: 0.4, 47: 0.62, 50: 0.51, 53: 0.34, 56: 0.67, 59: 0.44 };
  const START = 90; // frame of the click that starts the BREACH run

  // Apply what happens on frame i, then advance the clock by one frame.
  cap.frame = async function (i) {
    // Hub: the menu cursor walks down, the panel previews each place.
    // ARCHIVE is skipped: the preview stays free of character art, like the previous one.
    const hubHover = { 0: 'map', 6: 'quests', 12: 'intel', 18: 'hacking', 25: 'garden' };
    if (hubHover[i]) hover(menu(hubHover[i]));
    if (i === 29) menu('garden').click();
    if (i === 34) cap.crop.apply(null, CROP.garden);
    // Garden: plant a row of Lunar Tears, then sweep the cursor to stir the wind.
    if (PLANTS[i] !== undefined) gardenPlant(PLANTS[i]);
    if (i >= 61 && i <= 72) gardenMove(0.3 + (i - 61) * 0.05, 0.55 + 0.05 * Math.sin(i));
    // To HACKING: the wipe covers frames ~76-80, the BREACH title holds ~81-89, then a run.
    if (i === 74) cap.$('#tab-list li[data-place="hacking"]').click();
    if (i === 79) cap.crop.apply(null, CROP.breach);
    if (i === START) {
      breachPointer('pointermove', 0.5, 0.72);
      breachPointer('pointerdown', 0.5, 0.72);
    }
    if (i > START) {
      const k = i - START;
      breachPointer('pointermove', 0.5 + 0.17 * Math.sin(k / 7), 0.62 + 0.12 * Math.cos(k / 9));
    }
    if (i === START + 49) breachPointer('pointerdown', 0.5 + 0.17 * Math.sin(49 / 7), 0.62 + 0.12 * Math.cos(49 / 9));
    cap.step(cap.FRAME);
    cap.info('frame ' + i + ' / ' + cap.TOTAL);
    // Wait for two real repaints of the pane (or 250 ms if it is throttled) so the capture shows this frame.
    await Promise.race([
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      new Promise((r) => setTimeout(r, 250))
    ]);
    await new Promise((r) => setTimeout(r, 120));
    return i;
  };
})();
