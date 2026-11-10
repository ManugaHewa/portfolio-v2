# Claims review: proposals for your approval

Every factual or numeric claim from the audit (appendix B, C1 to C55), each
with a proposal. Nothing here is applied yet. Reply with the numbers you want
changed, for example "all as proposed, except C4: graduated April 2026, C31:
fine to name them".

How to read it:

- **Keep**: true and checkable as written.
- **Reword**: true in substance, but the wording overstates or is stale. The
  new wording only uses facts already in the repo, its git history or your
  public repositories; nothing is invented.
- **Remove**: contradicted, unverifiable from the page, or on a component that
  both design directions drop anyway.
- **You**: only you know. The question says what I need.

Three were checked against your public DMS repository (`Test` branch,
pushed 2025-11-25) rather than asked: C39, C41 and C42.

## Head tags and hero

| # | Now | Proposal |
|---|---|---|
| C1 | `<title>` said "Full-Stack Engineer" | **Keep** as already changed in Phase 3: "Full-stack developer, Milton, ON". |
| C2 | Description: "fast, accessible ... production-grade DevOps" | **Keep** as already changed in Phase 3 (no unmeasured adjectives). |
| C3 | Share description: "Typed, tested ... CI that proves it works" | **Keep** as already changed in Phase 3. |
| C4 | "Software Engineering graduate" | **You**: is the degree conferred? If yes, keep and give the year if you want it shown. If not, "Software Engineering student, Western University". |
| C5 | Display line "Real Clients, Real Infrastructure" | **Remove.** A slogan above the name; both designs open with your name and a plain line (N1 below). |
| C6 | "Milton, ON" | **Keep.** |
| C7 | "Every claim on this page is backed by code you can open." | **Remove.** 8 of 13 projects have no public repository linked. |
| C8 | "Typed from the database to the browser." | **Remove.** `frontend/src/types.ts` is a hand-written copy of the API's shapes; nothing checks them at compile time. |
| C9 | "Tests, CI, containers: the boring parts, done anyway." | **Remove** with the Statement section, which both designs drop. The facts (CI, tests, Postgres in Docker) stay in the Portfolio v2 entry. |
| C10 | "Every card opens a full case study." | **Remove.** Several entries are a tagline and a stack. |

## Skills

| # | Now | Proposal |
|---|---|---|
| C11 | "48 technologies", "7 connected domains", "3.8 average depth", "2 workspaces" | **Remove.** Both designs show a grouped list with no counts; 3.8 is an average of self-ratings. |
| C12 | Self-rated levels 1 to 5 | **Remove** from the page. The list says where each skill was used instead. |
| C13 | Canvas 2D: "This graph: hand-rolled 3D projection..." | **Remove** the skill. Stale (the graph became 2D), and both designs drop the graph, so nothing on the page would show it. |
| C14 | Evidence "Exercise Prescription App" (3 skills) | **Reword** to "RxFlow", the name the page uses. |
| C15 | Zod, schema design, Vitest, Docker Compose: blurbs describe this repo, credited to Smart Grocery or DMS | **Reword** the evidence to "Portfolio v2", which is what the blurbs describe. |
| C16 | CORS "Origins allow-listed deliberately" | **Keep**, credited to Portfolio v2: true since the Phase 1 fix (`858091b`). |
| C17 | Git: "Branch per change, tidy history"; code review: "Small, reviewable commits" | **Remove** the practice claims and keep the skill names. This repo commits straight to `main`. |
| C18 | AWS: "compute, object storage and managed databases", evidence "Personal deployments" | **Reword**: "EC2 and Lightsail, for the Superhero REST API". That is the AWS work the page shows. |
| C19 | Azure, MySQL, Tailwind ("Coursework"); Kubernetes ("Self-directed study") | **You**: name the course or project for each, or remove it. A reader cannot check "coursework". |
| C20 | Microservices, credited to DMS | **Remove.** DMS is one Express API and one Vite frontend in a monorepo. |
| C21 | Accessibility "canvas content mirrored in real DOM", credited to Alice in Brussels | **Reword**: "Keyboard paths for everything the mouse can do, and focus handling in dialogs", credited to Portfolio v2 (axe and a keyboard walkthrough in the audit). |

## Contact section

| # | Now | Proposal |
|---|---|---|
| C22 | "Open to full-stack roles"; "hybrid or remote" | **You**: still true? On-site too? |
| C23 | "Replies in a day or two, from me, not a bot." | **Reword**: "I usually reply within two days." Drops the "X, not Y" phrasing. |
| C24 | Six capability cards ("Proven in Smart Grocery App"...) | **Remove.** Both designs drop the cards. Smart Grocery links nothing, and "Every effect has an off switch" was only partly true. |
| C25 | Impact strip: "19 tests in CI", "Web, mobile, API", "PENDING_VALIDATION ... accountant" | **Remove.** Both designs drop the strip; it also contradicted the DMS case study ("administrator"). |
| C26 | GitHub note "Every project here, in full." | **Reword**: "Code for the projects that are public." |
| C27 | "Ask about any trade-off ... you will get the real answer" | **Keep** (a promise, in your voice). |
| C28 | "Validated with Zod. No third-party form service."; "Stored in Postgres" | **Keep** (true). |
| C29 | Error banner: "The projects come from Express and Postgres rather than a hardcoded array" | **Reword** for visitors: "Couldn't load the projects. Reloading the page usually fixes it." |
| C30 | Repository rows (Portfolio 2025; Calculators 2024) | **Keep.** |

