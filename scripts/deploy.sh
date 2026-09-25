#!/usr/bin/env bash
#
# Deploy portfolio-v2 on ManugaServer. Driven by cron every five minutes.
#
# Replaces the untracked ~/portfolio-v2/deploy.sh, and fixes the five problems
# that version had:
#
#   a. `npm install` rewrote package-lock.json on the server, so the next
#      `git pull` aborted with "local changes would be overwritten". Now the
#      working tree is reset to origin outright and dependencies come from
#      `npm ci`, which installs the lockfile instead of editing it.
#   b. It never ran `prisma generate` or `prisma migrate deploy`, so a schema
#      change reached neither the client nor the database. That is what caused
#      the P2022 "column Project.category does not exist" outage.
#   c. `cp -r` left stale hashed assets behind forever. rsync --delete does not.
#   d. It compared HEAD to origin, so a failed build still moved HEAD and the
#      next run decided there was nothing to do. Success is now recorded in a
#      state file only after verification passes, so a broken deploy retries.
#   e. It was not in git. This is.
#
# Sudo surface is unchanged: the single restart permitted by
# /etc/sudoers.d/portfolio-deploy. Everything else runs as manuga, which is why
# /var/www/portfolio is owned by manuga.
set -euo pipefail

# cron gets a near-empty PATH, and node/npm/npx come from NodeSource in /usr/bin.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

REPO=/home/manuga/portfolio-v2
BRANCH=main
UNIT=portfolio-backend
WEBROOT=/var/www/portfolio
SCHEMA=backend/prisma/schema.prisma

STATE="$HOME/.portfolio-deploy-state"      # last SHA that deployed AND verified
FAILED="$HOME/.portfolio-deploy-failed"    # last SHA already reported as broken
LOCK=/tmp/portfolio-deploy.lock

# The notification target lives outside the repo, because this repo is public.
# Create ~/.config/portfolio-deploy.env containing one line:
#   NOTIFY_URL="https://ntfy.sh/your-private-topic-name"
# A Discord or Slack webhook URL works too; notify() detects which.
NOTIFY_URL=""
# shellcheck source=/dev/null
[ -f "$HOME/.config/portfolio-deploy.env" ] && . "$HOME/.config/portfolio-deploy.env"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*"; }

# Commit subjects contain quotes and apostrophes often enough to break a
# hand-built JSON payload, so anything heading into one gets escaped.
json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/ /g'; }

notify() {  # title, body, ntfy-tag
  [ -z "$NOTIFY_URL" ] && return 0
  case "$NOTIFY_URL" in
    *hooks.slack.com*|*discord.com/api/webhooks*|*discordapp.com/api/webhooks*)
      curl -fsS -m 10 -H 'Content-Type: application/json' \
        -d "{\"content\":\"**$(json_escape "$1")**\n$(json_escape "$2")\",\"text\":\"$(json_escape "$1"): $(json_escape "$2")\"}" \
        "$NOTIFY_URL" >/dev/null 2>&1 || log "notify failed (ignored)"
      ;;
    *)
      curl -fsS -m 10 -H "Title: $1" -H "Tags: $3" \
        -d "$2" "$NOTIFY_URL" >/dev/null 2>&1 || log "notify failed (ignored)"
      ;;
  esac
}

# A deploy can outlast the five-minute cron interval, and two of them writing
# node_modules and /var/www at once would be its own outage.
exec 9>"$LOCK"
flock -n 9 || { log "another deploy is running, skipping"; exit 0; }

cd "$REPO"

git fetch --quiet origin "$BRANCH"
TARGET=$(git rev-parse "origin/$BRANCH")
DEPLOYED=$(cat "$STATE" 2>/dev/null || echo none)

# Compared against the last *verified* deploy, not against HEAD. That is what
# makes a failed deploy retry on the next tick instead of being skipped.
if [ "$TARGET" = "$DEPLOYED" ]; then
  exit 0
fi

SHORT=$(git rev-parse --short "$TARGET")
SUBJECT=$(git log -1 --pretty=%s "$TARGET")

fail() {
  log "FAILED at line ${1:-?}: $SHORT $SUBJECT"
  # Report a given bad commit once. Without this a broken main notifies every
  # five minutes until it is fixed, and you stop reading the notifications.
  if [ "$(cat "$FAILED" 2>/dev/null || echo none)" != "$TARGET" ]; then
    printf '%s' "$TARGET" > "$FAILED"
    notify "Deploy FAILED $SHORT" \
      "$SUBJECT
Step failed at line ${1:-?}. Check: journalctl -u $UNIT -n 50 --no-pager" \
      rotating_light
  fi
}
trap 'fail $LINENO' ERR

log "deploying $SHORT  $SUBJECT"

# Hard reset rather than pull: the server is a deploy target, never a place
# work happens, so anything local is noise. Untracked files are left alone,
# which matters because backend/.env lives here and is not in git.
git reset --quiet --hard "$TARGET"

npm ci --silent

# Before the build, always. The client has to know the new columns for tsc to
# compile, and the database has to have them for the query to run.
npx prisma generate       --schema "$SCHEMA"
npx prisma migrate deploy --schema "$SCHEMA"

npm run build --workspace backend
npm run build --workspace frontend

# --delete is the point: cp left every old hashed bundle in place forever.
rsync -a --delete frontend/dist/ "$WEBROOT/"

sudo /bin/systemctl restart "$UNIT"

# Verification. /api/health only proves the process is listening - it returned
# 200 all through the P2022 outage while every real request 500'd. So this hits
# a route that actually queries Postgres, through Nginx on :80, which is what
# the Cloudflare tunnel serves. If this passes, the site genuinely works.
ok=false
for _ in $(seq 1 20); do
  if curl -fsS -m 4 -o /dev/null http://localhost/api/projects; then ok=true; break; fi
  sleep 2
done

if [ "$ok" != true ]; then
  log "restart succeeded but http://localhost/api/projects never returned 200"
  if [ "$(cat "$FAILED" 2>/dev/null || echo none)" != "$TARGET" ]; then
    printf '%s' "$TARGET" > "$FAILED"
    notify "Deploy FAILED $SHORT" \
      "$SUBJECT
Service restarted but /api/projects never returned 200.
journalctl -u $UNIT -n 50 --no-pager" \
      rotating_light
  fi
  exit 1
fi

trap - ERR
printf '%s' "$TARGET" > "$STATE"
rm -f "$FAILED"
log "deployed and verified $SHORT"
notify "Deployed $SHORT" "$SUBJECT
https://manugahewa.dev" white_check_mark
