export const CATEGORIES = [
  { id: 'sofas', label: 'Sofas', one: 'sofa' },
  { id: 'armchairs', label: 'Armchairs', one: 'armchair' },
  { id: 'chairs', label: 'Chairs', one: 'chair' },
  { id: 'tables', label: 'Tables', one: 'table' },
  { id: 'beds', label: 'Beds', one: 'bed' },
  { id: 'storage', label: 'Cabinets', one: 'cabinet' },
  { id: 'shelves', label: 'Shelves', one: 'shelf' },
  { id: 'lighting', label: 'Lighting', one: 'lamp' },
  { id: 'rugs', label: 'Rugs', one: 'rug' },
  { id: 'curtains', label: 'Curtains', one: 'curtain' },
  { id: 'cushions', label: 'Cushions & throws', one: 'cushion' },
  { id: 'art', label: 'Wall art', one: 'artwork' },
  { id: 'mirrors', label: 'Mirrors', one: 'mirror' },
  { id: 'plants', label: 'Plants', one: 'plant' },
  { id: 'vases', label: 'Vases & pots', one: 'vase' },
  { id: 'decor', label: 'Decor', one: 'decoration' }
];

/** Kept for the shared code paths; this app has no legacy categories (yet). */
export const LEGACY_CATEGORIES = [];

/** Categories to show for a set of pieces: all current ones, plus old ones still in use. */
export function categoriesFor(items) {
  return [...CATEGORIES, ...LEGACY_CATEGORIES.filter((c) => items.some((i) => i.category === c.id))];
}

/** What kind of room a design is for. Rooms are grouped by this on the Rooms tab. */
export const ROOM_TYPES = [
  { id: 'living', label: 'Living room' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'dining', label: 'Dining room' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'office', label: 'Office' },
  { id: 'kids', label: 'Kids’ room' },
  { id: 'hallway', label: 'Hallway' },
  { id: 'outdoor', label: 'Balcony & garden' },
  { id: 'other', label: 'Other' }
];

export const catById = (id) => CATEGORIES.find((c) => c.id === id) || LEGACY_CATEGORIES.find((c) => c.id === id);
export const roomTypeById = (id) => ROOM_TYPES.find((r) => r.id === id) || ROOM_TYPES[ROOM_TYPES.length - 1];

/**
 * Where a piece lands on the room board when added (fractions of the board).
 * The board is a wall on top and a floor below (the floor starts at FLOOR_LINE).
 */
export const PLACEMENT = {
  sofas: { x: 0.5, y: 0.66, w: 0.5 },
  armchairs: { x: 0.2, y: 0.7, w: 0.22 },
  chairs: { x: 0.75, y: 0.72, w: 0.14 },
  tables: { x: 0.5, y: 0.8, w: 0.3 },
  beds: { x: 0.5, y: 0.68, w: 0.55 },
  storage: { x: 0.8, y: 0.6, w: 0.26 },
  shelves: { x: 0.25, y: 0.3, w: 0.26 },
  lighting: { x: 0.85, y: 0.5, w: 0.12 },
  rugs: { x: 0.5, y: 0.86, w: 0.6 },
  curtains: { x: 0.1, y: 0.4, w: 0.18 },
  cushions: { x: 0.45, y: 0.62, w: 0.1 },
  art: { x: 0.5, y: 0.3, w: 0.24 },
  mirrors: { x: 0.25, y: 0.32, w: 0.16 },
  plants: { x: 0.92, y: 0.66, w: 0.14 },
  vases: { x: 0.7, y: 0.52, w: 0.07 },
  decor: { x: 0.35, y: 0.55, w: 0.08 }
};

/** Height of the wall, as a fraction of the board; the floor fills the rest. */
export const FLOOR_LINE = 0.64;

/** Board shapes (height / width). */
export const SHAPES = [
  { id: 'wide', label: 'Wide', aspect: 3 / 4 },
  { id: 'square', label: 'Square', aspect: 1 },
  { id: 'tall', label: 'Tall', aspect: 4 / 3 }
];

export const WALLS = [
  { hex: '#F4F1EC', name: 'Chalk white' },
  { hex: '#E9E0D2', name: 'Linen' },
  { hex: '#D9C7B0', name: 'Sand' },
  { hex: '#C9CFC0', name: 'Sage' },
  { hex: '#BFCBD1', name: 'Mist blue' },
  { hex: '#D8B7A6', name: 'Clay pink' },
  { hex: '#7D8C78', name: 'Olive' },
  { hex: '#3E4A52', name: 'Ink blue' },
  { hex: '#3A3330', name: 'Espresso' }
];

export const FLOORS = [
  { id: 'oak', name: 'Light oak', base: '#D3B48C', line: '#C2A078', kind: 'planks' },
  { id: 'walnut', name: 'Walnut', base: '#7E5A3E', line: '#6C4B32', kind: 'planks' },
  { id: 'whitewood', name: 'White wood', base: '#E6DDD0', line: '#D6CBBB', kind: 'planks' },
  { id: 'parquet', name: 'Parquet', base: '#C8A57C', line: '#AE8A60', kind: 'planks', planks: 22, joints: 7 },
  { id: 'tile', name: 'Grey tiles', base: '#C9C7C2', line: '#B3B0AA', kind: 'tiles' },
  { id: 'terrazzo', name: 'Terrazzo', base: '#E8E2D8', line: '#D2C9BB', kind: 'speckle' },
  { id: 'concrete', name: 'Concrete', base: '#A9A6A0', line: '#9A968F', kind: 'plain' },
  { id: 'carpet', name: 'Carpet', base: '#CDBFAE', line: '#C1B2A0', kind: 'plain' },
  { id: 'none', name: 'No floor', base: '', line: '', kind: 'none' }
];

export const floorById = (id) => FLOORS.find((f) => f.id === id) || FLOORS[0];
export const shapeById = (id) => SHAPES.find((s) => s.id === id) || SHAPES[0];

/** The look of a new room. */
export const DEFAULT_BACKDROP = { wall: '#E9E0D2', floor: 'oak', shape: 'wide' };

/** Scrolls a horizontal chip row so its selected chip is in view (centred). */
export function revealSelected(row, smooth = false) {
  const on = row?.querySelector('[aria-pressed=true], [aria-selected=true]');
  if (!on) return;
  const r = row.getBoundingClientRect(), c = on.getBoundingClientRect();
  const left = row.scrollLeft + (c.left + c.width / 2) - (r.left + r.width / 2);
  row.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
}
