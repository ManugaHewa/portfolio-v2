/**
 * Set by Hero.tsx while the docking flight hides the live wheel. The wheel
 * scene keeps simulating (a Spin can still land) but skips drawing.
 */
let hidden = false;

export function setWheelHidden(next: boolean): void {
  hidden = next;
}

export function wheelHidden(): boolean {
  return hidden;
}
