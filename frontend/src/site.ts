/**
 * Facts about the person behind the site, in one place. The email address
 * used to be typed out in three components, and the privacy page and footer
 * would have made five; a change of address should be one edit.
 */
export const SITE = {
  name: "Manuga Hewa Pathirana",
  origin: "https://manugahewa.dev",
  email: "Manugaginodh2@gmail.com",
  location: "Milton, Ontario",
  github: { label: "github.com/ManugaHewa", url: "https://github.com/ManugaHewa" },
  linkedin: { label: "linkedin.com/in/manugahewa", url: "https://www.linkedin.com/in/manugahewa" },
} as const;

/**
 * How long contact messages are kept. The privacy page and the line under the
 * form both quote it, and `npm run contact:prune` enforces the same number
 * (CONTACT_RETENTION_DAYS, default 365), so change them together.
 */
export const RETENTION = { months: 12, label: "12 months" } as const;
