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

---

## 0. Pushing

Every commit in this round is safe to deploy before any of the steps below:
nothing requires a new environment variable, and the one schema-free database
change (the insert-only role) is optional.

The deploy script only ever deploys the newest commit on `main`. To deploy one
phase at a time and see which one a failure belongs to, push one commit at a
time and wait for the "Deployed" phone alert in between. From the repo folder
on your PC, list the commits:

```powershell
git log --oneline origin/main..main
```

Then push them oldest first, replacing `SHA` each time:

```powershell
git push origin SHA:main
```

Or push everything at once:

```powershell
git push origin main
```

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
