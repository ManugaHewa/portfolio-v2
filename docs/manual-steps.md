# Manual steps

Everything in this round that a push to `main` does **not** deploy: the Nginx
config, the server's `.env` files, the Postgres container, the Cloudflare and
GitHub dashboards, and Search Console.

Conventions:

- Server commands are for your SSH session as `manuga`. **One command per
  block**: paste and run each block on its own.
- Commands for your Windows PC are PowerShell 5 and never use `&&`.
- `nano` is used wherever a password would otherwise end up in your shell
  history. Inside nano: paste, then **Ctrl+O**, **Enter** to save,
  **Ctrl+X** to exit.
- Each section says when to do it relative to pushing, and how to undo it.

## In order

| Step | What | Where |
|---|---|---|
| 1 | Push stage 1 | section 0 |
| 2 | Replace the Nginx config | section 1 |
| 3 | `NODE_ENV=production`, `HOST=127.0.0.1`, restart the API | section 3 |
| 4 | Postgres on loopback with a real password (backup first) | section 4 |
| 5 | Insert-only database role for the API (optional) | section 5 |
| 6 | Cloudflare: Web Analytics off, HTTPS settings | section 6 |
| 7 | GitHub: unpublish the github.io copy, Dependabot alerts | section 7 |
| 8 | Push stage 2 | section 0 |
| 9 | Daily retention cron | section 8.1 |
| 10 | Cloudflare: email obfuscation off | section 10.1 |
| 11 | Push stage 3 | section 0 |
| 12 | Search Console: verify, sitemap, indexing | section 9 |
| 13 | A day or two after step 2: enforce the CSP | section 2 |
| 14 | A few days after step 4: delete the database backup | section 4.9 |

---

## 0. Pushing

Nothing has been pushed. The deploy script only ever deploys the newest
commit on `main`, so to deploy in stages and see which stage a failure
belongs to, push to each of these three points in turn, waiting for the
"Deployed" phone alert in between. Run these from the repo folder on your PC.

**Stage 1, security** (Phase 0, the dependency fixes, Phase 1):

```powershell
git push origin f638487:main
```

**Stage 2, privacy, accessibility, search tags** (Phase 2, Phase 3a and the
build fix). Do not push `5b39ff6` or `fce1a1a` on their own: the backend does
not build at those two commits, and `fc40fce` is the fix.

```powershell
git push origin fc40fce:main
```

**Stage 3, prerendering, plus these docs.** Do section 10.1 (Cloudflare email
obfuscation) first or straight after.

```powershell
git push origin main
```

No commit needs a new environment variable or a schema change, so each stage
deploys safely before any of the server steps below. Two things change on the
server by themselves when stage 3 deploys:

- The deploy now runs the seed. Project rows in Postgres are rewritten from
  `content/projects.ts` on every deploy, so any edit made directly in the
  database would be overwritten. Edit `content/projects.ts` instead.
- Unknown URLs only become real 404s once the new Nginx config (section 1)
  is in place.

---

## 1. Nginx: security headers, real client IP, real 404s, anonymised logs

Do this **after** the Phase 1 commits are deployed. The new config lives in the
repo at `deploy/nginx/portfolio.conf`, so the server already has it after a
deploy; these steps put it in place.

### 1.1 Look before replacing

The new file assumes the current one does two things: serve
`/var/www/portfolio` and proxy `/api/` to the API on port 4000. Check:

```bash
cat /etc/nginx/sites-available/portfolio
```

If it contains anything else (another `server` block, a redirect, SSL
settings, extra `location`s), stop here and send it to me.

Check which address cloudflared forwards to:

```bash
sudo grep -rh "service:" /etc/cloudflared ~/.cloudflared
```

Expected: `http://localhost:80`, `http://localhost` or `http://127.0.0.1:80`.
If it names the server's LAN address instead, tell me: the real-IP lines need
that address too.

### 1.2 Back up, replace, test, reload

```bash
sudo cp /etc/nginx/sites-available/portfolio /etc/nginx/sites-available/portfolio.bak-2026-10
```

```bash
sudo cp /home/manuga/portfolio-v2/deploy/nginx/portfolio.conf /etc/nginx/sites-available/portfolio
```

```bash
sudo nginx -t
```

