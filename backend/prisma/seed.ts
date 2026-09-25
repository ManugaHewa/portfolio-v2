import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type ProjectSeed = Omit<Prisma.ProjectCreateInput, "links"> & {
  links: { label: string; url: string }[];
};

/**
 * The twelve entries from portfolio_projects.txt, plus Smart Grocery, which
 * predates the file. Six carry a full card (tier 1) and the rest are rows under
 * Other work (tier 2). The running order is the order of this array and was
 * chosen by hand rather than inherited from the file's own ranking.
 *
 * Three rules govern what is written here:
 *
 * 1. Anything the source file marked [VERIFY] is left out entirely rather than
 *    softened. That is why several of the coursework entries carry a tagline
 *    and a stack and almost nothing else: the rest was a guess, and a
 *    portfolio is only useful if an interviewer can ask about any line on it.
 *    Where a stack line was marked but the file's own summary table named the
 *    same technology unmarked, the table is used - it is a second statement of
 *    the same fact, not an invention.
 *
 * 2. Where an entry already existed here with detail written against the
 *    repository, the source file wins on the fields it covers and the older
 *    detail is kept where the file is silent. Claims the file contradicts are
 *    dropped: it lists DMS receipting, tax slips, email notifications and RBAC
 *    as planned, so nothing here describes them as delivered.
 *
 * 3. First person, and plain. An earlier pass wrote every one of these in the
 *    same shape - short declarative, colon, list of three, closing aphorism -
 *    and thirteen entries of it read like a template rather than like someone
 *    describing their own work. Sentence length varies on purpose now.
 *
 * A link with an empty url is a deliberate placeholder, standing in for the
 * file's "[add link]" rather than pointing somewhere invented.
 */
