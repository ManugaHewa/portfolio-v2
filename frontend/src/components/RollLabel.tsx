/**
 * A button's or link's label that rolls up on hover and keyboard focus to
 * reveal the same words rolling in from below (base.css, .roll), the same
 * movement as the header's nav links. The copy is generated content with
 * empty alt text, so the control is still named once. Still under reduced
 * motion.
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
