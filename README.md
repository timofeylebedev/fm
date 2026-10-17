# Flow Medium — the website

The landing page of [Flow Medium](https://flowmedium.pro/), a custom static site (no Taptop, no runtime of a builder).
It is built with [Vite](https://vite.dev) into plain files in `dist/`, which any web server can host.

**Test link:** https://timofeylebedev.github.io/fm-website/ — built and published by GitHub Actions on every push to `main`.

## Working on it

```sh
npm install          # once (Node 22 or newer)
npm run dev          # the site at http://localhost:5173, reloads on every change
npm run build        # the finished site in dist/
npm run preview      # dist/ at http://localhost:4173, as it will be on the server
npm run check        # validates the HTML of dist/
npm run tokens:sync  # merges design/tokens.json with a fresh export of the Figma variables (design/README.md)
```

## Where things are

| Path | What it is |
| --- | --- |
| `src/index.html` | the page: all the text and the structure, by section |
| `src/404.html` | the page for an address that does not exist |
| `src/styles/` | the styles: `base/` (colours, fonts, reset), `components/` (buttons, headings), `sections/` (one part of the page each), `art/` (the drawings) |
| `src/scripts/` | the scripts, one file per part of the page; `main.js` starts them, `boot.js` runs first, inside `<head>` |
| `src/scripts/art/` | the drawings of the card stack and the royalty cards (downloaded only when they are about to be seen) |
| `src/assets/icons/` | the SVG icons put into the page: `<svg data-icon="logo">` in the HTML becomes the content of `logo.svg` |
| `src/assets/img/`, `src/assets/fonts/` | the pictures and fonts the site uses, made from the originals by `build/images.mjs` and `build/fonts.py` |
| `assets-src/` | the originals of every picture and font (not published) |
| `public/` | files copied as they are: `robots.txt`, the icons, `og.png` (the picture for links in messengers) |
| `build/` | the build steps: `images.mjs` and `fonts.py` (the pictures and fonts), and the Vite plugins for icons, the inline first script, Russian non-breaking spaces, minification, the Content Security Policy |
| `deploy/` | server settings: `nginx.conf`, `Caddyfile`, `.htaccess` (Apache), `_headers` (Netlify, Cloudflare Pages) |

## Changing things

- **A text:** in `src/index.html`. Non-breaking spaces for Russian («в&nbsp;доме», «10&nbsp;000», «Лейбл&nbsp;—») are put in
  by the build (`build/typograph.js`), so the text can be written normally.
- **A colour, or a size shared with Figma** (footer, buttons so far): `design/tokens.json`, the same values as the Figma
  variables; `npm run tokens:sync` moves changes both ways. See `design/README.md`.
- **A font, a curve:** `src/styles/base/tokens.css`. The screen widths are in `src/styles/base/media.css`.
- **A picture:** put the new original into `assets-src/img/` under the same name, run `npm run images`, commit the new files.
  The list in `build/images.mjs` says what is made from each original (sizes and formats: AVIF and WebP).
- **A font:** `assets-src/fonts/`, then `npm run fonts` (needs Python with `pip install fonttools brotli`).
- **The animations:** every part has its settings at the top of its file in `src/scripts/` (`motion.js` for how
  headings, texts and cards come in; `hero.js` for the chips; `stipple.js` for the dots; `art/` for the drawings).
  The console of the browser has the same objects as before for trying values live: `fmMotion`, `fmHero`, `fmCards`,
  `fmStipple`, `fmRoyalty`, `fmPace`.
- **Something from another site** (an analytics counter, a chat): add its address to `POLICY` in `build/plugins.js`,
  or the browser will block it (the page allows only its own scripts and the booking popup of Planerka).

Test switches for phones, at the end of the address: `?fmcards=debug` (what the card stack measures), `?fmcap=debug`
(the strip above the navbar in the browsers of apps).

## Hosting

`npm run build`, then put the contents of `dist/` on the server, and take the matching file from `deploy/`.
Files in `dist/assets/` have a hash in their name and can be cached for a year; everything else must be checked
every time (the settings in `deploy/` do both). The build also leaves a compressed copy (`.br`, `.gz`) next to every
text file for servers that can send it as it is.

Before launch: change `public/robots.txt` (it asks search engines to stay away while this is a test site).
