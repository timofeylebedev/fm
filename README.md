# Flow Medium website

The landing page of Flow Medium, exported from Taptop and now edited directly.

**Test link:** https://timofeylebedev.github.io/fm-website/ (GitHub Pages deploys `main` about a minute after a push.)

## Editing the custom styles and scripts

The readable sources are in `src/`. Edit those, not the minified files in `f/`.

| Source | Built file (loaded by `index.html`) |
| --- | --- |
| `src/home.css` | `f/home-59min.css` |
| `src/home.js` | `f/home-64min.js` |

After changing a source, rebuild and commit both the source and the built file:

```sh
npm install        # once
npm run build      # writes the files in f/
npm run check      # fails if a built file is out of date
```

The CSS build also embeds the four font files from `t/images/mosaic/fonts/` into the built CSS, as the Taptop export did.

## What else is where

- `index.html`: the page. Taptop's markup and styles, plus the inline custom code (scroll restore, steady screen height, hero fade-in, demo links, GSAP fallback, non-breaking spaces).
- `404.html`: the not-found page.
- `d/`: images and logos. `f/`: custom code and libraries (GSAP, WebFont loader). `t/`: Taptop design styles and fonts. `g/`, `assets/`: Taptop runtime and jQuery.
- `robots.txt` blocks search engines while this is a test site. Change it before launch.
