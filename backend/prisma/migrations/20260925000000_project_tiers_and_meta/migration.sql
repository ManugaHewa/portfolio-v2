-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "category" TEXT,
ADD COLUMN     "challenges" TEXT[],
ADD COLUMN     "learned" TEXT,
ADD COLUMN     "nextSteps" TEXT[],
ADD COLUMN     "status" TEXT,
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;