Only continue if that ends with `test is successful`.

```bash
sudo systemctl reload nginx
```

### 1.3 Check it worked

Security headers on the page:

```bash
curl -sI http://localhost/ | grep -iE "content-security|x-content-type|referrer-policy|x-frame"
```

The API still answers:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/projects
```

Expected: `200`. Unknown pages are now real 404s:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/no-such-page
```

Expected: `404`. Now open https://manugahewa.dev on your phone (mobile data,
not Wi-Fi), then:

```bash
sudo tail -n 5 /var/log/nginx/access.log
```

The newest lines should start with your phone's public address ending in `.0`.
If they start with `127.0.0.0`, the real-IP lines are not matching (see 1.1).

### 1.4 Undo

```bash
sudo cp /etc/nginx/sites-available/portfolio.bak-2026-10 /etc/nginx/sites-available/portfolio
```

```bash
sudo nginx -t
```

```bash
sudo systemctl reload nginx
```

## 2. Enforce the Content Security Policy

The policy ships as **Report-Only**: browsers report what it would block but
block nothing. It was tested enforced, in Chrome, against all six 3D scenes and
the project modal, with no violations. Still, give it a day or two: open the
site in Chrome on your PC and phone, open DevTools (F12) > Console, and look
for lines starting `[Report Only]`. The only expected one is
`static.cloudflareinsights.com`, if Cloudflare Web Analytics is still on
(step 6.1 turns it off).

Then switch it to enforcing:

```bash
sudo sed -i 's/Content-Security-Policy-Report-Only/Content-Security-Policy/' /etc/nginx/sites-available/portfolio
```

```bash
sudo nginx -t
```

```bash
sudo systemctl reload nginx
```

```bash
curl -sI http://localhost/ | grep -i "^content-security-policy:"
```

Tell me when it is enforced and I will flip the repo copy to match, so the two
files do not drift. To undo, run the same `sed` with the two names swapped.

## 3. The API's environment (`backend/.env`)

Do this **after** step 1 (the new Nginx config proxies to `127.0.0.1:4000`).

First check how the systemd unit loads its environment:

```bash
systemctl cat portfolio-backend
```

Expected: an `EnvironmentFile=/home/manuga/portfolio-v2/backend/.env` line. If
the unit sets `NODE_ENV` with its own `Environment=` line, tell me.

### 3.1 NODE_ENV

```bash
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' /home/manuga/portfolio-v2/backend/.env
```

```bash
grep -n "NODE_ENV" /home/manuga/portfolio-v2/backend/.env
```

Expected: `NODE_ENV=production`.

### 3.2 Listen on loopback only (optional, recommended)

Stops the API answering on the LAN at port 4000, bypassing Nginx.

```bash
echo "HOST=127.0.0.1" >> /home/manuga/portfolio-v2/backend/.env
```

### 3.3 Restart and check

```bash
sudo systemctl restart portfolio-backend
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/projects
```

Expected: `200`. If not:

```bash
journalctl -u portfolio-backend -n 30 --no-pager
```

To undo 3.2, delete the `HOST=` line with `nano` and restart.

## 4. Postgres: loopback only, real password

Today the container publishes 5432 on every interface with the password
`postgres`, and Docker's published ports bypass UFW. These steps keep the data
volume; a backup is taken first anyway.

### 4.1 Confirm which container and volume

```bash
docker ps --format "{{.Names}}  {{.Ports}}"
```

Expected: a line like `portfolio-v2-db-1  0.0.0.0:5432->5432/tcp`. The
commands below assume that name; if yours differs, substitute it.

```bash
docker inspect portfolio-v2-db-1 --format "{{index .Config.Labels \"com.docker.compose.project.working_dir\"}} {{range .Mounts}}{{.Name}} {{end}}"
```

Expected: `/home/manuga/portfolio-v2 portfolio-v2_db-data`. If the folder or the
volume name differs, **stop and send me the output**: recreating the container
from this compose file could then attach a new, empty volume.

### 4.2 Back up

```bash
docker exec portfolio-v2-db-1 pg_dump -U postgres portfolio > /home/manuga/portfolio-db-backup-2026-10.sql
```

```bash
ls -lh /home/manuga/portfolio-db-backup-2026-10.sql
```

