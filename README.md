# Portfolio v2

A full-stack rebuild of the portfolio: instead of a static site that *describes*
a tech stack, this one *is* one. Live at https://manugahewa.dev.

## Architecture

```
portfolio-v2/
├── content/projects.ts   every project's copy: seeded into Postgres for the
│                         API, and prerendered into the HTML at build time
├── frontend/             React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── components/   Hero, WorkIndex and deck/ (the deck of project
│   │   │                 cards), work/ (case studies), ProjectModal,
│   │   │                 Pipeline, Skills, ContactForm, CaseStudyPage,
│   │   │                 PrivacyPage, Scene3D (the WebGL scenes)...
│   │   ├── motion/       animation primitives on Motion (framer-motion)
│   │   ├── styles/       plain CSS, one file per section, tokens.css
│   │   ├── api.ts        typed fetch client for the backend
│   │   ├── types.ts      types matching the API's responses
│   │   ├── entry-server.tsx  the build-time render
│   │   └── __tests__/    Vitest + React Testing Library + axe-core
│   ├── privacy/index.html    the second page
│   ├── build/repoFacts.ts    build-time facts about this repo: the code
│   │                         excerpts on the pipeline, the commit history
│   └── scripts/prerender.mjs writes the rendered pages into dist/: the home
│                             page, privacy, 404, a page per project
│                             (/work/<slug>/) and the sitemap
│
├── backend/              Express + TypeScript + Prisma + PostgreSQL
│   ├── src/
│   │   ├── app.ts        the API: Helmet, CORS allow-list, rate limits, errors
│   │   ├── routes/       /api/projects, /api/contact
│   │   ├── lib/          Prisma singleton, Turnstile check, contact admin
│   │   └── __tests__/    Vitest + Supertest
│   ├── scripts/          contact:delete and contact:prune
│   ├── prisma/           schema, migrations, seed
│   └── Dockerfile
│
├── deploy/nginx/portfolio.conf   the server's Nginx site (applied by hand)
├── scripts/deploy.sh     the server's cron deploy
├── docs/                 the October 2026 audit and the manual server steps
├── docker-compose.yml    Postgres (loopback only) for local dev and the server
└── .github/              CI and Dependabot
```

## Why this shape

- **Frontend claims React/TypeScript → the site is actually React/TypeScript.**
  Typed components, prerendered at build time and hydrated in the browser.
- **Project data comes from a real API + Postgres**, not a hardcoded JS object —
  so "database design" and "REST APIs" on the skills list are backed by code
  a reviewer can open and run.
- **Contact form POSTs to the backend** and is persisted, replacing the old
  `mailto:` link — a small but real demonstration of validation (Zod) and
  a data-writing endpoint.
- **Tests on both sides** (Vitest/RTL and axe-core on the frontend,
  Vitest/Supertest on the backend) make "testing" a verifiable claim.
- **CI on GitHub Actions** spins up a real Postgres service container and
  runs migrations + tests on every push — anyone can check the Actions tab
  instead of taking "CI/CD" on faith.
- **Docker Compose** brings up Postgres + the API with one command for local dev,
  and the backend has a multi-stage Dockerfile for production images.

## Running locally

Create a `.env` file next to `docker-compose.yml` with one line,
`POSTGRES_PASSWORD=postgres` (any value; Compose refuses to start without it),
then:

```bash
npm install

# Postgres on 127.0.0.1:5432, then the schema and the projects
docker compose up -d db
cp backend/.env.example backend/.env
npm run prisma:migrate --workspace backend
npx tsx backend/prisma/seed.ts

# two terminals
npm run dev:backend
npm run dev:frontend
```

Frontend: http://localhost:5173. API calls are proxied to the backend at
`http://localhost:4000` (see `frontend/vite.config.ts`). In development the
pages render in the browser; `npm run build --workspace frontend` produces the
prerendered ones.

To change what a project says, edit `content/projects.ts` and run the seed
again.

## Testing

```bash
npm test                               # both workspaces
npm run lint                           # both workspaces
npm run typecheck --workspace backend  # tests, scripts, seed, content
```

`backend/src/__tests__/content.integration.test.ts` checks that the API serves
exactly what the prerendered HTML is built from. It needs a migrated, seeded
database and runs only with `RUN_DB_TESTS=1` set, as CI does.

## Deploying

A push to `main` deploys itself within five minutes. On the server,
`scripts/deploy.sh` runs from cron: it resets to `origin/main`, runs `npm ci`,
`prisma generate`, `prisma migrate deploy` and the seed, builds both
workspaces (the frontend build prerenders the pages), copies `frontend/dist`
to `/var/www/portfolio`, restarts the `portfolio-backend` systemd unit, and
checks `/api/projects` through Nginx before it reports success.

Requests go Cloudflare → Cloudflare Tunnel → Nginx (`deploy/nginx/portfolio.conf`)
→ the static files, or `/api/` to Express on `127.0.0.1:4000`. Postgres runs in
Docker on the same machine, published on loopback only.

What a push does not change (the Nginx config, the `.env` files, the Postgres
container, Cloudflare and GitHub settings) is in `docs/manual-steps.md`, one
command per step.

## Contact messages

Run from the repo root on the server, so they use the owner credentials in the
root `.env`:

```bash
npm run contact:delete -- someone@example.com --dry-run
npm run contact:delete -- someone@example.com
npm run contact:prune -- --dry-run
```

`contact:prune` deletes messages older than 12 months and runs from cron
(`docs/manual-steps.md`, section 8). The privacy page promises both.

## What's intentionally *not* here

No unrelated languages bolted on just to widen a skills list (no Go/Rust
microservice, etc.) — every piece here maps to something in the actual job
target (TypeScript/React/Node) and is deep enough to defend in an interview.
If genuine breadth outside that stack is wanted later, it belongs in a
separate, standalone project rather than forced into this one.
