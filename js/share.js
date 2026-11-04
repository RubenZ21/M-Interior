// Sharing a room as a picture (WhatsApp, Messages, email … via the phone's share menu).
import { roomTypeById } from './constants.js';
import { makeCanvas, canvasToBlob } from './images.js';
import { drawRoom } from './builder.js';
import { aspectOf } from './room.js';

const W = 1440;
const M = 40;        // margin around the room
const FOOTER = 190;

/** Room picture with its name and room type underneath. */
export async function roomImage(room, itemMap) {
  const bw = W - 2 * M, bh = Math.round(bw * aspectOf(room.backdrop));
  const c = makeCanvas(W, bh + M + FOOTER);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4EFE8';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.save();
  ctx.translate(M, M);
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(0, 0, bw, bh, 24) : ctx.rect(0, 0, bw, bh);
  ctx.clip();
  await drawRoom(ctx, room, itemMap, bw, bh);
  ctx.restore();

  try { await document.fonts?.load('500 76px "Cormorant Garamond"'); } catch { /* fall back to Georgia */ }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2F2925';
  ctx.font = '500 76px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(room.name || 'My room', W / 2, M + bh + 92, W - 120);
  if (room.type) {
    ctx.fillStyle = '#8E4529';
    ctx.font = '600 34px Karla, system-ui, sans-serif';
    ctx.fillText(roomTypeById(room.type).label.toUpperCase(), W / 2, M + bh + 148, W - 120);
  }
  return canvasToBlob(c, 'image/jpeg', 0.92);
}

// A picture made but not shared yet: the phone only allows the share menu right
// after a tap, so if drawing took too long the next tap shares this one.
let ready = null;

/**
 * Opens the share menu with the room picture. Returns 'shared', 'cancelled',
 * 'downloaded' (no share menu, e.g. on a computer) or 'again' (tap once more).
 */
export async function shareRoom(room, itemMap) {
  const key = JSON.stringify([room.name, room.type, { ...room.backdrop, photo: room.backdrop?.photo?.size }, room.pieces]);
  let file = ready?.key === key ? ready.file : null;
  if (!file) {
    const blob = await roomImage(room, itemMap);
    const plain = (room.name || 'room').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');
    const slug = plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room';
    file = new File([blob], `${slug}.jpg`, { type: 'image/jpeg' });
  }
  ready = null;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: room.name, text: room.name });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      if (err.name === 'NotAllowedError') { ready = { key, file }; return 'again'; }
      console.warn('Share failed', err);
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return 'downloaded';
}
