/** Facts about the site's owner, in one place. */
export const SITE = {
  name: "Manuga Hewa Pathirana",
  origin: "https://manugahewa.dev",
  email: "manugaginodh2@gmail.com",
  location: "Milton, Ontario",
  github: { label: "github.com/ManugaHewa", url: "https://github.com/ManugaHewa" },
  linkedin: { label: "linkedin.com/in/manugahewa", url: "https://www.linkedin.com/in/manugahewa" },
} as const;

/**
 * Contact message retention, quoted by the privacy page and the form. Keep
 * in step with `npm run contact:prune` (CONTACT_RETENTION_DAYS, default 365).
 */
export const RETENTION = { months: 12, label: "12 months" } as const;
