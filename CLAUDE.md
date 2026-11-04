# Notes for working on this repo

## Version number (required on every commit)

The app shows its version at the top of every screen. **Every commit must bump it by 0.01**
(1.00 → 1.01 → 1.02 …, and 1.99 → 2.00). Change it in both places, in the same commit:

- `js/version.js` → `export const VERSION = 'X.YY';`
- `sw.js` → `const CACHE = 'interior-X.YY';` (so phones pick up the new files)

Mention the new version in the commit message.

## Stack

Static PWA, no build step: `index.html`, `styles.css`, ES modules in `js/`, served by GitHub Pages.
Data lives on the phone in IndexedDB (`js/db.js`). `vendor/bg-removal.js` is a pre-bundled copy of
`@imgly/background-removal` (see README for how to rebuild it).

This app is built on the same code as the wardrobe app (`RubenZ21/M-cothing`) and is served from
the same site (`rubenz21.github.io`). Browsers share storage per site, so everything here uses its
own names (the app was first called Minja's Interior, and the
internal names stay `interior` so saved data keeps working): IndexedDB `interior`, localStorage keys `interior.*`, caches `interior-*`. Keep it that way.
