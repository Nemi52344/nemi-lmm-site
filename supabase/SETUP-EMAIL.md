# Getting form submissions into the Outlook inbox

Everything here lives in Supabase. Netlify is not involved.

How it flows:

```
visitor submits  ->  row inserted in public.submissions
                 ->  Database Webhook fires on INSERT
                 ->  Edge Function "notify-submission" sends the email
                 ->  info@nemilmm.com  (Microsoft 365)
```

Submissions already reach the table today — verified with a live insert
(`201 Created`). The only missing piece is the notification.

---

## 1. Deploy the function

From the project folder, once per machine:

```bash
npx supabase login
npx supabase link --project-ref wrkfxtodkxhhlzmfpvgt
npx supabase functions deploy notify-submission
```

`supabase/config.toml` already pins `verify_jwt = false` for this function, so
the flag does not need remembering. It matters because Database Webhooks call
the function without a user JWT — with verification on, every notification is
rejected as unauthorised.

**No CLI?** You can paste the function instead: Dashboard -> **Edge Functions**
-> **Deploy a new function** -> name it `notify-submission`, paste the contents
of `functions/notify-submission/index.ts`, and turn **Verify JWT** OFF.

## 2. Resend: account, domain, key

1. Sign up at resend.com
2. **Domains** -> **Add Domain** -> `nemilmm.com`
3. Add the DNS records it gives you. **Add them alongside what is already
   there — do not replace anything.** nemilmm.com currently has:
   - `MX` -> `nemilmm-com.mail.protection.outlook.com` (Microsoft 365 —
     this is how the mailbox receives mail; leave it alone)
   - `TXT` -> `v=spf1 include:spf.protection.outlook.com -all`
     (leave alone — overwriting it breaks Microsoft 365 sending)
   - `TXT` -> `google-site-verification=...` (leave alone)

   Resend's records go on the `send.nemilmm.com` subdomain plus a DKIM record
   at `resend._domainkey`, so they do not collide with any of the above.
4. Wait for the domain to show **Verified**
5. **API Keys** -> **Create** -> copy the `re_...` value

Then set it as a function secret:

```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxx
npx supabase secrets set NOTIFY_TO=info@nemilmm.com
npx supabase secrets set MAIL_FROM="NEMI <info@nemilmm.com>"
```

Until the domain shows Verified, Resend only delivers to the address the
account was signed up with — a test that "fails" before then is usually this,
not a broken config.

## 3. Create the webhook

Supabase Dashboard -> **Database** -> **Webhooks** -> **Create a new hook**

| Field      | Value                       |
| ---------- | --------------------------- |
| Name       | `notify-submission`         |
| Table      | `public.submissions`        |
| Events     | `Insert`                    |
| Type       | Supabase Edge Functions     |
| Edge Function | `notify-submission`      |
| Method     | `POST`                      |

## 4. Test it

Send a test straight at the function, without going through the site:

```bash
curl -X POST \
  "https://wrkfxtodkxhhlzmfpvgt.supabase.co/functions/v1/notify-submission" \
  -H "Content-Type: application/json" \
  -d '{"record":{"form":"contact","name":"Test","email":"you@example.com","message":"Hello","email_verified":true}}'
```

`{"ok":true}` means the mail went out. Anything else is logged under
**Edge Functions -> notify-submission -> Logs**.

Then submit through the live contact form and confirm it arrives.

---

## If nothing arrives

- **Edge Functions -> Logs** shows whether the function ran and what it said.
- **Database -> Webhooks -> the hook -> Logs** shows whether Supabase called it.
- A 500 from the function means no transport is configured, or the send failed —
  the log line says which.
- Check the junk folder: mail sent as `@nemilmm.com` from a sender that is not
  Microsoft will fail SPF against the existing `-all` record unless the sending
  domain is properly set up (this is what Resend's DKIM records fix).
