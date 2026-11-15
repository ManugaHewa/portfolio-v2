/**
 * A label that rolls up on hover and focus, revealing a copy from below
 * (base.css .roll), like the nav links. The copy has empty alt text. Still
 * under reduced motion.
 */
export function RollLabel({ children }: { children: string }) {
  return (
    <span className="roll">
      <span className="roll-text" data-text={children}>
        {children}
      </span>
    </span>
  );
}