The file should be tens of kilobytes or more, not zero.

### 4.3 Choose a password

Hex only, so it needs no escaping inside a connection URL:

```bash
openssl rand -hex 24
```

Copy the output somewhere safe (a password manager). It is `NEWPASSWORD` below.

### 4.4 Change it inside Postgres

The `POSTGRES_PASSWORD` variable only applies when a database is first
created, so the existing one has to be changed from inside. Open psql:

```bash
docker exec -it portfolio-v2-db-1 psql -U postgres
```

At the `postgres=#` prompt, type this and press Enter, then paste the new
password twice when asked (nothing is shown as you paste):

```sql
\password postgres
```

Then leave psql:

```sql
\q
```

From this moment the API cannot connect until 4.5 is done, so do it straight away.

### 4.5 Put the new password in both `.env` files

In each file, the `DATABASE_URL` line changes in two places: the password after
`postgres:`, and the host, which becomes `127.0.0.1` instead of `localhost`
(after 4.6, `localhost` may resolve to an IPv6 address Postgres no longer
listens on). The line should end up as:

`DATABASE_URL="postgresql://postgres:NEWPASSWORD@127.0.0.1:5432/portfolio?schema=public"`

```bash
nano /home/manuga/portfolio-v2/backend/.env
```

```bash
nano /home/manuga/portfolio-v2/.env
```

In the second file (the repo-root one), also add this line, which
`docker compose` reads:

`POSTGRES_PASSWORD=NEWPASSWORD`

### 4.6 Recreate the container on loopback only

```bash
cd /home/manuga/portfolio-v2
```

```bash
docker compose up -d db
```

```bash
docker ps --format "{{.Names}}  {{.Ports}}"
```

Expected: `127.0.0.1:5432->5432/tcp`.

### 4.7 Restart the API and check

```bash
sudo systemctl restart portfolio-backend
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/projects
```

Expected: `200`. Then, on your Windows PC, with the server's LAN address in
place of `192.168.1.50`:

```powershell
Test-NetConnection 192.168.1.50 -Port 5432
```

Expected: `TcpTestSucceeded : False`. That is the "not reachable from another
machine on my network" check.

### 4.8 Undo

If the API will not connect, the quickest way back is to set the password
back to what the `.env` files hold, using 4.4 again. To restore data from the
backup (only if something was lost):

```bash
docker exec -i portfolio-v2-db-1 psql -U postgres portfolio < /home/manuga/portfolio-db-backup-2026-10.sql
```

### 4.9 Delete the backup once all is well

The backup holds every contact message, and the privacy page promises they go
after 12 months. Once the site has run normally for a few days:

```bash
rm /home/manuga/portfolio-db-backup-2026-10.sql
```

## 5. A least-privilege database role for the API (optional, recommended)

The API no longer needs to read contact messages back (it inserts them
without `RETURNING`), so it can run as a role that can read projects and add
messages and do nothing else. Migrations, the seed and the admin scripts keep
using `postgres` through the repo-root `.env`, which is the file `deploy.sh`'s
Prisma commands read.

Do this **after** step 4 and after the Phase 1 commits are deployed.

### 5.1 Create the role

Choose its password the same way as 4.3 (`APPPASSWORD` below):

```bash
openssl rand -hex 24
```

Open psql on the portfolio database:

```bash
docker exec -it portfolio-v2-db-1 psql -U postgres -d portfolio
```

At the `portfolio=#` prompt, run these one at a time:

```sql
CREATE ROLE portfolio_app LOGIN PASSWORD 'APPPASSWORD';
```

```sql
GRANT CONNECT ON DATABASE portfolio TO portfolio_app;
```

```sql
GRANT USAGE ON SCHEMA public TO portfolio_app;
```

```sql
GRANT SELECT ON "Project", "ProjectLink" TO portfolio_app;
```

```sql
GRANT INSERT ON "ContactMessage" TO portfolio_app;
```

```sql
\q
```

### 5.2 Point the API at it

Only `backend/.env` changes; leave the repo-root `.env` on `postgres`.

```bash
nano /home/manuga/portfolio-v2/backend/.env
```

`DATABASE_URL="postgresql://portfolio_app:APPPASSWORD@127.0.0.1:5432/portfolio?schema=public"`