const PROJECTS: ProjectSeed[] = [
  // ------------------------------------------- cards, strongest first
  {
    slug: "exercise",
    title: "RxFlow",
    tier: 1,
    category: "Mobile / Full-stack / Cloud",
    status: "Completed",
    subtitle:
      "A cross-platform rehab app that lets hand therapists prescribe exercise programs and lets patients follow, track and understand them from their phone.",
    stack: [
      "React Native",
      "TypeScript",
      "Expo Router",
      "React Native Web",
      "Node.js",
      "Express",
      "MongoDB Atlas",
      "Docker",
      "Google Cloud Run",
      "Google Compute Engine",
      "Google Secret Manager",
      "Google Cloud Speech-to-Text",
      "Firebase",
      "DuckDNS",
      "iOS",
      "Android",
    ],
    role: "Team Lead and Full-stack Developer",
    timeline: "Two sprints, team delivery with story-point planning",
    context:
      "My SE4450 Software Design II capstone at Western, built with Team 5 for Hand Therapy Canada. They treat hand, wrist, elbow and shoulder injuries across Southwestern Ontario, so the requirements came from an actual clinic rather than from a spec we wrote ourselves.",
    problem:
      "Home exercise programs were being handed out as videos saved to a patient's camera roll, plus paper sheets. Therapists had no reliable way to tell whether anyone was doing the exercises, patients lost or mixed up their videos, and there was nothing for patients who spoke another language or for kids.",
    scope: [
      "One TypeScript codebase that runs on iOS, Android and the web through React Native.",
      "A clinician portal where therapists assign programs, pick from a central video library, set schedules and review each patient's completion history.",
      "The patient side: today's exercises, the demonstration video, checkboxes for completed sets, and a weekly progress bar.",
      "A central exercise video library served from the backend, so the videos stop living in patients' camera rolls.",
      "Video capture in the app - record, upload, title and delete exercise clips.",
      "Weekly completion tracking, and reminders when a session is due, sent through Firebase Cloud Messaging and Expo push.",
      "Captions on the exercise videos, generated with Google Speech-to-Text.",
      "Six languages: English, French, Spanish, German, Italian and Portuguese.",
      "Fun Mode, a child-friendly interface for younger patients.",
      "Onboarding a patient in under two minutes.",
      "REST routes on the backend for /auth, /videos, /progress, /translation, /captions and /schedule.",
      "Cookie-based auth, CORS configuration, and secrets kept in Google Secret Manager.",
    ],
    challenges: [
      "For months the iOS build could not talk to the backend. iOS refuses insecure HTTP by default, so the fix was never going to be in our app code - it was in the infrastructure. I worked through TLS certificates, HTTPS termination, a Google Cloud load balancer and DuckDNS for the domain, testing each layer on its own until the whole path from the iOS app through HTTPS to the backend held together.",
      "I could have cut the feature to make the deadline. I stayed on it instead, finished at 3 AM, and demoed the working iOS connection to the client.",
      "Earlier on, a \"This screen doesn't exist\" routing bug turned out to be Expo Router and React Navigation fighting over two nested NavigationContainers.",
    ],
    deliveryProcess: [
      "We planned each sprint with story points, using Fibonacci poker to land on a number the whole team actually agreed with.",
      "We wrote a Definition of Done covering auth, video, notifications, subtitles and cross-platform support, so finished was not a judgement call.",
      "Sprint one was the foundation: authentication and the core video features.",
      "Sprint two was the experience: notifications, progress, the child-friendly UI and localization.",
      "Scheduled work runs server-side through Agenda, so a reminder fires whether or not the app is open.",
    ],
    risks: [
      "Video upload was the obvious one. Large files over a patient's phone connection fail often, so we costed retries and error states into the estimate instead of finding them later.",
      "Camera APIs and permissions vary enough between devices that we sized it as a high-effort story rather than a detail.",
      "Notification scheduling and editing looked simple and was not, so we planned for it up front.",
      "We flagged subtitle sync and localization as non-trivial before we started, which is the only reason they made it into sprint two at all.",
    ],
    outcomes: [
      "We delivered a working app to a real healthcare client.",
      "It runs on both iOS and Android, with subtitles in six languages built on Google Cloud speech and translation.",
      "Reminders are scheduled server-side, so they fire whether the app is open or not.",
      "Subtitles, translation and the child-friendly mode all shipped inside two sprints, which only happened because we scoped them as features rather than leaving them as polish.",
    ],
    learned:
      "Infrastructure problems - certificates, networking, a platform's own security rules - can block a product just as completely as a bug in your code, and the only way through is reading the documentation properly and testing one layer at a time. Leading the team also taught me to break work into pieces people could genuinely own on their own.",
    links: [
      {
        label: "Frontend repository",
        url: "https://github.com/ManugaHewa/Exercise-Prescription-App_CAPSTONE/tree/main/Exercise-Prescription-App-Front-End-main",
      },
      {
        label: "Backend repository",
        url: "https://github.com/ManugaHewa/Exercise-Prescription-App_CAPSTONE/tree/main/Exercise-Prescription-App-Back-End-main",
      },
      { label: "Demo video", url: "" },
    ],
  },
  {
    slug: "dms",
    title: "Donation Management System (DMS)",
    tier: 1,
    category: "Full-stack web",
    status: "In active development",
    subtitle:
      "A full-stack platform that replaces paper and spreadsheets for tracking donations to a Buddhist temple, with admin validation, donor records and receipts.",
    stack: [
      "TypeScript",
      "React",
      "Vite",
      "Node.js",
      "Express",
      "PostgreSQL",
      "Prisma",
      "Docker",
      "libphonenumber-js",
      "pnpm",
    ],
    role: "Solo Full-stack Developer",
    timeline: "2026 - present",
    context:
      "I built this for a Buddhist temple that was tracking donations on paper and in spreadsheets. It handles real donors and real money, and the receipts have to hold up if anyone audits them. That last part shaped most of the decisions I made.",
    problem:
      "Donations arrive in every form you can think of: cash in person, cheques, cards, Interac e-transfers, EFT, CanadaHelps, and gifts that are not money at all. Tracking that by hand means lost records, the same donor counted twice, and a scramble at tax-receipt time.",
    scope: [
      "A donor-facing submission flow feeding an admin queue. A donation sits at Pending Validation until an administrator has checked it against the actual payment, and only then does it become Validated.",
      "Donor profiles with contact details, address and family members.",
      "All eight donation types the temple uses: cash, cheque, credit, debit, Interac, EFT, CanadaHelps and in-kind.",
      "Donation records that capture the cause, the processor fee, and the amount actually realized.",
      "Donation purposes such as Aloka Puja and remembrance events live in a Purpose table with a code, a name and an active flag, so an admin can add one without waiting on me to ship code.",
      "An admin validation queue with approve and deny.",
      "Phone numbers normalized with libphonenumber-js, so \"(905) 555-1234\" and \"+19055551234\" resolve to the same donor instead of creating a second one.",
      "A donor portal for signup, login, managing family members and viewing past donations.",
      "A one-command dev environment that starts the Express API and the Vite frontend together.",
    ],
    stakeholders: [
      "Temple administration and the monks, who need oversight.",
      "Treasurers and accountants, who do the reconciling and the tax compliance.",
      "Donors, who might be an individual, a family or an organization.",
      "Board and committee members, who want governance dashboards.",
      "Volunteers and staff, who do the day-to-day recording.",
      "Auditors, who care about integrity and transparency more than anything else.",
    ],
    requirements: [
      "Nothing gets receipted until an administrator has signed off on it.",
      "Every channel the temple actually uses has to be supported, in-kind gifts included.",
      "A family should be able to get one receipt covering all of their donations.",
    ],
    nonFunctional: [
      "Mobile-first and WCAG 2.1 compliant, because the volunteers are recording donations on their phones.",
      "Recording a donation should take around two seconds.",
      "It should still hold up at roughly ten thousand donors.",
      "Encrypted in transit and at rest, with two-factor auth for admins and accountants.",
    ],
    deliveryProcess: [
      "Schema first. I settled the donation and donor models before building any of the UI.",
      "Everything runs in Docker, so the Postgres I develop against is the Postgres the server runs.",
    ],
    challenges: [
      "The Prisma schema insisted on Donation.type even for flows that had no sensible value for it, so I made the field optional and handled the default in the API layer.",
      "An Express requireAdmin middleware kept resolving to undefined. It was an import and export mismatch, not the middleware itself.",
      "Middleware that reassigned req.query failed outright, since it is read-only in newer Express. I moved the parsed values onto their own property on the request.",
      "prisma generate failed with EPERM on Windows because the query engine file was locked by the running dev server. Stopping the server first fixed it, which is obvious in hindsight and was not at the time.",
      "The frontend kept 404ing on port 5173. The dev script was not actually launching Vite, so I rewrote it with concurrently.",
    ],
    risks: [
      "The thing I most wanted to make impossible was receipting something nobody had checked, so Pending Validation is the state a donation is created in rather than a flag someone remembers to set.",
      "Processor fees quietly distort your totals if you only store the gross amount, so I store gross and net separately.",
      "I wanted to know who did what, so every privileged change writes to an audit log.",
    ],
    highlights: [
      "The validation gate lives in the schema, not in a policy document. DonationStatus defaults to PENDING_VALIDATION, so a donation cannot be receipted until an administrator clears it, and there is no step for anyone to forget.",
    ],
    nextSteps: [
      "Receipt generation and annual tax slips.",
      "Email notifications for donors and administrators.",
      "Role-based access control for the admin roles.",
      "Zod validation, Redis and BullMQ for background jobs, MinIO for file storage, and Mailpit for testing email.",
    ],
    learned:
      "PostgreSQL schema design, Prisma migrations, validation with Zod, role-based access control, and background jobs. I am learning all of it inside a system someone actually depends on rather than by following tutorials.",
    links: [
      {
        label: "GitHub repository",
        url: "https://github.com/ManugaHewa/DonationManagamentSystem-DMS-/tree/Test",
      },
    ],
  },
  {
    slug: "alice",
    title: "Alice in Brussels",
    tier: 1,
    category: "Frontend web",
    status: "Completed and deployed",
    subtitle:
      "A bilingual digital museum exhibition about two Italian rural schools at the 1910 Brussels World's Fair.",
    stack: [
      "HTML5",
      "CSS3",
      "JavaScript",
      "Bootstrap 5",
      "GitHub Pages",
      "Git",
      "Lighthouse",
      "Accessibility",
    ],
    role: "Frontend Developer",
    timeline: "June 2025 - September 2025",
    context:
      "A paid work-study position with the Department of Languages and Cultures at Western, supervised by Prof. Cristina Caracchini, on a team of four student developers with a faculty lead. The history behind it: in 1910 the Montesca and Rovigliano schools, founded by Alice Hallgarten Franchetti for the children of Umbrian farmers, took their teaching approach to the Universal Exposition in Brussels. A 2024 exhibition in Citta di Castello recreated that display, and our job was to put it online for an international audience in English and Italian.",
    scope: [
      "Redesigned the landing page into something closer to walking through a museum, with a hero video, \"Choose Your View\" cards and navigation that stayed consistent. The design went through a gold and deep-blue phase before we settled on the bottle-green theme and applied it to every page.",
      "An interactive hotspot system over photographs of the exhibition's back wall: clickable regions that scale correctly with the image at any screen size and open an enlarged view of each frame.",
      "Flip-card popups so a visitor can turn an artifact over and read its history, closing on Escape or a click outside.",
      "A multi-panel \"by components\" section, plus fixes for the panels that were not displaying at all - a broken panel-index mapping and an invalid video embed.",
      "Consistent card sizing and hover animations across the landing page.",
      "A proper catalogues page to replace a raw PDF link, sharing one external stylesheet across both languages.",
      "Rebuilt the Italian landing page to match the English one, applied the official translation spreadsheet, and killed a double scrollbar caused by horizontal overflow.",
      "Worked out why the background video failed on GitHub Pages - relative paths under the repo subpath, file-size limits, case sensitivity - and added a poster image as a fallback.",
      "Language switching between English and Italian, and the accessibility work: alt text, ARIA labels, keyboard navigation and reduced-motion support.",
    ],
    deliveryProcess: [
      "Four of us worked on separate Git branches to stay out of each other's way. I tracked tasks out of the team chat and got the last fixes in - the language switcher, PDF image cropping, Home link routing - before the contract ended on August 30.",
    ],
    outcomes: [
      "The whole thing holds sixty frames a second, and it is still fully keyboard navigable.",
      "Visitors explore through an interactive overlay rather than clicking from page to page.",
      "Responsive images and lazy loading keep it light despite how much media it carries.",
    ],
    links: [
      { label: "Live site", url: "" },
      { label: "GitHub repository", url: "" },
    ],
  },
  {
    slug: "flaky",
    title: "Flaky Test Detector",
    tier: 1,
    category: "Machine learning / Developer tooling",
    status: "Pipeline built; scaling up data collection",
    subtitle:
      "A machine-learning tool that reads CI history from real open-source projects and predicts whether a failing test is a real bug or just flaky.",
    stack: [
      "Python",
      "pandas",
      "scikit-learn",
      "XGBoost",
      "GitHub Actions API",
      "pytest",
    ],
    role: "Solo Developer",
    timeline: "August 2026 - present",
    context:
      "Everyone has re-run a red build hoping it goes green, and it usually does. That habit is the actual problem: once you stop trusting the test suite you stop reading it, and at that point it is not doing anything for you. I wanted to put a number on which failures are worth your attention.",
    problem:
      "A flaky test fails because of timing, the network or the environment, not because the code is broken, and engineers lose hours chasing the false alarms. Big projects rerun failing tests automatically, which leaves a useful trail behind: if a test failed and then passed on the same commit, it was almost certainly flaky.",
    scope: [
      "collect_data.py pulls workflow run history and raw job logs out of the GitHub Actions API, with a --list-jobs helper for finding the right test jobs in the first place.",
      "features.py labels each failure using the failed-then-passed-on-rerun-at-the-same-commit signal, then builds features like historical failure rate, how similar the error messages are, and a duration z-score. It only ever looks at data from before the failure it is describing, so the model cannot see the future.",
      "train.py trains logistic regression or XGBoost on a time-based split and reports precision and recall instead of accuracy.",
      "predict_cli.py scores a fresh set of failures and prints a flakiness report you can read.",
      "Pointed at apache/airflow and scrapy/scrapy, both big enough to rerun failing tests automatically.",
    ],
    requirements: [
      "The label has to come from something that actually happened rather than from an opinion, which is why a rerun flip at a fixed commit is the signal.",
      "The baseline stays interpretable, because a score a developer cannot argue with is a score they will not trust.",
    ],
    deliveryProcess: [
      "Split by time, never at random, so the model is always being tested on runs that happened after the ones it learned from.",
      "Unit tests on the log parser specifically, including the case where a clean run has to produce no rows at all.",
    ],
    risks: [
      "A random train and test split would leak future information backwards through a test's own history, so the split is chronological.",
      "A parser can look like it is working on a log format it does not actually understand, which is what the parser tests are there to catch.",
    ],
    outcomes: [
      "It scores each failing test with a flakiness probability, learned from that repository's own CI history.",
      "Two models on the same chronological split: logistic regression as a baseline I can explain, and gradient boosted trees.",
      "The log parser is unit tested, including the case where a clean run has to produce nothing.",
    ],
    highlights: [
      "My first plan was to parse JUnit XML. An open upstream issue told me pytest's JUnit output does not reliably record rerun attempts, which means every label I built from it would have been quietly wrong. I switched to parsing the raw GitHub Actions job logs, where pytest-rerunfailures prints explicit RERUN lines. Catching that before it got into the dataset mattered more than anything else I did on this project.",
      "The chronological split is what separates a working model from a flattering one. The features come from each test's own history, so a random split hands the model the future and reports an accuracy that does not exist.",
      "About eight hundred lines end to end, from collecting logs to scoring failures, with the parser under its own unit tests.",
    ],
    nextSteps: [
      "100 runs of a single Scrapy job gave me exactly one usable labelled row, so next is 500+ runs across several Python-version job variants, where environment-dependent flakiness is likelier to show up.",
      "Check my labels against the project's own flaky-test issue tags.",
      "Report precision and recall on held-out commits.",
      "Package it as a GitHub Action.",
    ],
    links: [
      { label: "GitHub repository", url: "https://github.com/ManugaHewa/FLAKY" },
    ],
  },
  {
    // Predates portfolio_projects.txt, so nothing here comes from it. The
    // category is read off this entry's own stack rather than added as a new
    // claim, and status is left unset because the entry never stated one.
    slug: "smart-grocery",
    title: "Smart Grocery App",
    tier: 1,
    category: "Full-stack web / Mobile",
    subtitle:
      "A constrained optimisation engine behind three client surfaces, with every push gated on typecheck, tests and build.",
    stack: [
      "TypeScript",
      "Node.js",
      "Express",
      "React",
      "Vite",
      "Expo",
      "PostgreSQL",
      "Zod",
      "Vitest",
      "GitHub Actions",
    ],
    role: "Full-stack engineer, solo build",
    timeline: "Built across April and May 2026",
    context:
      "Splitting a grocery list across stores is a real optimization problem hiding inside an everyday chore. The same items cost different amounts at different shops, dietary rules rule some of them out completely, and the cheapest split usually is not worth the extra driving. Most price apps sidestep all of that by comparing one store at a time.",
    problem:
      "Comparing one store at a time cannot answer the question you actually have: given this basket, these dietary rules, and a limit on how many stops I am willing to make, where should I buy each item? Working that out by hand is tedious enough that nobody does it.",
    scope: [
      "Four strategies over the same basket - cheapest, fewest stops, balanced, and preference safe.",
      "Household preferences that genuinely constrain the answer: dietary tags, a budget, preferred brands, and penalties for extra stops and travel.",
      "Basket and item CRUD, with duplicate warnings and a reuse flow for the shop you do every week.",
      "A natural-language endpoint that previews a typed-out list before it becomes a basket.",
      "Price history with alert rules, evaluated by a scheduled job that respects a per-alert cooldown.",
      "A substitution inspector that explains why each line item was chosen.",
      "An admin queue for reviewing low-confidence product matches.",
      "Three surfaces over one contract - React web, Expo mobile, and the API - sharing a types package.",
    ],
    requirements: [
      "Preferences have to exclude products, not just rank them lower, so price can never quietly override a dietary rule.",
      "Every recommended line carries the reasoning behind it, including the store and what else was considered.",
      "Alerts must not fire again on every evaluation pass, which is what the cooldown window is for.",
    ],
    nonFunctional: [
      "One shared contracts package, so the web app, the mobile app and the API cannot drift apart without somebody noticing.",
      "JWT auth with helmet, rate limiting, and Zod validation at the boundary.",
      "Structured request logging through pino.",
    ],
    deliveryProcess: [
      "GitHub Actions runs on every push and every pull request.",
      "The backend job gates on three steps in order - typecheck, then test, then build.",
      "Nineteen tests across six files, using vitest, with supertest for the HTTP-level cases.",
      "Tests sit next to the code they cover: parsing, optimization, persistence, config and admin authorization each have their own.",
    ],
    risks: [
      "An optimizer that finds you the cheapest basket by sending you to five different shops is technically right and completely useless, so stop count is a real penalty in the model rather than an afterthought.",
      "Fuzzy product matching can quietly swap in the wrong item, so low-confidence matches go to an admin queue instead of being trusted.",
      "Alert rules firing over and over on one price movement, which the cooldown check prevents before anything is sent.",
    ],
    outcomes: [
      "A pipeline that will not let a broken change through: typecheck, then tests, then build, on every push and every pull request, across two jobs.",
      "One basket resolves into a per-store plan with the reasoning attached to each line.",
      "Persistence sits behind a repository interface, with the PostgreSQL schema and migrations written against it and committed.",
    ],
    highlights: [
      "This is where the testing and pipeline claims elsewhere on this site come from. Not a promise about how I work - a workflow file and nineteen passing tests you can run yourself.",
      "One contracts package feeding a React web app, an Expo mobile app and the API, so a breaking change shows up at compile time instead of in production.",
    ],
    links: [],
  },
  {
    slug: "sketch2photo",
    title: "Sketch2Photo (Pix2Pix GAN)",
    tier: 1,
    category: "Deep learning / Computer vision",
    status: "Completed",
    subtitle:
      "An image-to-image translation model that improves on Pix2Pix with self-attention and a multi-scale discriminator.",
    stack: [
      "Python",
      "PyTorch",
      "U-Net",
      "PatchGAN",
      "Self-attention",
      "torchvision",
      "LPIPS",
      "scikit-learn",
      "NumPy",
      "Jupyter",
    ],
    role: "Machine learning engineer, solo build",
    timeline: "December 2025",
    context:
      "Pix2Pix turns one kind of image into another - a building layout sketch into a photo-realistic facade, say. A generator produces the output, a discriminator tries to tell real from generated, and the two get better by competing. What I liked about working on this is that adversarial training shows you its own failures directly: a collapsed generator or a washed-out, over-smoothed result tells you in the picture itself what your loss function was actually rewarding. Getting something sharp out of it meant balancing five objectives against each other.",
    problem:
      "A plain Pix2Pix generator produces texture that looks fine up close but loses the overall structure, and an L1 loss on its own pulls every prediction toward a blurry average of the training set. Most of the work here is the constraints that stop both of those happening.",
    scope: [
      "A U-Net generator with skip connections, extended with a self-attention block to hold the global structure together.",
      "A multi-scale PatchGAN discriminator working at two scales, exposing its intermediate features for feature matching.",
      "Five losses combined: adversarial BCE, L1 reconstruction, VGG perceptual, feature matching, and optionally LPIPS.",
      "The whole pipeline in one notebook - extract, pair sketches to photos by filename, split train and validation and test, train, evaluate, visualize.",
      "Learning-rate scheduling, checkpointing, and early stopping on validation loss.",
    ],
    requirements: [
      "Paired data matched by filename, split before any training starts so the test set is never seen.",
      "Evaluation on held-out test L1 alongside side-by-side generated and real images, because one number does not tell you whether the output looks right.",
    ],
    risks: [
      "L1 on its own produces blur, which is exactly what the perceptual and adversarial terms are there to counter.",
      "The discriminator overpowering the generator, which feature matching on intermediate activations helps with rather than judging the output alone.",
      "Overfitting across a long run, handled by early stopping on validation loss instead of picking an epoch count and hoping.",
    ],
    outcomes: [
      "Five loss terms trained in balance: adversarial, L1, VGG perceptual, feature matching and LPIPS.",
      "Evaluated on held-out test L1 next to side-by-side generated and real images, because a single scalar cannot tell you whether a picture looks right.",
      "Learning-rate scheduling, checkpointing and early stopping driven by validation loss rather than a fixed epoch count.",
    ],
    highlights: [
      "The self-attention block inside the U-Net generator lets it relate parts of the image that are far apart, instead of only reasoning about neighbouring pixels the way a plain convolutional stack does.",
      "The discriminator judges at two resolutions in the same pass, which is how it catches both fine texture and overall composition.",
      "Feature-matching loss computed on the discriminator's intermediate activations - the standard defence against a discriminator that runs away from its generator.",
    ],
    learned:
      "How unstable GAN training really is, why architecture choices like attention and multi-scale discrimination matter as much as they do, and how you evaluate a generative model when accuracy is not a thing you can measure.",
    links: [
      { label: "GitHub repository", url: "" },
      { label: "Sample outputs", url: "" },
    ],
  },

  // ---------------------------------------------------- other work
  {
    slug: "portfolio-v2",
    title: "Portfolio v2 + Self-Hosted Home Server",
    tier: 2,
    category: "Full-stack web / DevOps",
    status: "Live on local network; public exposure in progress",
    subtitle:
      "My portfolio site, rebuilt as a real full-stack application and self-hosted on a laptop I turned into a Linux server with automatic deployments.",
    stack: [
      "React 18",
      "TypeScript",
      "Vite",
      "GSAP ScrollTrigger",
      "Express",
      "Prisma",
      "PostgreSQL",
      "Vitest",
      "React Testing Library",
      "GitHub Actions",
      "Ubuntu Server",
      "Nginx",
      "systemd",
      "Docker Compose",
      "DuckDNS",
    ],
    role: "Solo Developer",
    timeline: "September 2026",
    problem:
      "My old portfolio was static HTML, CSS and JavaScript, and it described me as a full-stack developer. The site itself was the best evidence I had, so it needed to actually be built with the stack I was claiming.",
    scope: [
      "Rebuilt the site as a React and TypeScript frontend on an Express API that serves the project data out of PostgreSQL through Prisma.",
      "Frontend and backend tests, and a CI pipeline that runs them on every push against a real Postgres service container.",
      "Wiped an old HP laptop, installed Ubuntu, and set it up headless: SSH access, lid-close suspend disabled, the backend running as a systemd service, and Nginx serving the production build.",
      "A deploy.sh script on a five-minute cron that checks GitHub for new commits, then rebuilds and restarts the site on its own.",
    ],
    challenges: [
      "First I fixed what was already broken in the old site: the wrong \"NorthGrid\" branding, a scroll-spy ordering bug, a GitHub link pointing at a test branch, and a canvas animation running an infinite requestAnimationFrame loop with no accessibility fallback.",
      "Windows Application Control blocked Rollup's native binary and took the Vite dev server down with it. A Windows Security exclusion and WSL2 sorted it out.",
      "Nginx threw 500s because www-data could not read files in my home directory. I moved the build to /var/www/portfolio with the right ownership.",
      "I ran the Prisma migrations and seeds from the wrong workspace directory the first time, which explains more confusion than it should have.",
    ],
    nextSteps: [
      "Public access through DuckDNS and router port forwarding, once I have checked whether I am behind CGNAT.",
      "The GSAP pinned hero animation, with prefers-reduced-motion support.",
    ],
    links: [
      { label: "GitHub repository", url: "https://github.com/ManugaHewa/portfolio-v2" },
      { label: "Live site", url: "" },
    ],
  },
  {
    slug: "shopsense",
    title: "ShopSense",
    tier: 2,
    category: "Data science / Python",
    status: "Completed",
    subtitle:
      "A collaborative-filtering recommender that suggests products to shoppers based on what similar customers bought.",
    stack: ["Python", "pandas", "scikit-learn", "CLI"],
    scope: [
      "Merged purchase history with product metadata into a modelling dataset of over a thousand transactions.",
      "Built a user-product matrix from purchase quantities across more than fifty product categories.",
      "Computed customer-to-customer cosine similarity and generated top-N recommendations for each user.",
      "Wrapped it in an interactive CLI: enter a customer ID, get ranked suggestions back.",
      "Checked the results with pivot tables and correlations, and compared them against a plain most-popular-items baseline.",
    ],
    learned:
      "Why sparse user-item data is so hard, why a popularity baseline is the bar any recommender has to clear before it means anything, and how to structure a pipeline from raw CSVs through to a model you can actually use.",
    links: [
      {
        label: "GitHub repository",
        url: "https://github.com/ManugaHewa/AI-Product-Reccomendation",
      },
    ],
  },
  {
    slug: "durb",
    title: "DURB Onboarding Web App",
    tier: 2,
    category: "Frontend web",
    status: "Completed",
    subtitle:
      "A React onboarding experience that introduces new players to a game's 20+ abilities.",
    stack: ["React", "react-slick", "Docker"],
    role: "Frontend Developer",
    scope: [
      "An onboarding flow built on a react-slick carousel that walks a new player through more than twenty abilities, one card each.",
      "Responsive UI components throughout.",
      "A Docker setup so it runs the same way on anyone's machine.",
    ],
    links: [{ label: "GitHub repository", url: "" }],
  },
  {
    slug: "superhero-api",
    title: "Superhero REST API",
    tier: 2,
    category: "Backend / Cloud",
    status: "Completed",
    subtitle:
      "A cloud-hosted REST API for searching superheroes and building custom hero lists.",
    stack: ["Node.js", "Express", "AWS EC2", "AWS Lightsail"],
    role: "Developer",
    scope: [
      "Deployed the API and its frontend to an AWS EC2 instance, so it ran on the public internet instead of only on localhost.",
    ],
    learned:
      "REST design, input validation, and what it actually takes to run a server in the cloud - security groups, SSH, and keeping a Node process alive when you are not watching it.",
    links: [{ label: "GitHub repository", url: "" }],
  },
  {
    slug: "ifinance",
    title: "iFINANCE Accounting Application",
    tier: 2,
    category: "Desktop software / Java",
    status: "Completed",
    subtitle: "A desktop double-entry accounting app for small businesses.",
    stack: ["Java", "JavaFX"],
    learned:
      "How to design a larger object-oriented Java application, how to keep the UI separate from the business logic, and how much care it takes to model real-world rules like accounting correctly in code.",
    links: [{ label: "GitHub repository", url: "" }],
  },
  {
    slug: "mail-client",
    title: "Mail Client",
    tier: 2,
    category: "Networking",
    status: "Completed",
    subtitle:
      "An email client that talks directly to mail servers using the underlying protocols.",
    stack: ["Python", "TCP sockets", "SMTP"],
    role: "Developer",
    scope: [
      "Opens raw socket connections to a mail server and speaks the protocol one command at a time, with no mail library in between.",
      "Handles the server's responses and error codes.",
    ],
    learned:
      "What application-layer protocols are actually doing underneath the libraries that usually hide them, and how client and server communication is really structured.",
    links: [{ label: "GitHub repository", url: "" }],
  },
  {
    slug: "distance-vector-routing",
    title: "Distance-Vector Routing Simulator",
    tier: 2,
    category: "Networking / Algorithms",
    status: "Completed",
    subtitle:
      "An implementation of the distance-vector routing algorithm that lets simulated routers discover the shortest paths through a network.",
    stack: ["Python", "Bellman-Ford"],
    role: "Developer",
    scope: [
      "Router nodes that start out knowing only what it costs to reach their direct neighbours.",
      "They swap distance vectors with those neighbours and update their routing tables with the Bellman-Ford equation until the whole network agrees on the shortest paths.",
      "Prints each router's table as it converges.",
    ],
    learned:
      "How the routing protocols behind the internet work at the algorithm level, and how a distributed system reaches agreement with nobody in charge of it.",
    links: [{ label: "GitHub repository", url: "" }],
  },
];

