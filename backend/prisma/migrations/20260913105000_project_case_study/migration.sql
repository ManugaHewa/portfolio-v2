-- AlterTable
ALTER TABLE "Project" DROP COLUMN "githubUrl",
DROP COLUMN "liveUrl",
ADD COLUMN     "context" TEXT,
ADD COLUMN     "deliveryProcess" TEXT[],
ADD COLUMN     "highlights" TEXT[],
ADD COLUMN     "nonFunctional" TEXT[],
ADD COLUMN     "outcomes" TEXT[],
ADD COLUMN     "requirements" TEXT[],
ADD COLUMN     "risks" TEXT[],
ADD COLUMN     "role" TEXT,
ADD COLUMN     "stakeholders" TEXT[],
ADD COLUMN     "timeline" TEXT;
-- CreateTable
CREATE TABLE "ProjectLink" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "ProjectLink_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ProjectLink_projectId_idx" ON "ProjectLink"("projectId");
-- AddForeignKey
ALTER TABLE "ProjectLink" ADD CONSTRAINT "ProjectLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
