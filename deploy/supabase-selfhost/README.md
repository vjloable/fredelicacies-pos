# Migrating from Supabase Cloud to self-hosted Supabase on DigitalOcean

Target: the official Supabase Docker stack (Postgres 17, Auth, PostgREST, Realtime,
Storage, Studio) on a Droplet behind Caddy (HTTPS). The app keeps using
`@supabase/supabase-js`, so code changes are limited to env vars and the
`next.config.ts` image host.

What the POS depends on (all carried over):

| Feature | Detail | How it moves |
| --- | --- | --- |
| Database | ~39 MB, 46 migrations, RLS, RPCs | `migrate-db.sh` (CLI dump → psql restore) |
| Auth | 11 users, email/password, reset, OTP | Included in dump; **passwords keep working**, everyone must log in again (new JWT secret) |
| Storage | 4 public buckets, 95 objects, ~100 MB | `migrate-storage.sh` (rclone over S3) |
| Realtime | 19 tables in `supabase_realtime` | Publication in dump; `post-restore.sql` re-asserts it |
| pg_cron | `end-stale-cash-on-hand` @ 16:05 UTC | Recreated in `post-restore.sql` |
| Image URLs | `branches.logo_url`, `*.img_url` | Rewritten in `post-restore.sql` |

## 0. Droplet prerequisites

- Minimum **4 GB RAM / 2 vCPU / 80 GB** (the full stack idles at ~2.5 GB). Ubuntu 24.04.
- Enable **Droplet Backups** in the DO console.
- **DO Cloud Firewall** with inbound **22, 80, 443 only**. Use the DO firewall, not ufw:
  Docker-published ports (5432/6543/8000) bypass ufw, but not the DO Cloud Firewall.
- DNS A record, e.g. `db.<yourdomain>` → droplet IP.

## 1. Install Supabase on the droplet

```sh
ssh root@<droplet-ip>
curl -fsSL https://supabase.link/setup.sh | sh     # prompts for URLs, generates all secrets
cd supabase-project
sh run.sh config add pg17     # cloud runs PG17; must be set BEFORE first start
sh run.sh config add caddy    # HTTPS via Let's Encrypt
```

Edit `.env`:

```sh
SUPABASE_PUBLIC_URL=https://db.<yourdomain>
API_EXTERNAL_URL=https://db.<yourdomain>
PROXY_DOMAIN=db.<yourdomain>
SITE_URL=https://<pos-app-domain>                     # the POS, not the DB domain
ADDITIONAL_REDIRECT_URLS=https://<pos-app-domain>/**,http://localhost:3000/**
ENABLE_EMAIL_AUTOCONFIRM=true                        # matches cloud (confirmation off)

# Required for password reset emails. The cloud project used Supabase's mailer;
# self-hosted has none. Brevo / Resend / AWS SES free tiers are fine.
SMTP_ADMIN_EMAIL=...
SMTP_HOST=...
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_SENDER_NAME=Fredelicacies POS
```

Also confirm `S3_PROTOCOL_ACCESS_KEY_ID` / `_SECRET` are set (needed for the storage copy).

```sh
sh run.sh start && docker compose ps          # all (healthy)
curl -I https://db.<yourdomain>/auth/v1/      # expect 401
sh run.sh secrets                             # keys for .env.migrate + Vercel
```

Studio is at `https://db.<yourdomain>` (basic auth: `DASHBOARD_USERNAME`/`PASSWORD`).

## 2. Rehearsal (do this first, while the cloud stays live)

On your Mac: start Docker Desktop, `brew install rclone`, then:

```sh
cd deploy/supabase-selfhost
cp .env.migrate.example .env.migrate   # fill in
./migrate-db.sh                         # dump + restore + post-restore + row-count diff
./migrate-storage.sh
```

If the restore fails on a version mismatch (a `COPY` into an auth/storage table or
column the self-hosted version lacks), comment out that `COPY ... FROM stdin;` block
through its `\.` in `dump/data.sql` and re-run `./migrate-db.sh restore`. See
"Version mismatches" in https://supabase.com/docs/guides/self-hosting/restore-from-platform.
To re-run a rehearsal from clean, run `sh reset.sh` on the droplet and repeat step 1.

Smoke-test locally: point `.env.local` at the new URL and key, run `npm run dev`, then
check login, a sale (realtime updates on a second tab), image upload, transfers, and password reset email.

## 3. Cutover (pick a closed-store window)

1. Tell staff to stop using the POS. Optionally pause writes on the cloud project.
2. On the droplet: `sh reset.sh -y`, then repeat step 1 (fresh DB, same `.env`).
3. `./migrate-db.sh && ./migrate-storage.sh`. Check that the row counts match.
4. Vercel → Project → Settings → Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL=https://db.<yourdomain>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<SUPABASE_PUBLISHABLE_KEY>`).
     The code prefers ANON_KEY, so remove the old cloud value from whichever var you are not using.
5. Redeploy (`NEXT_PUBLIC_*` vars are baked in at build time).
6. Everyone logs in again with their existing passwords.
7. Keep the cloud project **for at least 2 weeks** as rollback (rolling back = revert the env vars and redeploy;
   writes made after cutover would be lost).

## 4. After cutover

- Install `backup.sh` on the droplet (cron instructions inside) and test a restore once.
- Update `supabase/MIGRATIONS.md`: migrations now run in self-hosted Studio → SQL Editor.
- The Supabase MCP / `supabase` CLI linked commands target the cloud project, not this server.
- Update the stack monthly: https://github.com/supabase/supabase/blob/master/docker/CHANGELOG.md
