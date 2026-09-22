# NEMI blog: structure and rules (S-4 process)

The blog stays open, but it is not a growth channel until closing. The plan is explicit:
no expanded content campaign and no new "AI" positioning push during the process.
Publish rarely, publish only what can be proven, and log everything.

## Structure

| Piece | File | Notes |
|---|---|---|
| Index | `blog.html` | Post cards newest first, category filter (appears at 2+ categories), year archive |
| Post | `blog-<slug>.html` | Built from `_post-template.html`. Flat URLs, same as the rest of the site |
| Template | `_post-template.html` | Blocked from the public site in `netlify.toml`. Never link to it |
| Styles / script | `assets/css/blog.css`, `assets/js/blog.js` | Only blog pages load them |
| Founder's letter | `master-plan.html` | Existing post, keeps its own plate design |

**Categories (pick exactly one):**

| Category | For | Examples |
|---|---|---|
| Company | Letters, hiring, certifications, site openings already completed | Master Plan |
| Engineering | How the LMM, Anvil, Orion, Atlas work, stated at their real status | "How Anvil generates fixture designs" |
| Factory floor | Process notes, quality, delivered work with evidence | "What First / Middle / Last inspection means" |
| Industry | Views on manufacturing and Physical AI, clearly framed as opinion | "Why hardware data is scarce" |

There is no News, Press or Investors category. Anything about the transaction lives only on the
Investors page, is filed with the SEC on Form 425 the day it goes out, and carries the legends.

## Every post must have

1. Author name and role, published date, updated date if edited, category.
2. A numbered source for every figure, customer result or comparison, each mapped to a row in `S4_evidence_audit.xlsx`.
3. The forward-looking statements note if it mentions plans, roadmap, targets or ambitions.
4. An update-history line for every edit after publishing. No silent edits.
5. A row in `CHANGELOG.md` with counsel's sign-off, before it goes live.

## Never on the blog

- The SPAC, the deal, a listing, valuation, ownership, projections, timetable, fundraising or the SAFE.
- Numbers that are not in a filed document or backed by a document in the evidence audit.
- Absolutes: "only", "every", "first", "the leading", "guaranteed", "proven" without proof.
- Customer names, logos, photos of their parts or quotes without written permission on file.
- Related-party results (BNC) presented as outside proof. Label them as internal programs.
- Product status beyond what is true today: no "live" unless in paid production use.
- Personal posts by employees or advisors about the company. One cleared channel only.

## How to add a post

1. `cp _post-template.html blog-<slug>.html`
2. Fill every `{{PLACEHOLDER}}`. Check with `grep -n "{{" blog-<slug>.html`: zero hits allowed.
3. Delete the `robots noindex` line and any optional block you did not use.
4. In `blog.html`: copy the card to the top of `.posts`, add an archive line, add the post to the Blog JSON-LD.
5. Add the URL to `sitemap.xml`.
6. Add the evidence rows to the audit and a row to `CHANGELOG.md`. Counsel clears. Then deploy.

## Archive check (done 22 Sep 2026)

Searched the full git history of the site for valuation, SPAC, de-SPAC, pre-money, post-money,
market cap, enterprise value, ticker, Nasdaq and NYSE. Clean: the only hits are this S-4 workspace
itself and the word "evaluation". Still to check: Wayback Machine snapshots of nemilmm.com,
LinkedIn and X posts, and invest.nemilmm.com.
