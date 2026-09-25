# Portfolio v2 Edit: auto-deploy test

A full-stack rebuild of the portfolio: instead of a static site that *describes*
a tech stack, this one *is* one.

## Architecture

```
portfolio-v2/
├── frontend/          React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── components/   Nav, ProjectCard, ProjectModal, SkillsGraph, ContactForm
│   │   ├── api.ts        typed fetch client for the backend
│   │   ├── types.ts      shared types matching the Prisma models
│   │   └── __tests__/    Vitest + React Testing Library
│
├── backend/           Express + TypeScript + Prisma + PostgreSQL
│   ├── src/
│   │   ├── routes/       /api/projects, /api/contact
│   │   ├── lib/prisma.ts singleton Prisma client
│   │   └── __tests__/    Vitest + Supertest
│   ├── prisma/
│   │   ├── schema.prisma Project + ContactMessage models
│   │   └── seed.ts       seeds the two real projects
│   └── Dockerfile
│
├── docker-compose.yml  Postgres + backend for local dev
└── .github/workflows/ci.yml   lints, tests, and builds both workspaces on every push/PR
```

## Why this shape

- **Frontend claims React/TypeScript → the site is actually React/TypeScript.**
  Same visual design as before, now as typed components instead of DOM manipulation.
- **Project data comes from a real API + Postgres**, not a hardcoded JS object —
  so "database design" and "REST APIs" on the skills list are backed by code
  a reviewer can open and run.
- **Contact form POSTs to the backend** and is persisted, replacing the old
  `mailto:` link — a small but real demonstration of validation (Zod) and
  a data-writing endpoint.
- **Tests on both sides** (Vitest/RTL on the frontend, Vitest/Supertest on the
  backend) make "Jest/RTL" a verifiable claim, not just a bubble in a skills graph.
- **CI on GitHub Actions** spins up a real Postgres service container and
  runs migrations + tests on every push — anyone can check the Actions tab
  instead of taking "CI/CD" on faith.
- **Docker Compose** brings up Postgres + the API with one command for local dev,
  and the backend has a multi-stage Dockerfile for production images.

## Running locally

```bash
npm install

# start Postgres + apply schema
docker compose up -d db
cp backend/.env.example backend/.env
npm run prisma:migrate --workspace backend
npx tsx backend/prisma/seed.ts

# two terminals
npm run dev:backend
npm run dev:frontend
```

Frontend: http://localhost:5173 — API calls are proxied to the backend at
`http://localhost:4000` in dev (see `frontend/vite.config.ts`).

## Deploying

- **Frontend** → Vercel or Netlify (static build via `npm run build --workspace frontend`).
- **Backend** → Render, Railway, or Fly.io (uses the provided `backend/Dockerfile`).
- **Database** → the managed Postgres offered by whichever backend host you pick,
  or Neon/Supabase if you want it decoupled from hosting.

## What's intentionally *not* here

No unrelated languages bolted on just to widen a skills list (no Go/Rust
microservice, etc.) — every piece here maps to something in the actual job
target (TypeScript/React/Node) and is deep enough to defend in an interview.
If genuine breadth outside that stack is wanted later, it belongs in a
separate, standalone project rather than forced into this one.
