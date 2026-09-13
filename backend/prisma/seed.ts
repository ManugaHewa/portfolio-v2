import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.project.upsert({
    where: { slug: "dms" },
    update: {},
    create: {
      slug: "dms",
      title: "Donation Management System (DMS)",
      subtitle:
        "Centralized donation operations, receipts, reporting, and compliance for a real temple organization.",
      stack: ["Node.js", "Express", "TypeScript", "Prisma", "PostgreSQL", "React", "Docker"],
      githubUrl: "https://github.com/ManugaHewa/DonationManagamentSystem-DMS-",
      problem:
        "Temple donation tracking was fragmented across channels, making reconciliation, receipts, and reporting slow and error-prone.",
      scope: [
        "Donor + family records with duplicate merging",
        "Validation workflow before receipt issuance",
        "Reporting exports and full audit trail",
      ],
    },
  });

  await prisma.project.upsert({
    where: { slug: "exercise" },
    update: {},
    create: {
      slug: "exercise",
      title: "Exercise Prescription App",
      subtitle:
        "Hand-therapy companion app with video capture, reminders, accessibility, and progress tracking.",
      stack: ["React Native", "TypeScript", "Node/Express", "Video", "Notifications"],
      githubUrl:
        "https://github.com/ManugaHewa/Exercise-Prescription-App_CAPSTONE",
      problem:
        "Patients need consistent reminders and an easy way to follow prescribed exercises; therapists need a simple workflow to review progress.",
      scope: [
        "In-app video record/upload with subtitles",
        "Editable reminder scheduling",
        "Cross-platform iOS/Android support",
      ],
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
