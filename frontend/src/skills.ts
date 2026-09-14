// Every skill here maps to something that actually exists in this repository.
// That's a deliberate constraint borrowed from the README: the graph is a map
// of provable claims, not a wishlist. `evidence` is the file or workflow a
// reviewer can open to check the claim. Keep it accurate, and if a technology
// leaves the stack, drop its node too.

export type CategoryId =
  | "language"
  | "frontend"
  | "backend"
  | "data"
  | "quality"
  | "delivery"
  | "cloud";

export interface Category {
  id: CategoryId;
  label: string;
  /** Short name for the legend, where space is tight. */
  short: string;
  color: string;
  /** rgb triple so canvas can build rgba() strings at varying alpha. */
  rgb: [number, number, number];
  /** One short line. The card's visuals carry the rest. */
  tagline: string;
}

export interface Skill {
  name: string;
  category: CategoryId;
  /** 1-5. 5 = daily driver I would defend line by line; 3 = shipped with it. */
  level: number;
  blurb: string;
  evidence: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "language",
    label: "Languages & Types",
    short: "Languages",
    color: "#a8d44a",
    rgb: [168, 212, 74],
    tagline: "One language, end to end.",
  },
  {
    id: "frontend",
    label: "Frontend & Interface",
    short: "Frontend",
    color: "#a184f5",
    rgb: [161, 132, 245],
    tagline: "Interfaces that feel deliberate.",
  },
  {
    id: "backend",
    label: "Backend & APIs",
    short: "Backend",
    color: "#e072d8",
    rgb: [224, 114, 216],
    tagline: "Boring, predictable, well-guarded.",
  },
  {
    id: "data",
    label: "Data & Persistence",
    short: "Data",
    color: "#4cc98a",
    rgb: [76, 201, 138],
    tagline: "The schema is the source of truth.",
  },
  {
    id: "quality",
    label: "Testing & Quality",
    short: "Quality",
    color: "#3fc5c0",
    rgb: [63, 197, 192],
    tagline: "Proof, not vibes.",
  },
  {
    id: "delivery",
    label: "Delivery & Tooling",
    short: "Delivery",
    color: "#6d8ef5",
    rgb: [109, 142, 245],
    tagline: "Not done until it runs elsewhere.",
  },
  {
    id: "cloud",
    label: "Cloud & Platform",
    short: "Cloud",
    color: "#4fb0ef",
    rgb: [79, 176, 239],
    tagline: "Somewhere for it to actually run.",
  },
];

