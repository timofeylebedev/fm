// The build of the site: `npm run dev` to work on it, `npm run build` for the finished site in dist/.
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { icons, inlineScripts, typograph, minifyPages, csp, precompress } from "./build/plugins.js";

const src = resolve(import.meta.dirname, "src");
const dist = resolve(import.meta.dirname, "dist");

export default defineConfig({
  root: src,
  base: "./",                                   // relative addresses: the site works at a domain's root or in a folder
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [inlineScripts(src), icons(resolve(src, "assets/icons")), typograph(), minifyPages(), csp(), precompress(dist)],
  css: {
    transformer: "lightningcss",
    lightningcss: { drafts: { customMedia: true } }
  },
  build: {
    outDir: dist,
    emptyOutDir: true,
    target: ["chrome100", "safari15", "firefox100", "edge100"],   // iPhones from iOS 15; the CSS is written down to that (nesting, ranges)
    cssMinify: "lightningcss",
    // small pictures of the drawings go inside their script; everything else stays a file of its own (cached, and not
    // repeated in the page where it is used more than once)
    assetsInlineLimit: (file, content) => /\/art-[\w-]+\.svg$/.test(file) && content.length < 4096,
    modulePreload: { polyfill: false },
    rollupOptions: { input: { index: resolve(src, "index.html"), 404: resolve(src, "404.html") } }
  }
});
