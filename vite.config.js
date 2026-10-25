// The build of the site: `npm run dev` to work on it, `npm run build` for the finished site in dist/.
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { icons, inlineScripts, typeset, minifyPages, inlineCss, csp, precompress } from "./build/plugins.js";

const src = resolve(import.meta.dirname, "src");
const dist = resolve(import.meta.dirname, "dist");

export default defineConfig({
  root: src,
  base: "./",                                   // relative addresses: the site works at a domain's root or in a folder
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [inlineScripts(src), icons(resolve(src, "assets/icons")), typeset(), minifyPages(), inlineCss(), csp(), precompress(dist)],
  css: {
    transformer: "lightningcss",
    // the same browsers as build.target below, given to Lightning CSS itself: without them Vite gives it its own
    // baseline (Safari 16.4), which drops what older iPhones need: the vh line before an svh one, and
    // -webkit-text-size-adjust (without it iOS enlarges the text of a phone turned sideways)
    lightningcss: { drafts: { customMedia: true }, targets: { chrome: 100 << 16, safari: 15 << 16, ios_saf: 15 << 16, firefox: 100 << 16, edge: 100 << 16 } }
  },
  build: {
    outDir: dist,
    emptyOutDir: true,
    target: ["chrome100", "safari15", "ios15", "firefox100", "edge100"],   // iPhones from iOS 15; the CSS is written down to that (nesting, ranges)
    cssMinify: "lightningcss",
    // small pictures of the drawings go inside their script; everything else stays a file of its own (cached, and not
    // repeated in the page where it is used more than once)
    assetsInlineLimit: (file, content) => /\/art-[\w-]+\.svg$/.test(file) && content.length < 4096,
    modulePreload: { polyfill: false },
    rollupOptions: { input: {
      index: resolve(src, "index.html"), 404: resolve(src, "404.html"),
      // the legal documents: the policy at its old address (/privacy_policy_ru), the consent at /cookie_consent (the old
      // /soglasie_cookie is public/soglasie_cookie.html, which leads there). Every host in deploy/ and GitHub Pages serve a
      // page.html for its address without .html
      privacy_policy_ru: resolve(src, "privacy_policy_ru.html"), cookie_consent: resolve(src, "cookie_consent.html")
    } }
  }
});