export const SKILLS: Skill[] = [
  // --- Languages & types --------------------------------------------------
  {
    name: "TypeScript",
    category: "language",
    level: 5,
    blurb:
      "Strict mode across both workspaces. Shared types are the contract between the API and the UI, not documentation that drifts.",
    evidence: "frontend/src/types.ts",
  },
  {
    name: "JavaScript",
    category: "language",
    level: 5,
    blurb:
      "Modern ES2022: modules, async/await, and the DOM APIs underneath the framework, not only the framework.",
    evidence: "the whole stack, compiled",
  },
  {
    name: "SQL",
    category: "language",
    level: 4,
    blurb:
      "Readable migrations, indexes chosen on purpose, and queries I can explain without an ORM in front of me.",
    evidence: "backend/prisma/migrations",
  },
  {
    name: "HTML5",
    category: "language",
    level: 5,
    blurb:
      "Semantic landmarks, real headings, labelled controls. The accessibility tree is part of the design, not an afterthought.",
    evidence: "frontend/index.html",
  },
  {
    name: "CSS3",
    category: "language",
    level: 5,
    blurb:
      "Custom properties as design tokens, grid and flex for layout, container-relative sizing instead of magic numbers.",
    evidence: "frontend/src/styles.css",
  },
  {
    name: "Python",
    category: "language",
    level: 3,
    blurb:
      "Scripting, automation and data work for the jobs where a short script beats standing up a service.",
    evidence: "coursework and tooling scripts",
  },

  // --- Frontend -----------------------------------------------------------
  {
    name: "React 18",
    category: "frontend",
    level: 5,
    blurb:
      "Hooks, effects with honest cleanup, and StrictMode left on so double-mount bugs surface in development instead of production.",
    evidence: "frontend/src/components",
  },
  {
    name: "React Native",
    category: "frontend",
    level: 3,
    blurb:
      "The same component instincts on mobile: shared TypeScript models, platform-specific presentation, one team workflow.",
    evidence: "Exercise Prescription App",
  },
  {
    name: "Vite",
    category: "frontend",
    level: 4,
    blurb:
      "Dev server with an API proxy, and a production build that type-checks before it bundles.",
    evidence: "frontend/vite.config.ts",
  },
  {
    name: "GSAP",
    category: "frontend",
    level: 4,
    blurb:
      "ScrollTrigger driving the pinned hero, scrubbed off scroll position and context-scoped so it cleans up after itself.",
    evidence: "frontend/src/components/Hero.tsx",
  },
  {
    name: "Framer Motion",
    category: "frontend",
    level: 4,
    blurb:
      "Declarative reveals and scroll-linked transforms, with reducedMotion wired straight to the OS preference.",
    evidence: "frontend/src/components/Reveal.tsx",
  },
  {
    name: "Lenis",
    category: "frontend",
    level: 3,
    blurb:
      "Smooth scrolling driven from a single GSAP ticker, so there is exactly one animation loop on the page.",
    evidence: "frontend/src/components/SmoothScroll.tsx",
  },
  {
    name: "Canvas 2D",
    category: "frontend",
    level: 4,
    blurb:
      "This graph: hand-rolled 3D projection, depth sorting, label de-collision and pointer hit testing at 60fps.",
    evidence: "frontend/src/components/SkillsGraph.tsx",
  },
  {
    name: "Accessibility",
    category: "frontend",
    level: 4,
    blurb:
      "Keyboard paths for everything the mouse can do, focus handling in dialogs, and canvas content mirrored in real DOM.",
    evidence: "skip links, aria-*, focus handling",
  },
  {
    name: "Responsive UI",
    category: "frontend",
    level: 5,
    blurb:
      "Layouts that reflow rather than shrink, and expensive effects switched off where they would cost more than they give.",
    evidence: "media queries in styles.css",
  },
  {
    name: "Redux",
    category: "frontend",
    level: 3,
    blurb:
      "Predictable shared state for the flows where prop drilling stops scaling, notably cross-screen session state on mobile.",
    evidence: "Exercise Prescription App",
  },
  {
    name: "Tailwind CSS",
    category: "frontend",
    level: 3,
    blurb:
      "Utility-first styling for projects that need visual consistency faster than a bespoke design system can be built.",
    evidence: "previous project work",
  },

  // --- Backend ------------------------------------------------------------
  {
    name: "Node.js",
    category: "backend",
    level: 4,
    blurb:
      "ES modules on the server, run under tsx in development and plain node in the production image.",
    evidence: "backend/src/index.ts",
  },
  {
    name: "Express",
    category: "backend",
    level: 4,
    blurb:
      "Small, explicit routers with middleware that does one thing each. No framework magic to untangle later.",
    evidence: "backend/src/routes",
  },
  {
    name: "REST APIs",
    category: "backend",
    level: 4,
    blurb:
      "Resource-shaped routes, honest status codes, and a typed fetch client on the other end that mirrors them exactly.",
    evidence: "frontend/src/api.ts",
  },
  {
    name: "Zod",
    category: "backend",
    level: 4,
    blurb:
      "Request bodies parsed, not assumed. The contact endpoint rejects malformed input before it can reach the database.",
    evidence: "backend/src/routes/contact.ts",
  },
  {
    name: "Helmet",
    category: "backend",
    level: 3,
    blurb:
      "Sensible security headers on by default, because the cheapest vulnerabilities are the ones you never opt into.",
    evidence: "backend/src/index.ts",
  },
  {
    name: "CORS",
    category: "backend",
    level: 3,
    blurb:
      "Origins allow-listed deliberately, rather than opened wide to make a local error message go away.",
    evidence: "backend/src/index.ts",
  },
  {
    name: "Error handling",
    category: "backend",
    level: 4,
    blurb:
      "Failures return a useful status and a safe message; the stack trace stays in the logs where it belongs.",
    evidence: "backend/src/index.ts",
  },
  {
    name: "WebSockets",
    category: "backend",
    level: 3,
    blurb:
      "Live progress pushed to the client instead of polled. The donation dashboard reports import status while the import is still running.",
    evidence: "Donation Management System",
  },

  // --- Data ---------------------------------------------------------------
  {
    name: "PostgreSQL",
    category: "data",
    level: 4,
    blurb:
      "The real database in development, in CI, and in production, with no SQLite stand-in hiding dialect differences until deploy day.",
    evidence: "docker-compose.yml",
  },
  {
    name: "Prisma",
    category: "data",
    level: 4,
    blurb:
      "Schema-first modelling with a generated, fully-typed client, exposed through one shared singleton.",
    evidence: "backend/src/lib/prisma.ts",
  },
  {
    name: "Schema design",
    category: "data",
    level: 4,
    blurb:
      "Project and ContactMessage modelled with the constraints the application actually depends on.",
    evidence: "backend/prisma/schema.prisma",
  },
  {
    name: "Migrations",
    category: "data",
    level: 4,
    blurb:
      "Versioned, committed, and replayed from scratch by CI, so the schema's history is reviewable like any other code.",
    evidence: "backend/prisma/migrations",
  },
  {
    name: "Seeding",
    category: "data",
    level: 3,
    blurb:
      "Seed data is a TypeScript program, so a fresh clone reaches a working dataset in a single command.",
    evidence: "backend/prisma/seed.ts",
  },
  {
    name: "MongoDB",
    category: "data",
    level: 3,
    blurb:
      "Document storage for the models that genuinely are documents, rather than forcing every shape into rows and joins.",
    evidence: "previous project work",
  },
  {
    name: "MySQL",
    category: "data",
    level: 3,
    blurb:
      "Relational work outside the Postgres stack, including schema design and query tuning against a database someone else built.",
    evidence: "coursework and previous projects",
  },
  {
    name: "CSV import",
    category: "data",
    level: 4,
    blurb:
      "Idempotent bulk import with safe upserts and validation, so re-running the same donation file cannot create duplicate records.",
    evidence: "Donation Management System",
  },

  // --- Quality ------------------------------------------------------------
  {
    name: "Vitest",
    category: "quality",
    level: 4,
    blurb:
      "One test runner across both workspaces: same config style, same mental model, frontend and backend.",
    evidence: "both package.json files",
  },
  {
    name: "Testing Library",
    category: "quality",
    level: 4,
    blurb:
      "Queries by role and label, so tests break when the experience breaks, not when the markup is refactored.",
    evidence: "frontend/src/__tests__",
  },
  {
    name: "Supertest",
    category: "quality",
    level: 4,
    blurb:
      "The API exercised over real HTTP, asserting status codes and payload shape rather than calling handlers directly.",
    evidence: "backend/src/__tests__",
  },
  {
    name: "jsdom",
    category: "quality",
    level: 3,
    blurb:
      "A browser-ish environment for component tests, with the gaps it leaves (matchMedia, canvas) stubbed explicitly.",
    evidence: "frontend/src/test-setup.ts",
  },
  {
    name: "ESLint",
    category: "quality",
    level: 4,
    blurb:
      "Linting as a gate, not a suggestion. It runs in CI and a failure stops the pipeline.",
    evidence: ".github/workflows/ci.yml",
  },
  {
    name: "Code review",
    category: "quality",
    level: 4,
    blurb:
      "Small, reviewable commits with the reasoning in the message, so the why outlives my memory of it.",
    evidence: "git history",
  },
  {
    name: "Jest",
    category: "quality",
    level: 4,
    blurb:
      "The runner behind the React Native and Node suites, with Testing Library on top for component behaviour.",
    evidence: "Exercise Prescription App",
  },

  // --- Delivery -----------------------------------------------------------
  {
    name: "Docker",
    category: "delivery",
    level: 4,
    blurb:
      "A multi-stage backend image: build with the full toolchain, ship a lean runtime that carries none of it.",
    evidence: "backend/Dockerfile",
  },
  {
    name: "Docker Compose",
    category: "delivery",
    level: 4,
    blurb:
      "Postgres and the API come up together with one command, so local parity is not a setup document nobody follows.",
    evidence: "docker-compose.yml",
  },
  {
    name: "GitHub Actions",
    category: "delivery",
    level: 4,
    blurb:
      "Lint, migrate and test both workspaces against a real Postgres service container on every push and pull request.",
    evidence: ".github/workflows/ci.yml",
  },
  {
    name: "CI/CD",
    category: "delivery",
    level: 4,
    blurb:
      "The pipeline is the definition of done. If it is red, the change is not finished, however good it looks locally.",
    evidence: ".github/workflows/ci.yml",
  },
  {
    name: "Git",
    category: "delivery",
    level: 5,
    blurb:
      "Branch per change, tidy history, and messages written for whoever reads them in six months.",
    evidence: "git history",
  },
  {
    name: "npm workspaces",
    category: "delivery",
    level: 3,
    blurb:
      "One install, one lockfile, two deployable applications that can still be built and shipped independently.",
    evidence: "package.json",
  },
  {
    name: "Env config",
    category: "delivery",
    level: 4,
    blurb:
      "Configuration through the environment with a checked-in example file, and secrets that never reach the repository.",
    evidence: "backend/.env.example",
  },

  // --- Cloud & platform ---------------------------------------------------
  {
    name: "GCP",
    category: "cloud",
    level: 3,
    blurb:
      "Hosting, object storage and notification delivery for the mobile app, including the upload path for patient exercise video.",
    evidence: "Exercise Prescription App",
  },
  {
    name: "AWS",
    category: "cloud",
    level: 3,
    blurb:
      "Core service literacy: compute, object storage and managed databases for deploying a containerised API.",
    evidence: "personal deployments",
  },
  {
    name: "Azure",
    category: "cloud",
    level: 2,
    blurb:
      "Working familiarity with the platform side: app hosting, managed Postgres, and pipeline integration.",
    evidence: "coursework",
  },
  {
    name: "Kubernetes",
    category: "cloud",
    level: 2,
    blurb:
      "Orchestration concepts and manifests. The step past Compose for when a service needs to scale horizontally.",
    evidence: "self-directed study",
  },
  {
    name: "Microservices",
    category: "cloud",
    level: 3,
    blurb:
      "Splitting a system along seams that actually exist, and keeping the contract between services explicit rather than implied.",
    evidence: "Donation Management System",
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, Category>;

export function skillsIn(category: CategoryId): Skill[] {
  return SKILLS.filter((s) => s.category === category);
}
