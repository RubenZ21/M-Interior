# My Home

Collect furniture and decor, let the app cut them out, and combine them into rooms.
It is a small web app that installs on a phone (PWA), the sister app of Minja's Wardrobe (formerly called Minja's Interior),
with its own colours: warm linen, espresso and terracotta (with a touch of sage).

**Open it:** https://m-home.ruben-zubac.workers.dev/ (private: login by a one-time code sent by email; only Ruben and Minja are allowed)

## What it does

- **Furniture:** tap **+**, take a photo or pick one from the gallery (a photo in a shop, a screenshot of a web shop …). The background is removed on the phone itself, and you can touch up the edges with an erase/restore brush. Pictures that are already cut out (for example Samsung Gallery: press and hold the item → *Save as image*) are used as they are. Pick a category and (optionally) a name. The main colour is detected from the photo.
- **Categories:** Sofas, Armchairs, Chairs, Tables, Beds, Cabinets, Shelves, Lighting, Rugs, Curtains, Cushions & throws, Wall art, Mirrors, Plants, Vases & pots, Decor. With search and filters.
- **Room builder:** tap furniture to place it in a room. Each piece lands in a sensible spot (sofas on the floor, art on the wall, rugs underneath everything). Drag to move, pinch to resize and rotate (or drag the round corner handle), and use Front / Back / Copy / Mirror / Remove. Tapping the same piece again adds another one (two chairs, a pair of lamps); *Copy* does the same for the selected piece.
- **Walls & floor:** tap an empty spot, then *Walls & floor*: choose a wall colour (or your own), a floor (light oak, walnut, white wood, parquet, tiles, terrazzo, concrete, carpet or none) and the shape (wide, square, tall). Or use **a photo of your own room** as the background and try the furniture in it.
- **Rooms tab:** rooms grouped by type (Living room, Bedroom, Dining room, Kitchen, Bathroom, Office, Kids’ room, Hallway, Balcony & garden, Other). Rooms can be edited, renamed (tap the name at the top of the builder), duplicated and deleted. The share button sends a picture of the room with its name through the phone's share menu (WhatsApp, Messages, email …).
- **Wishlist tab:** screenshots of things found online, each with a link to the shop, just like in the wardrobe app. *I bought it* moves a wish to the Furniture tab (keeping the shop link).
- **Settings tab:** backup and restore, storage protection, background-removal quality, install help.
- **Backup:** Settings → *Save backup on this phone* puts one `.zip` file (`my-home-backup-<date>.zip`) in the phone's Downloads folder; *Send backup to…* opens the share menu for Google Drive, email etc. The zip holds the pictures as normal image files (`furniture/`, `rooms/`, `room-photos/`, `wishlist/`) plus `data.json` with everything else. The Settings tab shows a red dot when the last backup is more than 30 days old.
- **Version:** shown in small letters at the top of every screen. It goes up by 0.01 with every change (see `CLAUDE.md`).

## Photos and privacy

Everything stays on the phone, in the browser's IndexedDB storage. Nothing is uploaded and no account is needed.
The data is separate from the wardrobe app, even though both live on `rubenz21.github.io`.

Background removal uses [@imgly/background-removal](https://github.com/imgly/background-removal-js), which runs in the browser.
The first time it is used, the phone downloads the model once (about 80 MB for *Best quality*, the default; about 40 MB for *Fast* in Settings) from IMG.LY's CDN. After that it works offline.

Because the photos only live on the phone:

- Install the app to the home screen (on iPhone this stops Safari from clearing the data).
- Tap *Keep my photos safe* in Settings (asks the browser for persistent storage).
- Save a backup now and then.

## Hosting

The app is served by Cloudflare as the Worker `m-home` (static files only, see `wrangler.jsonc`),
behind Cloudflare Access. Every push to the `main` branch is deployed automatically; other
branches are not. Files listed in `.assetsignore` are not served.

## Install on a phone

- **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone (Safari):** Share → **Add to Home Screen**.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `styles.css` | All styles (linen / espresso / terracotta palette) |
| `js/app.js` | Screens (Furniture, Rooms, piece details) and navigation |
| `js/add.js` | New piece: photo, background removal, touch up, details |
| `js/builder.js` | Room board, walls & floor sheet, room thumbnails |
| `js/room.js` | Drawing the room background: wall, floor in perspective, or a room photo |
| `js/constants.js` | Categories, room types, wall colours, floors, where pieces land |
| `js/settings.js` | Settings tab: backup/restore, storage, quality |
| `js/wish.js` | Wishlist tab: list, add/edit (crop, background removal, link) |
| `js/link.js` | Finding links in screenshot metadata or pasted text |
| `js/share.js` | Room picture for sharing, and the share menu |
| `js/backup.js` | Backup zip: build and restore |
| `js/version.js` | App version shown at the top (bump with every commit) |
| `js/bg.js` | Loads the background-removal library |
| `js/db.js` | IndexedDB storage |
| `js/images.js` | Resizing, trimming, colour detection |
| `vendor/bg-removal.js` | `@imgly/background-removal` 1.7.0 with `onnxruntime-web` 1.21.0, bundled into one file with esbuild |
| `vendor/fflate.js` | [fflate](https://github.com/101arrowz/fflate) 0.8.2 (MIT) for zip files, bundled with esbuild |
| `sw.js` | Offline support: newest files when online, cached copy when offline; bump `CACHE` when releasing |
| `manifest.webmanifest`, `icons/` | App name, colours and icons for installing |

## License note

`vendor/bg-removal.js` is IMG.LY's library under the AGPL (see `vendor/LICENSE-background-removal.md`). That is fine for this public, open-source repository.

### Rebuilding the vendor file

```
npm i @imgly/background-removal@1.7.0 onnxruntime-web@1.21.0 esbuild
echo "export { removeBackground, preload } from '@imgly/background-removal';" > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --minify --platform=browser --target=es2020 --outfile=vendor/bg-removal.js
```
