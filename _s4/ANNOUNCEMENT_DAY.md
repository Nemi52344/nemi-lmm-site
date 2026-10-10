# Announcement day runbook (BCA signing)

Announcement day is a switch-on, not a build. Everything below is built and cleared in advance.
Investors, arbitrageurs and press hit nemilmm.com within minutes of the release.

## Before the day (now)

| # | Item | Owner | Done |
|---|---|---|---|
| 1 | `_investors-draft.html` filled with the final release wording, cleared by counsel | Marketing + counsel | ☐ |
| 2 | `_s4/legends-draft.html` final wording from counsel | Counsel | ☐ |
| 3 | Bios and entity description match the S-4 draft word for word | Counsel + CFO | ☐ |
| 4 | Evidence audit closed out: every High row has a source or the claim is gone | CFO + COO | ☐ |
| 5 | invest.nemilmm.com decision made and executed | CEO + counsel | ☐ |
| 6 | IR email address live and monitored | CFO | ☐ |
| 7 | Employee and advisor social media rule circulated; sponsor side mirrors it | Marketing + HR | ☐ |
| 8 | Shared communications calendar with the sponsor | Marketing + sponsor IR | ☐ |

## On the day, in order

1. **Wait for the release to be filed.** Nothing goes live on the site before the SPAC files the
   8-K and the release. Confirm with counsel, not with a news alert.
2. **Publish, in one deploy:**
   - `_investors-draft.html` → `investors.html` (delete the robots noindex line, fill every `{{ }}`)
   - `_s4/legends-draft.html` → `legends.html`, switched to the "intends to file" wording
   - Nav link on every page: replace the Invest button with Investors
   - `invest.html`: redirect to `investors.html`, or take it down
   - `sitemap.xml`: add both pages
   - Check with `grep -rn "{{" investors.html legends.html`. Zero hits allowed.
3. **File the Form 425.** Nemi files the release the same day. Everything public that mentions the
   deal is filed the day it first goes out: web pages, posts, customer emails, interviews.
4. **Post once on LinkedIn and X**, linking to the Investors page, with the legends link. Nothing else
   from any other account.
5. **Log every change** in `CHANGELOG.md` with the time it went live.

## Stays off the site on announcement day

- Acquisition target names, bridge-round or SAFE size, individual shareholder detail
- Board changes that only take effect at closing
- Any number not in the filed release, presentation or S-4
- A "website version" of the deck with different figures

## The week after

- Interviews, podcasts, panels: each one transcribed and filed the same day. Keep the round short.
- No new figures between filings. Quarterly results go into the S-4 amendment, not a website post.
- Wayback Machine check: confirm no cached page ever stated a valuation before the announced one.
