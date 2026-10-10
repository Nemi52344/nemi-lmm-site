# Where this site is hosted

Two tracks, on purpose. They are not connected to each other.

| | Branch | Host | Deployed by | URL |
|---|---|---|---|---|
| **Live** | `main` | nginx on AWS EC2, 13.205.20.121, ap-south-1 | Pulled onto the server by hand | https://nemilmm.com |
| **Demo** | `BCA-Ready` | Netlify (free) | Automatic on every push | https://bca-ready--<site-name>.netlify.app |

The repo is not linked to Netlify yet. The `netlify.toml` in it was written for a
Netlify deploy that never happened. Connecting it is a one-time job, below.

## Connect the demo (one time, about five minutes)

1. `git push origin BCA-Ready` and `git push origin main`.
2. app.netlify.com, log in, **Add new site → Import an existing project → GitHub**,
   pick `Nemi52344/nemi-lmm-site`.
3. Set **Production branch** to `main`, then **Branch deploys → Let me add
   individual branches** and add `BCA-Ready`.
   Stop Netlify from publishing `main` anywhere public: under **Build & deploy →
   Build settings**, either set the production branch to `BCA-Ready` instead, or
   leave production stopped. The live site is EC2's job, not Netlify's.
4. Add the environment variables from `.env.example` under **Site settings →
   Environment variables**, or the contact form and OTP will fail on the demo:
   `RESEND_API_KEY`, `OTP_SECRET`, `OTP_FROM`, `NOTIFY_TO`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.
   Use test values on the demo, not the live keys.

After that, every push to `BCA-Ready` rebuilds the demo in about a minute.

## What the demo will not show

Blocked in `netlify.toml`, in every context:

- `/_s4/*` — the evidence audit, change log, legends draft, blog rules
- `/_investors-draft.html` — the Investors page draft
- `/_post-template.html` — the blog post template

Branch deploys and deploy previews also send `X-Robots-Tag: noindex, nofollow`,
so a demo URL cannot be indexed. It is still a public URL to anyone who has it:
treat it as shareable-with-the-team, not secret. Netlify's password protection is
a paid feature; if the demo must be private, that is the upgrade to buy.

## Going live

When the demo is approved:

1. Merge `BCA-Ready` into `main`, resolving the `about.html` conflict (main already
   carries the CFO and CSO change).
2. Push `main`.
3. Tell whoever runs the EC2 box to pull `main` and deploy it.
4. Log the date each change went live in `_s4/S4_change_log.xlsx`, or in the Google
   Sheet copy, which is the working version.

Nothing reaches nemilmm.com without step 3. Netlify never touches it.
