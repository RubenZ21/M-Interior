// Room builder: a board with a wall and floor (or a photo of her room) where
// pieces are moved (drag), resized and rotated (pinch, or the corner handle),
// layered, copied and mirrored.
import { ROOM_TYPES, PLACEMENT, WALLS, FLOORS, SHAPES, categoriesFor, revealSelected } from './constants.js';
import { esc, uid, blobUrl, toast } from './util.js';
import { shareRoom } from './share.js';
import { icon } from './icons.js';
import { makeCanvas, blobToImage, canvasToBlob, fileToCanvas } from './images.js';
import { aspectOf, normalizeBackdrop, backdropPhoto, paintBackdrop, drawBackdrop } from './room.js';

export function renderBuilder(root, { room, items, startItemId, onSave, onDelete, onDuplicate, onRename, onClose }) {
  const itemMap = new Map(items.map((i) => [i.id, i]));
  let pieces = (room?.pieces || []).filter((p) => itemMap.has(p.itemId)).map((p) => ({ ...p, key: uid() }));
  let backdrop = normalizeBackdrop(room?.backdrop);
  let photo = null; // loaded backdrop photo
  let selKey = null;
  let dirty = false;
  let roomName = room?.name || '';
  const cats = categoriesFor(items).filter((c) => items.some((i) => i.category === c.id));
  let tab = cats[0]?.id;

  root.className = 'app no-tabbar builder-host';
  root.innerHTML = `
    <div class="builder">
      <div class="topbar">
        <button type="button" class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>
        <h1><button type="button" class="title-btn" data-act="rename"><span class="visually-hidden">Rename room: </span><span id="title">${esc(roomName || 'New room')}</span>${icon('pencil')}</button></h1>
        <div class="right top-actions">
          <button type="button" class="icon-btn" data-act="share" aria-label="Share room">${icon('share')}</button>
          <button type="button" class="btn-small" data-act="save">Save</button>
        </div>
      </div>
      <div class="board-wrap" id="bw">
        <div class="board" id="board" aria-label="Room board">
          <canvas class="backdrop" id="bd" aria-hidden="true"></canvas>
          <p class="board-hint" id="hint">Tap furniture below to place it in the room</p>
          <div class="frame" id="frame" hidden><span class="handle" id="handle" aria-hidden="true"></span></div>
        </div>
      </div>
      <!-- Own row under the board, so it never covers furniture. -->
      <div class="tools-strip">
        <div class="sel-tools empty" id="tools" role="toolbar" aria-label="Selected piece">
          <button type="button" class="sel-hint-btn" data-act="walls">${icon('palette')} Walls &amp; floor</button>
          <button type="button" data-act="front">${icon('front')} Front</button>
          <button type="button" data-act="backward">${icon('backLayer')} Back</button>
          <button type="button" data-act="copy">${icon('copy')} Copy</button>
          <button type="button" data-act="mirror">${icon('mirror')} Mirror</button>
          <button type="button" data-act="remove" aria-label="Remove">${icon('trash')}</button>
        </div>
      </div>
      <div class="drawer">
        ${cats.length ? `<div class="chips scroll-x" role="tablist" aria-label="Category" id="tabs"></div>
        <div class="drawer-grid" id="dgrid"></div>` : `<p class="empty-drawer">Add some furniture first, then come back to make a room.</p>`}
      </div>
    </div>`;

  const board = root.querySelector('#board');
  const wrap = root.querySelector('#bw');
  const frame = root.querySelector('#frame');
  const tools = root.querySelector('#tools');
  const hint = root.querySelector('#hint');
  const bdCanvas = root.querySelector('#bd');
  const els = new Map(); // key -> <img>
  const alpha = new Map(); // itemId -> { w, h, data } for tapping through transparent parts

  // ---- sizing ----
  let W = 300, H = 225;
  function size() {
    const r = wrap.getBoundingClientRect();
    const aspect = aspectOf(backdrop);
    const availW = r.width - 24, availH = r.height - 16;
    W = Math.max(120, Math.min(availW, availH / aspect));
    H = W * aspect;
    board.style.width = `${W}px`;
    board.style.height = `${H}px`;
    paintBoardBackdrop();
    layout();
  }
  const ro = new ResizeObserver(size);
  ro.observe(wrap);

  function paintBoardBackdrop() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bdCanvas.width = Math.round(W * dpr);
    bdCanvas.height = Math.round(H * dpr);
    bdCanvas.style.width = `${W}px`;
    bdCanvas.style.height = `${H}px`;
    const ctx = bdCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackdrop(ctx, backdrop, W, H, photo);
  }

  async function loadPhoto() {
    photo = await backdropPhoto(backdrop);
    size();
  }

  // ---- rendering ----
  function pieceBox(p) {
    const it = itemMap.get(p.itemId);
    const w = p.w * W;
    return { w, h: w * (it.h / it.w), cx: p.x * W, cy: p.y * H };
  }

  function ensureEls() {
    for (const p of pieces) {
      if (els.has(p.key)) continue;
      const it = itemMap.get(p.itemId);
      const img = document.createElement('img');
      img.className = 'piece';
      img.alt = it.name;
      img.draggable = false;
      img.src = blobUrl(`i:${it.id}`, it.image);
      board.insertBefore(img, frame);
      els.set(p.key, img);
      loadAlpha(it);
    }
    for (const [key, el] of els) {
      if (!pieces.some((p) => p.key === key)) { el.remove(); els.delete(key); }
    }
  }

  function layout() {
    ensureEls();
    pieces.forEach((p, i) => {
      const el = els.get(p.key);
      const b = pieceBox(p);
      Object.assign(el.style, {
        width: `${b.w}px`, height: `${b.h}px`, left: `${b.cx - b.w / 2}px`, top: `${b.cy - b.h / 2}px`,
        transform: `rotate(${p.rot || 0}rad) scaleX(${p.flip ? -1 : 1})`, zIndex: String(i + 1)
      });
    });
    const sel = pieces.find((p) => p.key === selKey);
    frame.hidden = !sel;
    tools.classList.toggle('empty', !sel);
    if (sel) {
      const b = pieceBox(sel);
      Object.assign(frame.style, {
        width: `${b.w}px`, height: `${b.h}px`, left: `${b.cx - b.w / 2}px`, top: `${b.cy - b.h / 2}px`,
        transform: `rotate(${sel.rot || 0}rad)`
      });
    }
    hint.hidden = pieces.length > 0;
  }

  function renderDrawer(smooth = false) {
    if (!cats.length) return;
    root.querySelector('#tabs').innerHTML = cats.map((c) =>
      `<button type="button" class="chip" role="tab" data-act="tab" data-id="${c.id}" aria-selected="${c.id === tab}">${c.label}</button>`).join('');
    revealSelected(root.querySelector('#tabs'), smooth);
    const used = new Map();
    for (const p of pieces) used.set(p.itemId, (used.get(p.itemId) || 0) + 1);
    root.querySelector('#dgrid').innerHTML = items.filter((i) => i.category === tab).map((i) => {
      const n = used.get(i.id) || 0;
      return `<button type="button" class="dtile${n ? ' used' : ''}" data-act="add" data-id="${i.id}" aria-label="${esc(i.name)}${n ? ` (${n} in the room)` : ''}">
        <img src="${blobUrl(`t:${i.id}`, i.thumb)}" alt="">
        ${n ? `<span class="tick">${n > 1 ? n : icon('check')}</span>` : ''}
      </button>`;
    }).join('');
  }

  async function loadAlpha(it) {
    if (alpha.has(it.id)) return;
    alpha.set(it.id, null);
    try {
      const img = await blobToImage(it.thumb);
      const c = makeCanvas(Math.min(96, img.naturalWidth), Math.min(96, img.naturalWidth) * img.naturalHeight / img.naturalWidth);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      alpha.set(it.id, { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data });
    } catch { /* fall back to box hit-testing */ }
  }

  // Board-local point -> piece-local (0..1) coordinates, or null when outside.
  function local(p, x, y) {
    const b = pieceBox(p);
    const dx = x - b.cx, dy = y - b.cy;
    const r = -(p.rot || 0);
    const lx = dx * Math.cos(r) - dy * Math.sin(r);
    const ly = dx * Math.sin(r) + dy * Math.cos(r);
    let u = lx / b.w + 0.5;
    const v = ly / b.h + 0.5;
    if (p.flip) u = 1 - u;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
  }

  function hitTest(x, y) {
    const sel = pieces.find((p) => p.key === selKey);
    if (sel && local(sel, x, y)) return sel;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      const l = local(p, x, y);
      if (!l) continue;
      const a = alpha.get(p.itemId);
      if (!a) return p;
      const px = Math.min(a.w - 1, Math.floor(l.u * a.w));
      const py = Math.min(a.h - 1, Math.floor(l.v * a.h));
      if (a.data[(py * a.w + px) * 4 + 3] > 24) return p;
    }
    return null;
  }

  function select(key) {
    selKey = key;
    layout();
  }

  // Furniture can be used more than once (two chairs, a pair of lamps …): every tap adds one.
  function addPiece(itemId) {
    const it = itemMap.get(itemId);
    const d = PLACEMENT[it.category] || { x: 0.5, y: 0.5, w: 0.3 };
    let w = d.w;
    const hFrac = (w * W * it.h / it.w) / H; // keep tall pieces from filling the board
    if (hFrac > 0.7) w *= 0.7 / hFrac;
    const same = pieces.filter((p) => itemMap.get(p.itemId).category === it.category).length;
    const p = { key: uid(), itemId, x: Math.min(0.92, d.x + same * 0.06), y: Math.min(0.94, d.y + same * 0.03), w, rot: 0, flip: false };
    // Rugs go under everything else.
    if (it.category === 'rugs') pieces.unshift(p); else pieces.push(p);
    dirty = true;
    select(p.key);
    renderDrawer();
  }

  // ---- gestures ----
  const pts = new Map();
  let g = null;
  const boardPoint = (e) => {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function startPinch(p) {
    const [a, b] = [...pts.values()];
    g = { type: 'pinch', p, d0: dist(a, b) || 1, a0: angle(a, b), w0: p.w, r0: p.rot || 0,
      m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, x0: p.x, y0: p.y };
  }

  board.addEventListener('pointerdown', (e) => {
    const pt = boardPoint(e);
    board.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, pt);
    const sel = pieces.find((p) => p.key === selKey);
    if (pts.size === 2 && sel) { startPinch(sel); return; }
    if (pts.size > 1) return;
    if (e.target.closest('#handle') && sel) {
      const b = pieceBox(sel);
      g = { type: 'resize', p: sel, d0: Math.hypot(pt.x - b.cx, pt.y - b.cy) || 1, w0: sel.w };
      return;
    }
    const hit = hitTest(pt.x, pt.y);
    if (hit) {
      select(hit.key);
      g = { type: 'move', p: hit, s: pt, x0: hit.x, y0: hit.y };
    } else {
      select(null);
      g = null;
    }
  });

  board.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const pt = boardPoint(e);
    pts.set(e.pointerId, pt);
    if (!g) return;
    const p = g.p;
    if (g.type === 'move') {
      p.x = clamp(g.x0 + (pt.x - g.s.x) / W, 0, 1);
      p.y = clamp(g.y0 + (pt.y - g.s.y) / H, 0, 1);
    } else if (g.type === 'resize') {
      const b = pieceBox(p);
      p.w = clamp(g.w0 * Math.hypot(pt.x - b.cx, pt.y - b.cy) / g.d0, 0.03, 1.6);
    } else if (g.type === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      p.w = clamp(g.w0 * dist(a, b) / g.d0, 0.03, 1.6);
      p.rot = g.r0 + angle(a, b) - g.a0;
      p.x = clamp(g.x0 + ((a.x + b.x) / 2 - g.m0.x) / W, 0, 1);
      p.y = clamp(g.y0 + ((a.y + b.y) / 2 - g.m0.y) / H, 0, 1);
    }
    dirty = true;
    layout();
  });

  const up = (e) => {
    pts.delete(e.pointerId);
    if (g?.type === 'pinch' && pts.size === 1) {
      const [pt] = [...pts.values()];
      g = { type: 'move', p: g.p, s: pt, x0: g.p.x, y0: g.p.y };
    } else if (pts.size === 0) {
      g = null;
    }
  };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', up);

  // Snap small rotations back to straight so furniture doesn't end up slightly tilted.
  board.addEventListener('pointerup', () => {
    const p = pieces.find((q) => q.key === selKey);
    if (p && Math.abs(p.rot || 0) < 0.06) { p.rot = 0; layout(); }
  });

  const cleanPieces = () => pieces.map(({ key, ...p }) => p);

  // ---- actions ----
  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const i = pieces.findIndex((p) => p.key === selKey);
    if (act === 'back') {
      if (dirty && !confirm('Leave without saving this room?')) return;
      onClose();
    } else if (act === 'save') openSaveSheet();
    else if (act === 'share') {
      if (!pieces.length) { alert('Add some furniture to the room first.'); return; }
      const result = await shareRoom({ name: roomName || 'My room', type: room?.type, backdrop, pieces: cleanPieces() }, itemMap);
      if (result === 'downloaded') toast('Picture saved to your downloads');
      else if (result === 'again') toast('Picture ready. Tap share again');
    }
    else if (act === 'rename') openRenameSheet();
    else if (act === 'walls') openBackdropSheet();
    else if (act === 'tab') { tab = b.dataset.id; renderDrawer(true); }
    else if (act === 'add') addPiece(b.dataset.id);
    else if (i >= 0 && act === 'front') { pieces.push(...pieces.splice(i, 1)); dirty = true; layout(); }
    else if (i >= 0 && act === 'backward') { pieces.unshift(...pieces.splice(i, 1)); dirty = true; layout(); }
    else if (i >= 0 && act === 'mirror') { pieces[i].flip = !pieces[i].flip; dirty = true; layout(); }
    else if (i >= 0 && act === 'copy') {
      const src = pieces[i];
      const p = { ...src, key: uid(), x: clamp(src.x + 0.06, 0, 1), y: clamp(src.y + 0.02, 0, 1) };
      pieces.splice(i + 1, 0, p);
      dirty = true;
      select(p.key);
      renderDrawer();
    }
    else if (i >= 0 && act === 'remove') { pieces.splice(i, 1); selKey = null; dirty = true; layout(); renderDrawer(); }
  };

  // Wall colour, floor and board shape, or a photo of her own room.
  function openBackdropSheet() {
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    const isPreset = WALLS.some((w) => w.hex.toLowerCase() === backdrop.wall.toLowerCase());
    dlg.innerHTML = `
      <form method="dialog" class="sheet-body">
        <h2>Walls &amp; floor</h2>
        <div>
          <div class="field-label"><span>Photo of your room</span><small>Optional</small></div>
          <div class="photo-row" id="photo-row"></div>
        </div>
        <div id="painted">
          <div>
            <div class="field-label"><span id="wall-label">Wall colour</span></div>
            <div class="swatches" role="group" aria-labelledby="wall-label">
              ${WALLS.map((w) => `<button type="button" class="swatch-btn" data-wall="${w.hex}" style="--c:${w.hex}" aria-pressed="${w.hex.toLowerCase() === backdrop.wall.toLowerCase()}" aria-label="${esc(w.name)}" title="${esc(w.name)}"></button>`).join('')}
              <label class="swatch-btn custom" style="--c:${esc(backdrop.wall)}" aria-pressed="${!isPreset}" title="Own colour">
                <span class="visually-hidden">Own colour</span>${icon('plus')}
                <input type="color" id="wall-input" class="visually-hidden" value="${esc(backdrop.wall)}">
              </label>
            </div>
          </div>
          <div style="margin-top:18px">
            <div class="field-label"><span id="floor-label">Floor</span></div>
            <div class="floors" role="group" aria-labelledby="floor-label">
              ${FLOORS.map((f) => `<button type="button" class="floor-btn" data-floor="${f.id}" aria-pressed="${f.id === backdrop.floor}"><span class="floor-chip" style="--c:${f.base || 'transparent'}"></span>${esc(f.name)}</button>`).join('')}
            </div>
          </div>
          <div style="margin-top:18px">
            <div class="field-label"><span id="shape-label">Shape</span></div>
            <div class="segmented" role="group" aria-labelledby="shape-label">
              ${SHAPES.map((s) => `<button type="button" data-shape="${s.id}" aria-pressed="${s.id === backdrop.shape}">${s.label}</button>`).join('')}
            </div>
          </div>
        </div>
        <button type="submit" class="btn-primary" value="ok">Done</button>
      </form>`;
    document.body.appendChild(dlg);

    const sync = () => {
      dlg.querySelectorAll('[data-wall]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.wall.toLowerCase() === backdrop.wall.toLowerCase())));
      const custom = dlg.querySelector('.swatch-btn.custom');
      custom.setAttribute('aria-pressed', String(!WALLS.some((w) => w.hex.toLowerCase() === backdrop.wall.toLowerCase())));
      custom.style.setProperty('--c', backdrop.wall);
      dlg.querySelectorAll('[data-floor]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.floor === backdrop.floor)));
      dlg.querySelectorAll('[data-shape]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.shape === backdrop.shape)));
      dlg.querySelector('#painted').classList.toggle('dimmed', !!backdrop.photo);
      dlg.querySelector('#photo-row').innerHTML = backdrop.photo
        ? `<span class="photo-thumb"><img src="${blobUrl('bdphoto', backdrop.photo)}" alt="Your room photo"></span>
           <label class="tool-btn">${icon('camera')} Other photo<input type="file" id="bd-file" accept="image/*" class="visually-hidden"></label>
           <button type="button" class="tool-btn danger" data-x="no-photo">${icon('trash')} Remove</button>`
        : `<label class="btn-secondary">${icon('camera')} Use a photo of your room<input type="file" id="bd-file" accept="image/*" class="visually-hidden"></label>`;
      dlg.querySelector('#bd-file').addEventListener('change', onPhoto);
    };
    const changed = () => { dirty = true; sync(); loadPhoto(); };

    async function onPhoto(e) {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const c = await fileToCanvas(f, 1600);
        const blob = await canvasToBlob(c, 'image/jpeg', 0.85);
        backdrop = { ...backdrop, photo: blob, photoW: c.width, photoH: c.height };
        changed();
      } catch (err) {
        console.error(err);
        alert('This photo could not be opened. Try a JPG or PNG photo.');
      }
    }

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) { dlg.close(); return; }
      const w = e.target.closest('[data-wall]');
      if (w) { backdrop = { ...backdrop, wall: w.dataset.wall, photo: null }; changed(); }
      const f = e.target.closest('[data-floor]');
      if (f) { backdrop = { ...backdrop, floor: f.dataset.floor, photo: null }; changed(); }
      const s = e.target.closest('[data-shape]');
      if (s) { backdrop = { ...backdrop, shape: s.dataset.shape, photo: null }; changed(); }
      if (e.target.closest('[data-x=no-photo]')) { backdrop = { ...backdrop, photo: null }; changed(); }
    });
    dlg.querySelector('#wall-input').addEventListener('input', (e) => {
      backdrop = { ...backdrop, wall: e.target.value, photo: null };
      changed();
    });
    dlg.addEventListener('close', () => dlg.remove());
    sync();
    dlg.showModal();
  }

  function openSaveSheet() {
    if (!pieces.length) { alert('Add at least one piece to the room first.'); return; }
    let type = room?.type || 'living';
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.innerHTML = `
      <form method="dialog" class="sheet-body">
        <h2>${room ? 'Save room' : 'Save new room'}</h2>
        <div>
          <label class="field-label" for="o-name">Name</label>
          <input id="o-name" class="text-input" type="text" maxlength="60" autocomplete="off" value="${esc(roomName)}" placeholder="e.g. Cosy living room">
        </div>
        <div>
          <div class="field-label"><span id="o-type">Which room</span></div>
          <div class="chips wrap" role="group" aria-labelledby="o-type">
            ${ROOM_TYPES.map((t) => `<button type="button" class="chip" data-t="${t.id}" aria-pressed="${t.id === type}">${t.label}</button>`).join('')}
          </div>
        </div>
        <button type="submit" class="btn-primary" value="save">Save room</button>
        ${room ? `<div class="sheet-row">
          <button type="button" class="btn-secondary" data-x="dup">${icon('copy')} Duplicate</button>
          <button type="button" class="btn-secondary danger" data-x="del">${icon('trash')} Delete</button>
        </div>` : ''}
        <button type="button" class="text-btn center" data-x="close">Keep editing</button>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', async (e) => {
      if (e.target === dlg) { dlg.close(); return; }
      const t = e.target.closest('[data-t]');
      if (t) { type = t.dataset.t; dlg.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.t === type))); }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'close') dlg.close();
      if (x === 'del' && confirm('Delete this room? The furniture stays in your collection.')) { dlg.close(); onDelete(room); }
      if (x === 'dup') { dlg.close(); await finish(true); }
    });
    dlg.addEventListener('close', () => {
      if (dlg.returnValue === 'save') finish(false);
      dlg.remove();
    });
    async function finish(asCopy) {
      let name = dlg.querySelector('#o-name').value.trim() || roomName || 'My room';
      if (asCopy && name === room.name) name += ' (copy)';
      const clean = cleanPieces();
      const thumb = await renderRoomThumb({ pieces: clean, backdrop }, itemMap);
      const now = Date.now();
      const r = {
        id: room && !asCopy ? room.id : uid(),
        name,
        type,
        backdrop,
        pieces: clean,
        thumb,
        created: room && !asCopy ? room.created : now,
        updated: now
      };
      dirty = false;
      asCopy ? onDuplicate(r) : onSave(r);
    }
    dlg.showModal();
  }

  function openRenameSheet() {
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.innerHTML = `
      <form method="dialog" class="sheet-body">
        <h2>Room name</h2>
        <div>
          <label class="field-label" for="r-name">Name</label>
          <input id="r-name" class="text-input" type="text" maxlength="60" autocomplete="off" value="${esc(roomName)}" placeholder="e.g. Cosy living room" required>
        </div>
        <button type="submit" class="btn-primary" value="ok">${room ? 'Save name' : 'Use this name'}</button>
        <button type="button" class="text-btn center" data-x="close">Cancel</button>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-x=close]')) dlg.close();
    });
    dlg.addEventListener('close', async () => {
      const name = dlg.querySelector('#r-name').value.trim();
      dlg.remove();
      if (dlg.returnValue !== 'ok' || !name || name === roomName) return;
      roomName = name;
      root.querySelector('#title').textContent = name;
      // A saved room with no other changes is renamed right away; otherwise the name goes in with Save.
      if (room && !dirty) await onRename(name);
      else dirty = true;
    });
    dlg.showModal();
    const input = dlg.querySelector('#r-name');
    input.focus();
    input.select();
  }

  // ---- start ----
  renderDrawer();
  size();
  loadPhoto();
  if (startItemId && itemMap.has(startItemId)) {
    tab = itemMap.get(startItemId).category;
    renderDrawer();
    requestAnimationFrame(() => addPiece(startItemId));
  }

  const beforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  return () => {
    ro.disconnect();
    window.removeEventListener('beforeunload', beforeUnload);
    root.onclick = null;
  };
}

