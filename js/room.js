// The room backdrop: a wall colour and a floor (drawn in perspective), or a photo
// of her own room. Used on the board, in room thumbnails and in shared pictures.
import { FLOOR_LINE, DEFAULT_BACKDROP, floorById, shapeById } from './constants.js';
import { blobToImage } from './images.js';

/** Board height / width for a backdrop. A photo keeps its own shape (within limits). */
export function aspectOf(bd) {
  if (bd?.photo && bd.photoW && bd.photoH) return Math.max(0.56, Math.min(1.78, bd.photoH / bd.photoW));
  return shapeById(bd?.shape).aspect;
}

export function normalizeBackdrop(bd) {
  return { ...DEFAULT_BACKDROP, ...(bd || {}) };
}

const photoCache = new WeakMap(); // Blob -> Promise<HTMLImageElement>
export function backdropPhoto(bd) {
  if (!bd?.photo) return Promise.resolve(null);
  let p = photoCache.get(bd.photo);
  if (!p) { p = blobToImage(bd.photo).catch(() => null); photoCache.set(bd.photo, p); }
  return p;
}

/** Simple repeatable pseudo-random numbers, so speckles don't jump around. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Draws the backdrop into a W x H area of a canvas context (async only for photos). */
export async function drawBackdrop(ctx, bd, W, H) {
  bd = normalizeBackdrop(bd);
  const photo = await backdropPhoto(bd);
  paintBackdrop(ctx, bd, W, H, photo);
}

/** Synchronous version, with the photo (if any) already loaded. */
export function paintBackdrop(ctx, bd, W, H, photo) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (photo) {
    // Cover the area, centred.
    const s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const w = photo.naturalWidth * s, h = photo.naturalHeight * s;
    ctx.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h);
    ctx.restore();
    return;
  }

  // Wall, a little lighter at the top.
  ctx.fillStyle = bd.wall;
  ctx.fillRect(0, 0, W, H);
  const wg = ctx.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, 'rgba(255,255,255,.10)');
  wg.addColorStop(1, 'rgba(0,0,0,.06)');
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, W, H);

  const f = floorById(bd.floor);
  if (f.kind === 'none') { ctx.restore(); return; }

  const y0 = Math.round(FLOOR_LINE * H);
  ctx.fillStyle = f.base;
  ctx.fillRect(0, y0, W, H - y0);

  const lw = Math.max(1, W / 420);
  ctx.strokeStyle = f.line;
  ctx.lineWidth = lw;
  // Vanishing point high above the middle of the floor line: gentle perspective.
  const vx = W / 2, vy = y0 - H * 1.4;
  const atFloorLine = (xb) => vx + (xb - vx) * (y0 - vy) / (H - vy);

  if (f.kind === 'planks' || f.kind === 'tiles') {
    const n = f.kind === 'planks' ? f.planks || 14 : 7;
    const step = (W * 2) / n;
    ctx.beginPath();
    for (let xb = -W / 2; xb <= W * 1.5 + 1; xb += step) {
      ctx.moveTo(atFloorLine(xb), y0);
      ctx.lineTo(xb, H);
    }
    ctx.stroke();
  }
  if (f.kind === 'tiles') {
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      const y = y0 + (H - y0) * Math.pow(k / 6, 1.5);
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
  }
  if (f.kind === 'planks') {
    // Staggered plank ends.
    const r = rng(7);
    const n = f.planks || 14, step = (W * 2) / n, joints = f.joints || 3;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const xa = -W / 2 + i * step, xb2 = xa + step;
      for (let k = 0; k < joints; k++) {
        const t = Math.pow((k + r()) / joints, 1.4);
        const y = y0 + (H - y0) * t;
        const u = (y - vy) / (H - vy);
        const x1 = vx + (xa - vx) * u, x2 = vx + (xb2 - vx) * u;
        ctx.moveTo(x1, y); ctx.lineTo(x2, y);
      }
    }
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (f.kind === 'speckle') {
    const r = rng(11);
    const colors = [f.line, '#B9A994', '#9FA7A1', '#C9A48E'];
    for (let i = 0; i < 260; i++) {
      const y = y0 + (H - y0) * r();
      const depth = (y - y0) / (H - y0);
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(W * r(), y, (0.6 + r() * 1.6) * lw * (0.5 + depth), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Floor darker towards the wall.
  const fg = ctx.createLinearGradient(0, y0, 0, H);
  fg.addColorStop(0, 'rgba(0,0,0,.16)');
  fg.addColorStop(0.5, 'rgba(0,0,0,.03)');
  fg.addColorStop(1, 'rgba(255,255,255,.04)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, y0, W, H - y0);

  // Skirting board.
  const sk = Math.max(3, H * 0.018);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(0, y0 - sk, W, sk);
  ctx.fillStyle = 'rgba(0,0,0,.10)';
  ctx.fillRect(0, y0 - lw, W, lw);
  ctx.restore();
}
