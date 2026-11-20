// Dev-only (not installed): turns the frames recorded with tools/capture.html into a Workshop preview under 1 MB.
//
// Why: the browser pane's captures carry light JPEG-style ringing around edges, and in BREACH the camera follows the
// probe, so that noise shifts every frame and the GIF balloons (about 30 KB a frame at 400 px). This script:
//   - holds each pixel at the colour last shown unless it moves more than T (sum of RGB diffs) away, which drops the
//     noise; keep T below the contrast of real lines (15 is safe, 40 leaves ghost trails on the BREACH grid);
//   - from frame index HALF on, repeats every other frame, so that part plays at half rate (a repeat costs ~nothing).
//
// Pipeline used for the 2026-11-18 preview (151 frames f001-f151, 352 px, 128 colours, 854 KB):
//   ffmpeg -framerate 12.5 -start_number 1 -i frames/f%03d.png -vf scale=352:352:flags=area -f rawvideo -pix_fmt rgb24 all.rgb
//   node gif-prep.cjs all.rgb prep.rgb 352 15 80
//   ffmpeg -f rawvideo -pix_fmt rgb24 -s 352x352 -framerate 12.5 -i prep.rgb
//     -vf "split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle"
//     -loop 0 preview.gif
//
// Usage: node gif-prep.cjs in.rgb out.rgb SIZE T HALF
'use strict';
const fs = require('fs');
const [, , inp, outp, sizeArg, tArg, halfArg] = process.argv;
if (!inp || !outp || !sizeArg) {
  console.log('Usage: node gif-prep.cjs in.rgb out.rgb SIZE T HALF');
  process.exit(1);
}
const W = Number(sizeArg), T = Number(tArg || 15), HALF = Number(halfArg || Infinity), FS = W * W * 3;
const buf = fs.readFileSync(inp);
const n = buf.length / FS;
if (!Number.isInteger(n)) {
  console.log('[ERROR] input size is not a whole number of ' + W + 'x' + W + ' RGB frames');
  process.exit(1);
}
const out = Buffer.alloc(buf.length);
buf.copy(out, 0, 0, FS);
for (let f = 1; f < n; f++) {
  const cur = f * FS, prev = (f - 1) * FS;
  if (f >= HALF && (f - HALF) % 2 === 1) {
    out.copy(out, cur, prev, prev + FS);
    continue;
  }
  for (let p = 0; p < FS; p += 3) {
    const d = Math.abs(buf[cur + p] - out[prev + p]) +
      Math.abs(buf[cur + p + 1] - out[prev + p + 1]) +
      Math.abs(buf[cur + p + 2] - out[prev + p + 2]);
    const src = d <= T ? out : buf, at = d <= T ? prev : cur;
    out[cur + p] = src[at + p];
    out[cur + p + 1] = src[at + p + 1];
    out[cur + p + 2] = src[at + p + 2];
  }
}
fs.writeFileSync(outp, out);
console.log('[OK] ' + n + ' frames written to ' + outp);