/** Draws the room (backdrop and furniture) for the room cards. */
export async function renderRoomThumb(room, itemMap, width = 640) {
  const W = width, H = Math.round(width * aspectOf(room.backdrop));
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  await drawRoom(ctx, room, itemMap, W, H);
  const b = await canvasToBlob(c, 'image/webp', 0.86);
  return b.type === 'image/webp' ? b : canvasToBlob(c, 'image/jpeg', 0.88);
}

/** Draws the backdrop and the pieces into a W x H area of a canvas context. */
export async function drawRoom(ctx, room, itemMap, W, H) {
  await drawBackdrop(ctx, room.backdrop, W, H);
  ctx.imageSmoothingQuality = 'high';
  for (const p of room.pieces) {
    const it = itemMap.get(p.itemId);
    if (!it) continue;
    const img = await blobToImage(it.image);
    const w = p.w * W, h = w * (it.h / it.w);
    ctx.save();
    ctx.translate(p.x * W, p.y * H);
    ctx.rotate(p.rot || 0);
    if (p.flip) ctx.scale(-1, 1);
    // Same soft shadow as on the board, so furniture stands in the room.
    ctx.shadowColor = 'rgba(30, 20, 10, .22)';
    ctx.shadowBlur = W * 0.012;
    ctx.shadowOffsetY = W * 0.006;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
