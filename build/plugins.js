// The small build steps of the site, as Vite plugins.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { minify as minifyJs } from "terser";
import { minify as minifyHtml } from "html-minifier-terser";
import { typesetHtml } from "./typeset/html.js";

// <svg data-icon="logo" class="…"></svg> in the HTML → the SVG of src/assets/icons/logo.svg, with the attributes of the
// tag added (a class, a label). Icons without a label are hidden from screen readers.
export function icons(dir) {
  return {
    name: "fm-icons",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/<svg data-icon="([\w-]+)"([^>]*)><\/svg>/g, (tag, name, attrs) => {
          const svg = readFileSync(resolve(dir, name + ".svg"), "utf8").trim();
          const label = /\baria-label=|\brole=/.test(attrs) ? "" : ' aria-hidden="true"';
          return svg.replace(/^<svg\b/, "<svg" + attrs + label + ' focusable="false"');
        });
      }
    }
  };
}

// <script data-inline src="./scripts/boot.js"></script> → the script itself, inside the page (minified when building):
// it has to run before the page is drawn, without waiting for a file.
export function inlineScripts(root) {
  let building = false;
  return {
    name: "fm-inline-scripts",
    configResolved(config) { building = config.command === "build"; },
    transformIndexHtml: {
      order: "pre",
      async handler(html, ctx) {
        const tags = [...html.matchAll(/<script data-inline src="([^"]+)"><\/script>/g)];
        for (const [tag, src] of tags) {
          let code = readFileSync(resolve(dirname(ctx.filename), src), "utf8");
          if (building) code = (await minifyJs(code, { ecma: 2020, compress: { passes: 2 }, mangle: true })).code;
          html = html.replace(tag, "<script>" + code + "</script>");
        }
        return html;
      }
    }
  };
}

// Where the lines of the page's texts may break: no-break spaces and word joiners, by the language of each text
// (build/typeset/README.md). Letters you can see are never changed: what a proofreader would change (straight quotes, a
// hyphen for a dash, a look-alike letter) is listed when the site is built, and `npm run typeset -- --lint` shows it all.
export function typeset() {
  let warned = false;
  return {
    name: "fm-typeset",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const { html: out, report } = typesetHtml(html);
        const findings = report.flatMap((r) => r.findings);
        if (findings.length && !warned) {
          const name = ctx.filename.split("/").pop();
          console.warn(`typeset: ${name} — ${findings.length} spots a proofreader would change (npm run typeset -- --lint src/${name})`);
        }
        return out;
      }
    },
    buildEnd() { warned = true; }
  };
}

// The finished pages, minified: no comments, no indentation (whitespace that shows on the page is kept)
export function minifyPages() {
  return {
    name: "fm-minify-html",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) => minifyHtml(html, {
        collapseWhitespace: true, conservativeCollapse: true, removeComments: true,
        removeRedundantAttributes: true, removeScriptTypeAttributes: true, useShortDoctype: true,
        minifyJS: false, minifyCSS: true, sortAttributes: false
      })
    }
  };
}

