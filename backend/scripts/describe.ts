/** An error as one readable line (no Prisma code frame or stack), for the terminal and cron logs. */
export function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  return err.message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Invalid `"))
    .join(" ");
}
