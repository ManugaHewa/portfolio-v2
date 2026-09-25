import type { Capability } from "./components/CapabilityCard";

// Every claim ships with the receipt that settles it. The old version was
// six assertions with nothing behind them, which is exactly the thing a
// reader skims; each of these now names the file, command or workflow you
// would open to check it, revealed on hover or focus.
export const CAPABILITIES: Capability[] = [
  {
    icon: "layers",
    index: "01",
    title: "Full-stack ownership",
    body: "One schema, from database column to rendered pixel.",
    proofLabel: "Proven in",
    proof: "This portfolio",
  },
  {
    icon: "shield",
    index: "02",
    title: "Tested, not just working",
    body: "Proven by machines on both sides of the wire.",
    proofLabel: "Proven in",
    proof: "Smart Grocery App",
  },
  {
    icon: "ship",
    index: "03",
    title: "Shipped, not just coded",
    body: "The pipeline decides when a change is done, not my machine.",
    proofLabel: "Proven in",
    proof: "Smart Grocery App",
  },
  {
    icon: "cursor",
    index: "04",
    title: "Interfaces with intent",
    body: "Motion tracks scroll. Every effect has an off switch.",
    proofLabel: "Proven in",
    proof: "This portfolio",
  },
  {
    icon: "database",
    index: "05",
    title: "Data modelled on purpose",
    body: "Migrations replayed from an empty database, on every push.",
    proofLabel: "Proven in",
    proof: "Donation Management System",
  },
  {
    icon: "lock",
    index: "06",
    title: "Security as a default",
    body: "Validated at the edge. Secrets never reach the repo.",
    proofLabel: "Proven in",
    proof: "Smart Grocery App",
  },
];

/**
 * Each of these names something that exists in a repository and can be
 * checked. The previous three could not be: they described a WebSocket
 * dashboard, an idempotent CSV import and a measured release-cycle
 * improvement, none of which appear in the code they were attributed to.
 */
export const IMPACT = [
  {
    title: "Tested at the gate",
    value: "19 tests in CI",
    note: "Smart Grocery: typecheck, test, build, on every push and pull request.",
  },
  {
    title: "One contract",
    value: "Web, mobile, API",
    note: "A shared types package, so three clients cannot drift apart quietly.",
  },
  {
    title: "Compliance by default",
    value: "PENDING_VALIDATION",
    note: "DMS donations open unreceiptable until an accountant signs off.",
  },
];