## Case studies (`content/projects.ts`)

| # | Now | Proposal |
|---|---|---|
| C31 | RxFlow names Hand Therapy Canada and describes its practice | **You**: are they OK with being named? If not: "a hand-therapy clinic in Southwestern Ontario". |
| C32 | "SE4450 Software Design II capstone at Western, built with Team 5" | **Keep.** |
| C33 | "Six languages" (listed under Scope) | **You**: did all six ship in the delivered app? If some were planned, say which. |
| C34 | "Onboarding a patient in under two minutes." | **Reword** as a target, unless it was measured: "Target: onboarding a patient in under two minutes." |
| C35 | The iOS/HTTPS story; "finished at 3 AM" | **Keep** (your account). |
| C36 | "We delivered a working app to a real healthcare client." (shown on the card) | **Keep**, if the client accepted the delivery. |
| C37 | Timeline "Two sprints" | **Keep.** Add months if you have them; the source dates were marked [VERIFY]. |
| C38 | DMS: "Mobile-first and WCAG 2.1 compliant"; "Encrypted in transit and at rest, with two-factor auth" | **Reword**: "Target: WCAG 2.1 AA, because volunteers record donations on their phones." and "Planned: encryption at rest and two-factor auth for admins and accountants." |
| C39 | "every privileged change writes to an audit log" | **Reword** (checked): the `AuditLog` table exists, but in the `Test` branch only the auth controller uses it; validating or deleting a donation does not write to it. "Planned: an audit log of every privileged change; the table exists." |
| C40 | DMS scope: "All eight donation types", donor portal, validation queue | **You**: which of these work today? Built items stay in Scope; the rest move to Next steps. |
| C41 | Repository link points at the `Test` branch | **Keep** (checked): `Test` has the current code (101 files); `main` is an older 20-file state. Merging `Test` into `main` would let the link drop the branch. |
| C42 | "DonationStatus defaults to PENDING_VALIDATION" | **Keep** (checked): `status DonationStatus @default(PENDING_VALIDATION)` in `packages/database/prisma/schema.prisma`. |
| C43 | Alice names Prof. Cristina Caracchini and the department | **You**: OK to name her? If not: "supervised by a faculty member in the Department of Languages and Cultures". |
| C44 | Timeline "June 2025 - September 2025" vs "the contract ended on August 30" | **Reword** the timeline to "June to August 2025". |
| C45 | "holds sixty frames a second ... fully keyboard navigable"; "Responsive images and lazy loading"; "Completed and deployed" | **You**: is the site public (give the URL for the empty "Live site" link)? Without a link, remove "sixty frames a second" unless you measured it; keep keyboard navigation if you tested it. |
| C46 | Flaky: "About eight hundred lines"; airflow and scrapy; "100 runs ... one usable labelled row" | **Keep** (checkable in the repository). |
| C47 | Smart Grocery: "Nineteen tests", "April and May 2026", JWT, rate limiting, pino; "nineteen passing tests you can run yourself" | **You**: is the repository public? If yes, give the URL and keep. If not, cut "you can run yourself" and the line that this is "where the testing and pipeline claims elsewhere on this site come from". |
| C48 | Sketch2Photo: two empty links | **You**: URLs, or remove the empty links. |
| C49 | Portfolio v2 status "Live on local network; public exposure in progress" | **Reword**: "Live at manugahewa.dev". |
| C50 | DuckDNS in the stack; next step "Public access through DuckDNS..." | **Reword**: Cloudflare Tunnel replaces DuckDNS in the stack; remove that next step (done). |
| C51 | Next step "The GSAP pinned hero animation..." | **Remove** (shipped; and both designs drop GSAP). |
| C52 | "Live site" link empty | **Reword**: `https://manugahewa.dev`. |
| C53 | ShopSense: "over a thousand transactions", "more than fifty product categories" | **Keep** if they come from the dataset in the repository. |
| C54 | DURB: "20+ abilities" | **You**: still the right count? Otherwise "the game's abilities". |
| C55 | Superhero API: EC2 and Lightsail in the stack | **Keep** if both were used. |

## New copy the redesign needs (drafts)

Written only from facts already on the site. Approve, edit or replace.

| # | Where | Draft |
|---|---|---|
| N1 | Hero, under the name | "Full-stack developer in Milton, Ontario. I build web and mobile apps with TypeScript, React and Node.js, and I host this site on my own server." |
| N2 | Work section intro | "Six projects in detail, then smaller ones." |
| N3 | Skills section intro | "What I have used, grouped by where it sits in a project, with the project it was used in." |
| N4 | Contact section intro | "Open to full-stack roles, hybrid or remote, from Milton, Ontario." (the current wording, so it depends on C22) |
| N5 | Hero figure caption (direction B) | "Figure 1. A gyroscope drawn live with Three.js. Visitors who ask for reduced motion see a still image." |
