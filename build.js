/* Build script for the NEMI Basic static site.
   Usage: node build.js
   - Copies ONLY assets referenced by the pages/CSS into dist/
   - Recompresses oversized images (PNG photos become JPEG, references rewritten)
   - Emits netlify.toml and nemi-basic-site.zip for drag-and-drop hosting */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let sharp = null;
try {
  sharp = require("C:/Users/Marketing/AppData/Local/npm-cache/_npx/a1dd449879249470/node_modules/sharp");
} catch (e) {
  console.log("note: sharp unavailable — images ship unoptimized");
}

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const PAGES = ["home.html", "about.html", "services.html", "careers.html", "master-plan.html"];
const IMG_BUDGET = 350 * 1024;   // recompress anything bigger than this
const MAX_W = 1920;

const NETLIFY_TOML = `[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
`;

/* ---------- 1. Collect referenced asset paths ---------- */
const refs = new Set(["assets/css/style.css", "assets/js/fx.js", "assets/css/home.css", "assets/js/home.js"]);
const refRe = /assets\/[A-Za-z0-9_\-./]+?\.(?:png|jpe?g|webp|svg|mp4|ico)/g;

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  for (const m of html.match(refRe) || []) refs.add(m);
}
const css = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
for (const m of css.match(/url\(["']?\.\.\/([A-Za-z0-9_\-./]+?)["']?\)/g) || []) {
  const rel = m.replace(/url\(["']?\.\.\//, "").replace(/["']?\)$/, "");
  refs.add("assets/" + rel);
}

/* ---------- 2. Fresh dist, copy pages + referenced assets ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const page of PAGES) fs.copyFileSync(path.join(ROOT, page), path.join(DIST, page));

let missing = [];
for (const ref of refs) {
  const src = path.join(ROOT, ref);
  if (!fs.existsSync(src)) { missing.push(ref); continue; }
  const dest = path.join(DIST, ref);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/* ---------- 3. Optimize oversized images in dist ---------- */
const renames = [];   // [from, to] relative paths for reference rewriting

async function optimize() {
  if (!sharp) return;
  for (const ref of [...refs]) {
    if (!/\.(png|jpe?g)$/i.test(ref)) continue;
    const p = path.join(DIST, ref);
    if (!fs.existsSync(p) || fs.statSync(p).size <= IMG_BUDGET) continue;

    const input = fs.readFileSync(p);           /* work from a buffer: no file locks */
    const meta = await sharp(input).metadata();
    const isPng = /\.png$/i.test(ref);
    const before = input.length;

    if (isPng && !meta.hasAlpha) {
      /* photographic PNG -> JPEG + rename + rewrite refs */
      const newRef = ref.replace(/\.png$/i, ".jpg");
      const buf = await sharp(input).resize(MAX_W, null, { withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      fs.writeFileSync(path.join(DIST, newRef), buf);
      fs.rmSync(p);
      renames.push([ref, newRef]);
      console.log(`  ${ref} -> .jpg  ${(before/1048576).toFixed(1)}MB -> ${(buf.length/1048576).toFixed(1)}MB`);
    } else if (isPng) {
      const buf = await sharp(input).resize(MAX_W, null, { withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true }).toBuffer();
      if (buf.length < before) fs.writeFileSync(p, buf);
    } else {
      const buf = await sharp(input).resize(MAX_W, null, { withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      if (buf.length < before) fs.writeFileSync(p, buf);
    }
  }
  /* rewrite renamed references in dist HTML + CSS */
  if (renames.length) {
    const files = [...PAGES.map(p => path.join(DIST, p)), path.join(DIST, "assets/css/style.css")];
    for (const f of files) {
      let txt = fs.readFileSync(f, "utf8");
      for (const [from, to] of renames) {
        txt = txt.split(from).join(to);
        txt = txt.split(path.basename(from)).join(path.basename(to));
      }
      fs.writeFileSync(f, txt);
    }
  }
}

/* ---------- 4. Config, zip, report ---------- */
function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    total += stat.isDirectory() ? dirSize(p) : stat.size;
  }
  return total;
}

optimize().then(() => {
  fs.writeFileSync(path.join(DIST, "netlify.toml"), NETLIFY_TOML);

  const zipPath = path.join(ROOT, "nemi-basic-site.zip");
  fs.rmSync(zipPath, { force: true });
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${DIST}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: "inherit" }
  );

  const mb = (n) => (n / 1048576).toFixed(1) + " MB";
  console.log("");
  console.log("Build complete.");
  console.log("  referenced assets:  " + refs.size);
  console.log("  dist/               " + mb(dirSize(DIST)));
  console.log("  nemi-basic-site.zip " + mb(fs.statSync(zipPath).size));
  if (missing.length) console.log("  WARNING missing: " + missing.join(", "));
  console.log("");
  console.log("Deploy: drag nemi-basic-site.zip (or the dist folder) onto https://app.netlify.com/drop");
});