// The home page's stylesheet, put inside the page (<style>) instead of a file of its own: a phone on a slow connection
// can then draw the page as soon as the HTML has come, without one more round trip to the server first (PageSpeed,
// Oct 25: "render-blocking request", ≈ 0.45 s on slow 4G). The stylesheet is 11 KB compressed, so the page grows from
// ≈ 14 to ≈ 25 KB. Its addresses (fonts, pictures) are written relative to the stylesheet's folder (assets/), so they
// are rewritten for the page's own folder. Runs after minifyPages: the CSS is already minified by Lightning CSS, and the
// HTML minifier's own CSS minifier does not know all of it (container queries, nesting fallbacks).
export function inlineCss(pages = ["index.html"]) {
  return {
    name: "fm-inline-css",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle || !pages.includes(ctx.filename.split("/").pop())) return html;
        return html.replace(/<link rel="stylesheet"(?: crossorigin)? href="\.\/(assets\/[^"]+\.css)">/g, (tag, file) => {
          const asset = ctx.bundle[file];
          if (!asset || asset.type !== "asset") return tag;
          const dir = file.slice(0, file.lastIndexOf("/") + 1);       // "assets/"
          const css = String(asset.source)
            .replace(/url\((["']?)\.\/([^"')]+)\1\)/g, (m, q, path) => "url(" + q + "./" + dir + path + q + ")")
            // image-set() may also name its files as bare strings: image-set("./a.avif" 1x type("image/avif"), …)
            .replace(/(image-set\()([^;}]*)/g, (m, open, list) => open + list.replace(/(["'])\.\/(?!assets\/)/g, "$1./" + dir))
            .replace(/<\/style/gi, "<\\/style");
          // every file the stylesheet names must now be a file of the build, and no relative address may be left that
          // was not rewritten: it would point next to the page, and its picture or font would quietly not load
          const left = css.match(/(?:url\(\s*["']?|["'])\.\/(?!assets\/)[^"')\s]*/);
          if (left) throw new Error(`fm-inline-css: ${file} has an address not rewritten for the page: ${left[0]}`);
          for (const [, ref] of css.matchAll(/\.\/(assets\/[^"')\s,]+)/g))
            if (!ctx.bundle[ref]) throw new Error(`fm-inline-css: ${file} names ./${ref}, which is not in the build`);
          delete ctx.bundle[file];                                   // nothing else uses it
          return "<style>" + css + "</style>";
        });
      }
    }
  };
}

// A Content Security Policy for every page, written into it when the site is built: the page may run only its own
// scripts (and the inline ones it was built with: their hashes are worked out here), and frame only the booking page of
// Planerka (scripts/book.js; no script of Planerka runs on the page itself). Whatever else tried to run (an injected
// script, a browser extension's code put into the page) is blocked.
// When something new is added to the site (an analytics counter, a chat), add its addresses to POLICY below.
// (frame-ancestors cannot be set from the page itself: the server sends it, see deploy/.)
const POLICY = {
  "default-src": ["'self'"],
  // (+ 'unsafe-inline' on pages with inline scripts, see csp() below)
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],          // the drawings and GSAP set styles on the elements they move
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "frame-src": ["https://planerka.app"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"]
};
export function csp() {
  return {
    name: "fm-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
          .map(([, code]) => "'sha256-" + createHash("sha256").update(code).digest("base64") + "'");
        // 'unsafe-inline' is for old browsers only: a browser that knows script hashes ignores it once a hash is listed
        // (PageSpeed's CSP check asks for it, Oct 25). So it is added only where there is a hash: on a page without one it
        // would really allow inline scripts (independent review, Oct 25).
        const policy = Object.entries(POLICY).map(([k, v]) => k + " " + (k === "script-src" ? v.concat(hashes.length ? ["'unsafe-inline'"] : [], hashes) : v).join(" ")).join("; ");
        return html.replace(/<meta charset="utf-8">/i, (m) => m + '<meta http-equiv="Content-Security-Policy" content="' + policy + '">');
      }
    }
  };
}

// Every text file of the finished site is also saved compressed (.br and .gz next to it), at the strongest level, once:
// a server that can send these (nginx gzip_static / brotli_static, Caddy precompressed) does not compress on every request.
export function precompress(outDir) {
  return {
    name: "fm-precompress",
    apply: "build",
    async closeBundle() {
      const { readdirSync, statSync, readFileSync, writeFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const zlib = await import("node:zlib");
      const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
      for (const file of walk(outDir).filter((f) => /\.(html|css|js|svg|json|webmanifest|xml|txt)$/.test(f))) {
        const data = readFileSync(file);
        if (data.length < 1024) continue;
        writeFileSync(file + ".br", zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
        writeFileSync(file + ".gz", zlib.gzipSync(data, { level: 9 }));
      }
    }
  };
}