async function main() {
  for (const [index, { links, ...project }] of PROJECTS.entries()) {
    // Upsert the project, then replace its links wholesale. Deleting first
    // keeps the seed idempotent: re-running it cannot accumulate duplicate
    // links the way a bare createMany would.
    // `position` comes from this array, so the running order on the site is
    // the order the entries appear in this file rather than whenever a row
    // happened to be first inserted.
    const withPosition = { ...project, position: index };
    const saved = await prisma.project.upsert({
      where: { slug: project.slug },
      update: withPosition,
      create: withPosition,
    });

    await prisma.projectLink.deleteMany({ where: { projectId: saved.id } });
    if (links.length > 0) {
      await prisma.projectLink.createMany({
        data: links.map((link, position) => ({
          ...link,
          position,
          projectId: saved.id,
        })),
      });
    }
    console.log(`  ${index + 1}. [tier ${project.tier}] ${project.title}`);
  }

  // Anything seeded previously that is no longer in this file is stale: the
  // list above is the source of truth for what the site shows.
  const removed = await prisma.project.deleteMany({
    where: { slug: { notIn: PROJECTS.map((p) => p.slug) } },
  });
  if (removed.count > 0) console.log(`  removed ${removed.count} stale project(s)`);
}

main()
  .then(async () => {
    console.log("Seed complete.");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
