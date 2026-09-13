export type CapabilityIconId =
  | "layers"
  | "shield"
  | "ship"
  | "cursor"
  | "database"
  | "lock";

// Single-stroke line art on a 24x24 grid, inheriting currentColor so each card
// tints its own glyph. Kept as paths rather than an icon dependency: six icons
// is not worth a package, and these stay consistent with the stroke weight of
// the rest of the interface.
const PATHS: Record<CapabilityIconId, string[]> = {
  layers: ["M12 2 2 7l10 5 10-5-10-5Z", "m2 12 10 5 10-5", "m2 17 10 5 10-5"],
  shield: ["M12 3 5 6v6c0 4.2 3 7.4 7 8.4 4-1 7-4.2 7-8.4V6l-7-3Z", "m9 11.8 2.2 2.2L15.5 10"],
  ship: ["M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z", "M3 7.5 12 12l9-4.5", "M12 12v9"],
  cursor: ["m4 3 7 17 2.6-6.6L20 11 4 3Z"],
  database: [
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z",
    "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6",
    "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  ],
  lock: ["M7 10V7a5 5 0 0 1 10 0v3", "M4.5 10h15v10.5h-15z"],
};

export function CapabilityIcon({ id }: { id: CapabilityIconId }) {
  return (
    <svg
      className="capability-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