```bash
sudo systemctl restart portfolio-backend
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/projects
```

Expected: `200`. Send yourself a message through the contact form, then check
it arrived:

```bash
docker exec portfolio-v2-db-1 psql -U postgres -d portfolio -c "SELECT count(*) FROM \"ContactMessage\";"
```

Confirm the deploy's Prisma commands still use the owner role. This must say
`Database schema is up to date!`; a "permission denied" means it picked up
`backend/.env`, so tell me:

```bash
cd /home/manuga/portfolio-v2
```

```bash
npx prisma migrate status --schema backend/prisma/schema.prisma
```

When a future migration adds a table the API reads or writes, grant it the same
way as 5.1.

### 5.3 Undo

Put the `postgres` URL back in `backend/.env` and restart the API.

## 6. Cloudflare dashboard

Any time; none of this depends on a push.

### 6.1 Turn off Web Analytics

Cloudflare is injecting its analytics script (`static.cloudflareinsights.com`)
into every page. The brief's default is no analytics, and the new CSP would
block it anyway. In the dashboard: **Analytics & Logs > Web Analytics**, open
`manugahewa.dev`, **Manage site**, and turn off automatic setup (or remove the
site). Then, on the server:

```bash
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36" https://manugahewa.dev/ | grep -c cloudflareinsights
```

Expected: `0`. (Decision 4 in the audit: if you would rather keep it, tell me
and I will add it to the CSP and the privacy page instead.)

### 6.2 HTTPS

**SSL/TLS > Edge Certificates**:

- **Always Use HTTPS**: On.
- **HTTP Strict Transport Security (HSTS)**: Enable. Max Age 6 months,
  Include subdomains On only if every subdomain you will ever use is HTTPS,
  Preload Off (preloading is hard to undo; revisit after a few months),
  No-Sniff On.
- **Minimum TLS Version**: TLS 1.2.
- **Automatic HTTPS Rewrites**: On.

Check:

```bash
curl -sI http://manugahewa.dev/ | head -n 3
```

Expected: a `301` to `https://`.

```bash
curl -sI https://manugahewa.dev/ | grep -i strict-transport
```

## 7. GitHub

### 7.1 Take down the old github.io copy

The Phase 1 commits delete the Jekyll workflow, but the site it already
published stays up until you unpublish it: **Settings > Pages**, then next to
"Your site is live at", the **...** menu > **Unpublish site**. Check after a few
minutes, from your PC:

```powershell
curl.exe -s -o NUL -w "%{http_code}" https://manugahewa.github.io/portfolio-v2/
```

Expected: `404`.

### 7.2 Dependabot

`.github/dependabot.yml` asks for weekly update PRs. Also switch on alerts:
**Settings > Code security > Dependabot alerts: Enable** and **Dependabot
security updates: Enable**. Remember that merging any PR deploys it.

## 8. Contact messages: retention and deletion requests

Do this **after** the Phase 2 commit is deployed (it adds the scripts). Both
scripts run from the repo folder, so they pick up the owner credentials in
the repo-root `.env`; the API's own role cannot read or delete messages.

### 8.1 Delete messages older than 12 months, daily

The privacy page promises this, so it has to actually run. See what it would
do first:

```bash
npm --prefix /home/manuga/portfolio-v2 run --silent contact:prune -- --dry-run
```

Then add it to your crontab, next to the deploy job:

```bash
crontab -e
```

Paste this line at the bottom (it runs at 03:17 every night), save and exit:

`17 3 * * * /usr/bin/npm --prefix /home/manuga/portfolio-v2 run --silent contact:prune >> /home/manuga/contact-prune.log 2>&1`

Check it is there:

```bash
crontab -l
```

The log only ever holds a timestamp and a count. To keep messages for a
different period, add `CONTACT_RETENTION_DAYS=` to the repo-root `.env`, and
tell me so the privacy page and the line under the form say the same.

### 8.2 When someone asks for their messages to be deleted

See how many there are:

```bash
npm --prefix /home/manuga/portfolio-v2 run --silent contact:delete -- someone@example.com --dry-run
```

Delete them:

```bash
npm --prefix /home/manuga/portfolio-v2 run --silent contact:delete -- someone@example.com
```

Then reply to say it is done. The address matches regardless of capitals.

