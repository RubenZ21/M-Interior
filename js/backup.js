// Backup as a .zip: the pictures as normal image files in folders, plus data.json
// with everything else.
import { zipSync, unzipSync, strToU8, strFromU8 } from '../vendor/fflate.js';
import { VERSION } from './version.js';

const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
const TYPE = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };

/** The picture format read from the first bytes of the file, or '' when unknown. */
function sniff(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  return '';
}

/** Thrown by readBackup with a `code` the Settings screen turns into a clear message. */
export class BackupError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** "Oak table" -> safe file name part, keeping letters like č, ć, š, ž, đ. */
function safeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) || 'picture';
}

export function backupFileName(date = new Date()) {
  const d = date.toISOString().slice(0, 10);
  return `my-home-backup-${d}.zip`;
}

/** Builds the backup zip as a File. */
export async function buildBackupZip(state) {
  const files = {};
  const used = new Set();
  // Adds one picture and returns its path inside the zip.
  const add = async (folder, name, id, blob) => {
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // The file ending follows what the picture really is, so it opens on a computer too.
    const ext = EXT[sniff(bytes)] || EXT[blob.type] || 'webp';
    let path = `${folder}/${safeName(name)}.${ext}`;
    if (used.has(path.toLowerCase())) path = `${folder}/${safeName(name)} (${String(id).slice(0, 6)}).${ext}`;
    // Still taken (same name and same start of the id): number it, so no picture replaces another.
    for (let n = 2; used.has(path.toLowerCase()); n++) path = `${folder}/${safeName(name)} (${String(id).slice(0, 6)}-${n}).${ext}`;
    used.add(path.toLowerCase());
    files[path] = [bytes, { level: 0 }]; // pictures are already compressed
    return path;
  };

  const items = [];
  for (const i of state.items) {
    items.push({ ...i, image: await add('furniture', i.name, i.id, i.image), thumb: await add('_thumbnails/furniture', i.name, i.id, i.thumb) });
  }
  const rooms = [];
  for (const r of state.rooms) {
    const backdrop = r.backdrop?.photo ? { ...r.backdrop, photo: await add('room-photos', r.name, r.id, r.backdrop.photo) } : r.backdrop;
    rooms.push({ ...r, backdrop, thumb: await add('rooms', r.name, r.id, r.thumb) });
  }
  const wishes = [];
  for (const w of state.wishes) {
    wishes.push({ ...w, image: await add('wishlist', w.name, w.id, w.image), thumb: await add('_thumbnails/wishlist', w.name, w.id, w.thumb) });
  }
  const data = { app: 'interior', version: 1, appVersion: VERSION, exported: new Date().toISOString(), items, rooms, wishes };
  files['data.json'] = [strToU8(JSON.stringify(data, null, 1)), { level: 6 }];
  files['README.txt'] = [strToU8(
    `My Home backup (app version ${VERSION}, ${new Date().toLocaleString()})\r\n\r\n`
    + 'To restore: open the app, Settings > Restore from a backup, and choose this .zip file.\r\n'
    + 'The folders hold the pictures (furniture, rooms, room photos, wishlist); data.json holds the rest.\r\n'
  ), { level: 6 }];

  const zipped = zipSync(files);
  return new File([zipped], backupFileName(), { type: 'application/zip' });
}

/** Reads a backup .zip into { items, rooms, wishes } with Blobs. */
export async function readBackup(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  if (!isZip) throw new BackupError('not-backup', 'Not a zip file');

  let files;
  try { files = unzipSync(bytes); } catch { throw new BackupError('damaged', 'The zip cannot be opened'); }
  const dataFile = files['data.json'] || Object.entries(files).find(([k]) => k.endsWith('/data.json'))?.[1];
  if (!dataFile) throw new BackupError('not-backup', 'No data.json in this zip');
  let data;
  try { data = JSON.parse(strFromU8(dataFile)); } catch { throw new BackupError('damaged', 'data.json cannot be read'); }
  if (data.app === 'wardrobe') throw new BackupError('other-app', 'This is a backup of the other app');
  if (data.app !== 'interior') throw new BackupError('not-backup', 'Not an interior backup');
  // Folder prefix, in case the zip was re-packed inside a folder.
  const prefix = files['data.json'] ? '' : Object.keys(files).find((k) => k.endsWith('/data.json')).slice(0, -'data.json'.length);
  // Zips that were unpacked and packed again (Mac, Windows) can spell the same file name with
  // different accent codes or capitals, so a second lookup ignores both.
  const norm = (k) => k.normalize('NFC').toLowerCase();
  let loose;
  const find = (key) => files[key] || (loose ||= new Map(Object.keys(files).map((k) => [norm(k), files[k]]))).get(norm(key));
  let missing = 0; // pictures named in data.json that are not in the zip
  const pic = (path) => {
    if (!path) return null;
    const raw = find(prefix + path);
    if (!raw || !raw.length) { missing++; return null; }
    return new Blob([raw], { type: sniff(raw) || TYPE[path.split('.').pop().toLowerCase()] || 'image/webp' });
  };
  // A piece or wish without its main picture cannot be shown: it is left out and counted.
  const withImage = (list) => list.filter((x) => x.image);
  const out = {
    items: withImage((data.items || []).map((i) => ({ ...i, image: pic(i.image), thumb: pic(i.thumb) }))),
    rooms: (data.rooms || []).map((r) => ({
      ...r,
      backdrop: r.backdrop?.photo ? { ...r.backdrop, photo: pic(r.backdrop.photo) } : r.backdrop,
      thumb: pic(r.thumb)
    })),
    wishes: withImage((data.wishes || []).map((w) => ({ ...w, image: pic(w.image), thumb: pic(w.thumb) })))
  };
  out.missing = missing;
  return out;
}
