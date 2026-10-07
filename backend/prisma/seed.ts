// Writes the projects in content/projects.ts to Postgres, which the API
// serves. deploy.sh runs this on every deploy, so a change to that file
// reaches the API and the prerendered HTML in the same deploy.
//
//   npx tsx backend/prisma/seed.ts
//
// The env is loaded explicitly, repo-root .env first, so it works from any
// directory. Left to Prisma's own discovery it only found DATABASE_URL when
// run from the repo root, and failed with a misleading "Environment variable
// not found" from backend/.
import { loadEnv } from "../scripts/env.js";
import { PROJECTS } from "../../content/projects.js";

loadEnv();

// Imported after loadEnv, so the client is built with the right DATABASE_URL.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  for (const [index, { links, ...project }] of PROJECTS.entries()) {
    // Upsert the project, then replace its links wholesale. Deleting first
    // keeps the seed idempotent: re-running it cannot accumulate duplicate
    // links the way a bare createMany would.
    // `position` comes from this array, so the running order on the site is
    // the order the entries appear in content/projects.ts rather than whenever a row
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

  // Anything seeded previously that is no longer in content/projects.ts is stale: that
  // file is the source of truth for what the site shows.
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
