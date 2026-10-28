// `npm run export`: the site as it goes to its real host (flowmedium.pro), in one zip to upload.
//
// The same build as `npm run build`, with what differs on the real host and only there:
// - robots.txt lets search engines in and names the sitemap (the test site on GitHub Pages keeps them out);
// - 404.html names its files from the domain's root (/assets/…), so a missing address at any depth (/a/b/c) still gets
//   a styled page; relative addresses would be looked for next to the missing one;
// - the server settings of deploy/ come along: .htaccess (Apache) and _headers (Netlify, Cloudflare Pages) inside the
//   site's folder, where those hosts read them; nginx.conf and the Caddyfile beside it, not served.
//
// Writes export/site/ (upload its contents into the web root), export/server/ and export/flowmedium-site-<date>-<commit>.zip.
// Stops if anything a launch needs is missing. Nothing in export/ is committed.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const out = join(root, "export");
const site = join(out, "site");
const server = join(out, "server");
const DOMAIN = "https://flowmedium.pro";

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
const fail = (msg) => { console.error("export: " + msg); process.exit(1); };

// 1. the build
run("npm", ["run", "build"]);

// 2. what changes for the real host
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`);
for (const f of ["robots.txt.br", "robots.txt.gz"]) rmSync(join(dist, f), { force: true });

const p404 = join(dist, "404.html");
let html = readFileSync(p404, "utf8")
  .replace(/(href|src)="\.\/"/g, '$1="/"')
  .replace(/(href|src)="\.\/([^"]+)"/g, '$1="/$2"');
if (/(?:href|src)="\.\//.test(html)) fail("404.html still has a relative address");
writeFileSync(p404, html);
// its compressed copies must be the same page
run("node", ["-e", `
  const { readFileSync, writeFileSync } = require("node:fs"), z = require("node:zlib");
  const b = readFileSync(process.argv[1]);
  writeFileSync(process.argv[1] + ".br", z.brotliCompressSync(b, { params: { [z.constants.BROTLI_PARAM_QUALITY]: 11 } }));
  writeFileSync(process.argv[1] + ".gz", z.gzipSync(b, { level: 9 }));
`, p404]);

// 3. the folders
rmSync(out, { recursive: true, force: true });
mkdirSync(server, { recursive: true });
cpSync(dist, site, { recursive: true });
for (const f of [".htaccess", "_headers"]) cpSync(join(root, "deploy", f), join(site, f));
for (const f of ["nginx.conf", "Caddyfile"]) cpSync(join(root, "deploy", f), join(server, f));

// 4. what a launch needs, checked on the files themselves
const must = (cond, msg) => { if (!cond) fail(msg); };
for (const f of ["index.html", "404.html", "privacy_policy_ru.html", "soglasie_cookie.html", "robots.txt", "sitemap.xml",
  "favicon.ico", "apple-touch-icon.png", "og.png", "site.webmanifest", ".htaccess", "_headers"])
  must(existsSync(join(site, f)), `${f} is missing`);
must(!existsSync(join(site, "report")), "the design-system review page must not go to the real host");
must(!/Disallow/i.test(readFileSync(join(site, "robots.txt"), "utf8")), "robots.txt still keeps search engines out");
for (const page of ["index.html", "privacy_policy_ru.html", "soglasie_cookie.html"]) {
  const text = readFileSync(join(site, page), "utf8");
  must(text.includes(`<link rel="canonical" href="${DOMAIN}/`), `${page} has no canonical address on ${DOMAIN}`);
  must(!/github\.io|localhost|127\.0\.0\.1/.test(text), `${page} names the test site or a local address`);
  must(!/name="robots" content="noindex/.test(text), `${page} asks not to be indexed`);
}
for (const [, ref] of readFileSync(join(site, "404.html"), "utf8").matchAll(/(?:href|src)="\/([^"#?]+)"/g))
  must(existsSync(join(site, ref)), `404.html names /${ref}, which is not in the site`);

// 5. the zip, and a note for whoever uploads it
let sha = "local";
try { sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim(); } catch {}
const date = new Date().toISOString().slice(0, 10);
writeFileSync(join(out, "README.txt"), `Flow Medium — the site for ${DOMAIN}
Built ${date} from commit ${sha} (github.com/timofeylebedev/fm).

site/     upload EVERYTHING inside it (including the hidden .htaccess) into the web root of flowmedium.pro
          (on shared hosting usually public_html/ or www/). Plain files: no PHP, database or Node on the server.
server/   settings for your own server, not for uploading: nginx.conf or Caddyfile (see the comment at their top).

Which settings file:
  Apache / shared hosting (Beget, Timeweb, REG.RU …)  site/.htaccess, already in place
  Netlify, Cloudflare Pages                          site/_headers, already in place (drag site/ into the dashboard)
  nginx (VPS)                                        server/nginx.conf
  Caddy (VPS)                                        server/Caddyfile

After uploading, check:
  ${DOMAIN}/                     the page, with pictures and motion
  ${DOMAIN}/privacy_policy_ru    the policy (no .html in the address)
  ${DOMAIN}/soglasie_cookie      the cookie consent
  ${DOMAIN}/no/such/page         the styled 404 page
  http://flowmedium.pro and https://www.flowmedium.pro   lead to ${DOMAIN}/
Then add the site to Yandex Webmaster and Google Search Console and give them ${DOMAIN}/sitemap.xml.
`);

const zip = join(out, `flowmedium-site-${date}-${sha}.zip`);
run("zip", ["-qr9X", zip, "site", "server", "README.txt"], { cwd: out });

let files = 0, bytes = 0;
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else { files++; bytes += s.size; } } };
walk(site);
console.log(`\nexport: ${relative(root, zip)} (${(statSync(zip).size / 1048576).toFixed(1)} MB; site/ ${files} files, ${(bytes / 1048576).toFixed(1)} MB)`);