### 8.3 Keep the privacy page true

`/privacy` describes the server after sections 1, 6.1 and 8.1: anonymised
logs, no analytics, deletion after 12 months. Do those three before or soon
after deploying Phase 2. It also says the server is in Ontario, Canada;
tell me if that is wrong.

## 9. Getting found: Search Console

Any time, but the sitemap only exists once stage 2 is deployed.

### 9.1 Check what Google will see

The page should answer with your name in the HTML itself, no JavaScript
needed (after stage 3):

```bash
curl -s https://manugahewa.dev/ | grep -o "<h1[^>]*>[^<]*</h1>"
```

Expected: `<h1 class="hero-subtitle hero-stagger">Manuga Hewa Pathirana</h1>`.

```bash
curl -s https://manugahewa.dev/robots.txt
```

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://manugahewa.dev/sitemap.xml
```

Expected: `200 text/xml` (it was the home page's HTML before).

### 9.2 Verify the domain

1. Open https://search.google.com/search-console and choose **Add property**,
   then the **Domain** option (left side), and enter `manugahewa.dev`.
2. Google shows a TXT record starting `google-site-verification=`. Copy it.
3. In the Cloudflare dashboard: **manugahewa.dev > DNS > Records > Add
   record**. Type `TXT`, Name `@`, Content: paste the value, TTL Auto. Save.
4. Back in Search Console, press **Verify**. If it fails, wait ten minutes
   and press it again; DNS takes a moment.

Keep the TXT record: removing it un-verifies the property.

### 9.3 Submit the sitemap and ask for indexing

1. In the property: **Sitemaps** (left menu), enter `sitemap.xml`, **Submit**.
2. **URL inspection** (top search bar): enter `https://manugahewa.dev/`,
   then **Request indexing**. Do the same for `https://manugahewa.dev/privacy`.
3. Optional: Bing Webmaster Tools (https://www.bing.com/webmasters) can import
   the property straight from Search Console.

Indexing takes days to weeks. Searching `site:manugahewa.dev` shows what is in.

### 9.4 Check the link preview

Paste `https://manugahewa.dev` into LinkedIn's Post Inspector
(https://www.linkedin.com/post-inspector/). It should show the dark card with
your name, from `og.png`. LinkedIn caches previews, so the inspector is also
how to refresh an old one.

## 10. Cloudflare settings that interfere with prerendered pages

### 10.1 Email Address Obfuscation: off

Do this before or straight after deploying stage 3. Cloudflare rewrites any
email address it finds in HTML into `[email protected]` and inserts a script
to decode it. Until now the address only existed after JavaScript ran, so it
never applied. With the pages prerendered, it would rewrite the HTML React is
about to hydrate, React would find it does not match, and it would discard
the server HTML and render the page again.

In the dashboard: **manugahewa.dev > Scrape Shield** (on newer dashboards,
**Security > Settings**), **Email Address Obfuscation: Off**. Then check:

```bash
curl -s https://manugahewa.dev/ | grep -c "email-protection"
```

Expected: `0`.

### 10.2 Rocket Loader and HTML minification: off

They rewrite scripts and markup the same way. Neither is on today (the live
HTML has no sign of them); leave them off: **Speed > Optimization**.

---

## Optional: switching on Cloudflare Turnstile

Off by default (decision 3). To switch it on:

1. Cloudflare dashboard, **Turnstile > Add widget**, hostname `manugahewa.dev`.
   It gives a site key and a secret key.
2. Site key, read at build time. On the server:

   ```bash
   echo "VITE_TURNSTILE_SITE_KEY=YOUR_SITE_KEY" > /home/manuga/portfolio-v2/frontend/.env.production
   ```

3. Secret key, for the API: add a line `TURNSTILE_SECRET_KEY=YOUR_SECRET_KEY` to

   ```bash
   nano /home/manuga/portfolio-v2/backend/.env
   ```

4. In `/etc/nginx/sites-available/portfolio`, add
   `https://challenges.cloudflare.com` to both `script-src` and `frame-src`,
   then `sudo nginx -t` and `sudo systemctl reload nginx`.
5. Restart the API, then push any commit (or ask me) so the frontend rebuilds
   with the key.
6. Ask me to add a sentence about Turnstile to the privacy page.
