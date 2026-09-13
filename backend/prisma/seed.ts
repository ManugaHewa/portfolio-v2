import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type ProjectSeed = Omit<Prisma.ProjectCreateInput, "links"> & {
  links: { label: string; url: string }[];
};

const PROJECTS: ProjectSeed[] = [
  {
    slug: "dms",
    title: "Donation Management System (DMS)",
    subtitle:
      "Centralized donation operations, receipts, reporting, and compliance for a real temple organization.",
    stack: [
      "TypeScript",
      "Node.js",
      "Express",
      "Prisma",
      "PostgreSQL",
      "React",
      "Docker",
      "WebSockets",
      "RBAC",
    ],
    role: "Full-stack engineer, end to end",
    timeline: "Multi-sprint build against a live organisation",
    context:
      "Built for a working temple organisation rather than as an exercise, which meant real donors, real money, and real tax-receipt obligations from day one.",
    problem:
      "Donation tracking was fragmented across cash, cheque, Interac and EFT, CanadaHelps, and in-kind gifts. Reconciliation, receipting, and reporting were manual, slow, and easy to get wrong, and there was no single record an auditor could trust.",
    scope: [
      "Donor and family records, with duplicate merging and support for anonymous donations.",
      "Donation recording that captures cause, processor fees, and the net amount actually realised.",
      "A validation workflow: nothing reaches a receipt until an accountant has verified it.",
      "Receipts and acknowledgements by email and printable PDF, including year-end tax receipts.",
      "Reporting exports to CSV, Excel and PDF, with dashboards over the same data.",
      "A donor portal for signup, login, managing family members, and viewing donation history.",
      "Idempotent CSV import with safe upserts, so re-running a file cannot duplicate records.",
    ],
    stakeholders: [
      "Temple administration and monks, for oversight.",
      "Treasurers and accountants, for reconciliation and tax compliance.",
      "Donors: individuals, families, and organisations.",
      "Board and committee members, who need governance dashboards.",
      "Volunteers and staff doing the daily recording.",
      "Auditors, who need integrity and transparency above everything else.",
    ],
    requirements: [
      "A Pending Validation state that blocks receipting until an accountant signs off.",
      "Role-based access control backed by audit logs on every mutation.",
      "Support for every donation channel in use, including in-kind gifts.",
      "An option to consolidate a family's donations onto a single receipt.",
    ],
    nonFunctional: [
      "WCAG 2.1 compliant and mobile-first, because the volunteers record on phones.",
      "Roughly two-second donation processing as a performance target.",
      "Designed to scale to ten thousand donors.",
      "Encryption in transit and at rest, with two-factor auth for admins and accountants.",
    ],
    deliveryProcess: [
      "Schema first: the donation and donor models were settled before any UI existed.",
      "Test automation and CI guardrails in front of every release.",
      "Dockerised environments so the team ran the same Postgres the server did.",
    ],
    risks: [
      "Duplicate donation records on re-import, handled with idempotent upserts keyed on a stable donation identity.",
      "Processor fees quietly distorting reported totals, handled by storing gross and net separately.",
      "Receipting something unverified, handled by making Pending Validation a real state rather than a flag.",
    ],
    outcomes: [
      "Around thirty percent faster release cycles through test automation and CI guardrails.",
      "Automated acknowledgements within twenty-four hours of a donation.",
      "Roughly fifty percent less administrative workload for the treasurer.",
      "Reporting accurate enough to hand to the board and to regulators.",
    ],
    links: [
      {
        label: "GitHub repository",
        url: "https://github.com/ManugaHewa/DonationManagamentSystem-DMS-/tree/Test",
      },
    ],
  },
  {
    slug: "exercise",
    title: "Exercise Prescription App",
    subtitle:
      "Hand-therapy companion app with video capture, reminders, accessibility, and progress tracking.",
    stack: [
      "React Native",
      "TypeScript",
      "Node.js",
      "Express",
      "Redux",
      "GCP",
      "Jest",
      "iOS",
      "Android",
    ],
    role: "Full-stack mobile developer, capstone team",
    timeline: "Two sprints, team delivery with story-point planning",
    context:
      "A capstone built with a hand-therapy clinic in mind: patients need to actually do their exercises between appointments, and therapists need to see whether that happened.",
    problem:
      "Patients need consistent reminders and a low-friction way to follow prescribed exercises. Therapists need a simple workflow to review progress and video submissions without chasing people by phone.",
    scope: [
      "Video: record in-app, upload, title, and delete exercise clips.",
      "Accounts: registration, login, and password change.",
      "Notifications: reminders on an editable schedule, plus exploration of location-based triggers.",
      "Progress tracking through a progress bar and per-exercise checkboxes.",
      "Accessibility: subtitles for hearing impairment, and multi-language audio and subtitles.",
      "A child-friendly UI mode for younger patients.",
      "Cross-platform iOS and Android support, tested on both.",
    ],
    deliveryProcess: [
      "Sprint planning with story-point estimation, using Fibonacci poker to reach team consensus.",
      "An explicit Definition of Done covering auth, video, notifications, subtitles, and cross-platform support.",
      "Sprint one built the foundation: authentication and the core video features.",
      "Sprint two layered on experience: notifications, progress, child-friendly UI, and localisation.",
    ],
    risks: [
      "Large video uploads over unreliable networks, with retries and error states costed into the estimate.",
      "Camera APIs and permissions differing across devices, treated as a high-effort story rather than a detail.",
      "Notification scheduling and editing being deceptively complex, so it was planned for rather than discovered.",
      "Subtitle synchronisation and localisation recognised up front as non-trivial work.",
    ],
    links: [
      {
        label: "Frontend repository",
        url: "https://github.com/ManugaHewa/Exercise-Prescription-App_CAPSTONE/tree/main/Exercise-Prescription-App-Front-End-main",
      },
      {
        label: "Backend repository",
        url: "https://github.com/ManugaHewa/Exercise-Prescription-App_CAPSTONE/tree/main/Exercise-Prescription-App-Back-End-main",
      },
    ],
  },
  {
    slug: "alice",
    title: "Alice in Brussels",
    subtitle:
      "Interactive exhibition site built around performance and accessibility.",
    stack: ["HTML5", "CSS3", "JavaScript", "Bootstrap", "Accessibility"],
    role: "Frontend developer",
    context:
      "An immersive, museum-style site where the interface is the exhibit, so the motion had to feel good without costing the page its performance budget.",
    highlights: [
      "Immersive multimedia experience holding smooth sixty-frames-per-second interactions.",
      "An interactive overlay system driving exploration rather than linear navigation.",
      "WCAG-aligned accessibility patterns with full keyboard navigation.",
      "Optimised delivery through responsive images and lazy loading.",
    ],
    links: [],
  },
];

async function main() {
  for (const [index, { links, ...project }] of PROJECTS.entries()) {
    // Upsert the project, then replace its links wholesale. Deleting first
    // keeps the seed idempotent: re-running it cannot accumulate duplicate
    // links the way a bare createMany would.
    const saved = await prisma.project.upsert({
      where: { slug: project.slug },
      update: project,
      create: project,
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

    console.log(`Seeded ${index + 1}/${PROJECTS.length}: ${project.slug}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
