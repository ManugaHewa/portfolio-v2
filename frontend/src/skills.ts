// Every skill here names the project it was used in (`evidence`), and the
// skills section turns that into a link to the project on the page. Keep it
// accurate: if a technology leaves the stack, its entry goes too (GSAP,
// Lenis and Canvas 2D left with the redesign).

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
}

export interface Skill {
  name: string;
  category: CategoryId;
  blurb: string;
  /** The project this is demonstrated in, not a file path: a reader
   * wants to know where it was used, not which line to open. */
  evidence: string;
}

export const CATEGORIES: Category[] = [
  { id: "language", label: "Languages & Types" },
  { id: "frontend", label: "Frontend & Interface" },
  { id: "backend", label: "Backend & APIs" },
  { id: "data", label: "Data & Persistence" },
  { id: "quality", label: "Testing & Quality" },
  { id: "delivery", label: "Delivery & Tooling" },
  { id: "cloud", label: "Cloud & Platform" },
];

export const SKILLS: Skill[] = [
  // --- Languages & types --------------------------------------------------
  {
    name: "TypeScript",
    category: "language",
    blurb:
      "Strict mode across both workspaces. Shared types are the contract between the API and the UI, not documentation that drifts.",
    evidence: "Smart Grocery App",
  },
  {
    name: "JavaScript",
    category: "language",
    blurb:
      "Modern ES2022: modules, async/await, and the DOM APIs underneath the framework, not only the framework.",
    evidence: "Alice in Brussels",
  },
  {
    name: "SQL",
    category: "language",
    blurb:
      "Readable migrations, indexes chosen on purpose, and queries I can explain without an ORM in front of me.",
    evidence: "Smart Grocery App",
  },
  {
    name: "HTML5",
    category: "language",
    blurb:
      "Semantic landmarks, real headings, labelled controls. The accessibility tree is part of the design, not an afterthought.",
    evidence: "Alice in Brussels",
  },
  {
    name: "CSS3",
    category: "language",
    blurb:
      "Custom properties as design tokens, grid and flex for layout, container-relative sizing instead of magic numbers.",
    evidence: "Alice in Brussels",
  },
  {
    name: "Python",
    category: "language",
    blurb:
      "Scripting, automation and data work for the jobs where a short script beats standing up a service.",
    evidence: "Flaky Test Detector",
  },

  // --- Frontend -----------------------------------------------------------
  {
    name: "React 18",
    category: "frontend",
    blurb:
      "Hooks, effects with honest cleanup, and StrictMode left on so double-mount bugs surface in development instead of production.",
    evidence: "Smart Grocery App",
  },
  {
    name: "React Native",
    category: "frontend",
    blurb:
      "The same component instincts on mobile: shared TypeScript models, platform-specific presentation, one team workflow.",
    evidence: "Exercise Prescription App",
  },
  {
    name: "Vite",
    category: "frontend",
    blurb:
      "Dev server with an API proxy, and a production build that type-checks before it bundles.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Framer Motion",
    category: "frontend",
    blurb:
      "Declarative reveals and scroll-linked transforms, with reducedMotion wired straight to the OS preference.",
    evidence: "This portfolio",
  },
  {
    name: "Accessibility",
    category: "frontend",
    blurb:
      "Keyboard paths for everything the mouse can do, focus handling in dialogs, and canvas content mirrored in real DOM.",
    evidence: "Alice in Brussels",
  },
  {
    name: "Responsive UI",
    category: "frontend",
    blurb:
      "Layouts that reflow rather than shrink, and expensive effects switched off where they would cost more than they give.",
    evidence: "This portfolio",
  },
  {
    name: "Tailwind CSS",
    category: "frontend",
    blurb:
      "Utility-first styling for projects that need visual consistency faster than a bespoke design system can be built.",
    evidence: "Coursework",
  },

  // --- Backend ------------------------------------------------------------
  {
    name: "Node.js",
    category: "backend",
    blurb:
      "ES modules on the server, run under tsx in development and plain node in the production image.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Express",
    category: "backend",
    blurb:
      "Small, explicit routers with middleware that does one thing each. No framework magic to untangle later.",
    evidence: "Smart Grocery App",
  },
  {
    name: "REST APIs",
    category: "backend",
    blurb:
      "Resource-shaped routes, honest status codes, and a typed fetch client on the other end that mirrors them exactly.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Zod",
    category: "backend",
    blurb:
      "Request bodies parsed, not assumed. The contact endpoint rejects malformed input before it can reach the database.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Helmet",
    category: "backend",
    blurb:
      "Sensible security headers on by default, because the cheapest vulnerabilities are the ones you never opt into.",
    evidence: "Smart Grocery App",
  },
  {
    name: "CORS",
    category: "backend",
    blurb:
      "Origins allow-listed deliberately, rather than opened wide to make a local error message go away.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Error handling",
    category: "backend",
    blurb:
      "Failures return a useful status and a safe message; the stack trace stays in the logs where it belongs.",
    evidence: "Smart Grocery App",
  },

  // --- Data ---------------------------------------------------------------
  {
    name: "PostgreSQL",
    category: "data",
    blurb:
      "The real database in development, in CI, and in production, with no SQLite stand-in hiding dialect differences until deploy day.",
    evidence: "Donation Management System",
  },
  {
    name: "Prisma",
    category: "data",
    blurb:
      "Schema-first modelling with a generated, fully-typed client, exposed through one shared singleton.",
    evidence: "Donation Management System",
  },
  {
    name: "Schema design",
    category: "data",
    blurb:
      "Project and ContactMessage modelled with the constraints the application actually depends on.",
    evidence: "Donation Management System",
  },
  {
    name: "Migrations",
    category: "data",
    blurb:
      "Versioned, committed, and replayed from scratch by CI, so the schema's history is reviewable like any other code.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Seeding",
    category: "data",
    blurb:
      "Seed data is a TypeScript program, so a fresh clone reaches a working dataset in a single command.",
    evidence: "This portfolio",
  },
  {
    name: "MongoDB",
    category: "data",
    blurb:
      "Document storage for the models that genuinely are documents, rather than forcing every shape into rows and joins.",
    evidence: "Exercise Prescription App",
  },
  {
    name: "MySQL",
    category: "data",
    blurb:
      "Relational work outside the Postgres stack, including schema design and query tuning against a database someone else built.",
    evidence: "Coursework",
  },

  // --- Quality ------------------------------------------------------------
  {
    name: "Vitest",
    category: "quality",
    blurb:
      "One test runner across both workspaces: same config style, same mental model, frontend and backend.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Testing Library",
    category: "quality",
    blurb:
      "Queries by role and label, so tests break when the experience breaks, not when the markup is refactored.",
    evidence: "This portfolio",
  },
  {
    name: "Supertest",
    category: "quality",
    blurb:
      "The API exercised over real HTTP, asserting status codes and payload shape rather than calling handlers directly.",
    evidence: "Smart Grocery App",
  },
  {
    name: "jsdom",
    category: "quality",
    blurb:
      "A browser-ish environment for component tests, with the gaps it leaves (matchMedia, canvas) stubbed explicitly.",
    evidence: "This portfolio",
  },
  {
    name: "ESLint",
    category: "quality",
    blurb:
      "Linting as a gate, not a suggestion. It runs in CI and a failure stops the pipeline.",
    evidence: "This portfolio",
  },
  {
    name: "Code review",
    category: "quality",
    blurb:
      "Small, reviewable commits with the reasoning in the message, so the why outlives my memory of it.",
    evidence: "This portfolio",
  },

  // --- Delivery -----------------------------------------------------------
  {
    name: "Docker",
    category: "delivery",
    blurb:
      "A multi-stage backend image: build with the full toolchain, ship a lean runtime that carries none of it.",
    evidence: "Donation Management System",
  },
  {
    name: "Docker Compose",
    category: "delivery",
    blurb:
      "Postgres and the API come up together with one command, so local parity is not a setup document nobody follows.",
    evidence: "Donation Management System",
  },
  {
    name: "GitHub Actions",
    category: "delivery",
    blurb:
      "Lint, migrate and test both workspaces against a real Postgres service container on every push and pull request.",
    evidence: "Smart Grocery App",
  },
  {
    name: "CI/CD",
    category: "delivery",
    blurb:
      "The pipeline is the definition of done. If it is red, the change is not finished, however good it looks locally.",
    evidence: "Smart Grocery App",
  },
  {
    name: "Git",
    category: "delivery",
    blurb:
      "Branch per change, tidy history, and messages written for whoever reads them in six months.",
    evidence: "Every project here",
  },
  {
    name: "npm workspaces",
    category: "delivery",
    blurb:
      "One install, one lockfile, two deployable applications that can still be built and shipped independently.",
    evidence: "This portfolio",
  },
  {
    name: "Env config",
    category: "delivery",
    blurb:
      "Configuration through the environment with a checked-in example file, and secrets that never reach the repository.",
    evidence: "Smart Grocery App",
  },

  // --- Cloud & platform ---------------------------------------------------
  {
    name: "GCP",
    category: "cloud",
    blurb:
      "Hosting, object storage and notification delivery for the mobile app, including the upload path for patient exercise video.",
    evidence: "Exercise Prescription App",
  },
  {
    name: "AWS",
    category: "cloud",
    blurb:
      "Core service literacy: compute, object storage and managed databases for deploying a containerised API.",
    evidence: "Personal deployments",
  },
  {
    name: "Azure",
    category: "cloud",
    blurb:
      "Working familiarity with the platform side: app hosting, managed Postgres, and pipeline integration.",
    evidence: "Coursework",
  },
  {
    name: "Kubernetes",
    category: "cloud",
    blurb:
      "Orchestration concepts and manifests. The step past Compose for when a service needs to scale horizontally.",
    evidence: "Self-directed study",
  },
  {
    name: "Microservices",
    category: "cloud",
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
