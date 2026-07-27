# NEMI LMM — Website

Static marketing site for **NEMI AI** and the Large Manufacturing Model (LMM) — Physical AI for manufacturing.

## Structure

- `index.html` and the other top-level `*.html` files are the pages.
- `assets/` — `css/`, `js/`, `img/`, and `video/`.
- `netlify.toml` — redirects and asset caching for Netlify.

## Local preview

Any static file server works, e.g.:

```bash
npx serve .
```

Then open the printed `localhost` URL.

## Deploy

The site is fully static.

- **Netlify** (recommended): connect this repo, or drag the site folder into a manual deploy. The contact form uses Netlify Forms, so submissions are captured automatically.
- **GitHub Pages / Cloudflare Pages / any static host**: serve the repo root (`index.html` is at the top level). On non-Netlify hosts the contact form needs a form backend (e.g. Formspree) to collect submissions.
