/**
 * The win: once every card in the deck has been drawn, the drawn cards leave
 * the table one after another and bounce down the window, each leaving a
 * trail of itself, the way a won game of solitaire throws its cards about.
 * Drawn on one canvas over the page, which is never cleared while the cards
 * run (that is what leaves the trails), and faded away once the last one is
 * off screen. Decoration: aria-hidden, no pointer events, and the caller runs
 * it only while motion is allowed (DeckTable.tsx).
 */

export interface CascadeCard {
  /** The corner index: the project's number. */
  rank: string;
  /** 1 for a case study (ember diamond), otherwise the other work (sky ring). */
  tier: number;
  title: string;
}

/** A card in flight, in CSS pixels and seconds. */
export interface Flier {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const GRAVITY = 1900;
/** How much of its fall a card keeps after each bounce. */
const BOUNCE = 0.74;

/**
 * One step of a flier: falling, and bouncing off `floor` (the y its top
 * reaches when its bottom meets the window's foot). Returns it moved.
 */
export function stepFlier(f: Flier, dt: number, floor: number): Flier {
  let vy = f.vy + GRAVITY * dt;
  let y = f.y + vy * dt;
  if (y > floor) {
    y = floor - (y - floor) * BOUNCE;
    vy = -Math.abs(vy) * BOUNCE;
  }
  return { x: f.x + f.vx * dt, y, vx: f.vx, vy };
}

/** Whether a flier `width` wide has left a window `span` wide, either side. */
export const gone = (f: Flier, width: number, span: number) => f.x > span || f.x + width < 0;

interface Inks {
  face: string;
  edge: string;
  text: string;
  ember: string;
  emberLine: string;
  sky: string;
  skyLine: string;
  sans: string;
  mono: string;
}

function readInks(): Inks {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    face: v("--surface-1", "#0f1113"),
    edge: v("--line-strong", "#363a3f"),
    text: v("--text", "#edeeef"),
    ember: v("--ember", "#e98e49"),
    emberLine: v("--ember-line", "rgba(233, 142, 73, 0.38)"),
    sky: v("--sky", "#6ab9e7"),
    skyLine: v("--sky-line", "rgba(106, 185, 231, 0.38)"),
    sans: v("--font-sans", "sans-serif"),
    mono: v("--font-mono", "monospace"),
  };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The suit: a filled diamond for a case study, a ring for the other work. */
function suit(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, tier: number, ink: Inks, fill: boolean) {
  g.save();
  g.translate(cx, cy);
  if (tier === 1) {
    g.rotate(Math.PI / 4);
    if (fill) {
      g.fillStyle = ink.ember;
      g.fillRect(-size / 2, -size / 2, size, size);
    } else {
      g.strokeStyle = ink.ember;
      g.strokeRect(-size / 2, -size / 2, size, size);
    }
  } else {
    g.beginPath();
    g.arc(0, 0, size / 2, 0, Math.PI * 2);
    g.strokeStyle = ink.sky;
    g.stroke();
  }
  g.restore();
}

/** One card's face, drawn once at `w` by `h` CSS pixels, to stamp along its path. */
function drawCard(card: CascadeCard, w: number, h: number, scale: number, ink: Inks): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(scale, scale);
  const r = w * 0.055;
  roundRect(g, 0.5, 0.5, w - 1, h - 1, r);
  g.fillStyle = ink.face;
  g.fill();
  g.strokeStyle = ink.edge;
  g.lineWidth = 1;
  g.stroke();
  const inset = w * 0.03;
  roundRect(g, inset, inset, w - inset * 2, h - inset * 2, r * 0.6);
  g.strokeStyle = card.tier === 1 ? ink.emberLine : ink.skyLine;
  g.stroke();
  // The corner index.
  const corner = w * 0.065;
  const size = w * 0.052;
  g.fillStyle = card.tier === 1 ? ink.ember : ink.sky;
  g.font = `600 ${size}px ${ink.mono}`;
  g.textAlign = "center";
  g.textBaseline = "top";
  g.fillText(card.rank, corner + size * 0.7, corner);
  suit(g, corner + size * 0.7, corner + size * 1.9, Math.max(5, size * 0.75), card.tier, ink, true);
  // The pip, large, in the open top half.
  g.globalAlpha = 0.55;
  g.lineWidth = 1;
  suit(g, w / 2, h * 0.26, w * 0.2, card.tier, ink, false);
  g.globalAlpha = 1;
  // The title, on up to two lines, low on the card.
  g.fillStyle = ink.text;
  g.font = `700 ${w * 0.095}px ${ink.sans}`;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const words = card.title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > w * 0.83 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const lead = w * 0.105;
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, w * 0.085, h * 0.62 + i * lead, w * 0.83));
  return c;
}

/**
 * Starts the cascade from `from` (the face-up card's box, in the viewport)
 * with `cards`, top first. Returns a stop that ends it at once. A browser
 * without a 2D canvas simply gets nothing.
 */
export function runCascade(from: DOMRect, cards: CascadeCard[], random: () => number = Math.random): () => void {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g || cards.length === 0) return () => {};
  const scale = Math.min(2, window.devicePixelRatio || 1);
  // The window's own box, without its scrollbar: what the fixed canvas covers.
  let span = document.documentElement.clientWidth;
  let foot = document.documentElement.clientHeight;
  canvas.className = "win-cascade";
  canvas.setAttribute("aria-hidden", "true");
  canvas.width = Math.round(span * scale);
  canvas.height = Math.round(foot * scale);
  g.scale(scale, scale);
  document.body.appendChild(canvas);

  const ink = readInks();
  // A little smaller than on the table, so the trails leave the page legible
  // round them.
  const w = from.width * 0.7;
  const h = from.height * 0.7;
  const x0 = from.left + (from.width - w) / 2;
  const y0 = from.top + (from.height - h) / 2;
  const faces = cards.map((c) => drawCard(c, w, h, scale, ink));
  const GAP = 0.26;
  const fliers: Array<Flier | null> = cards.map(() => null);
  let launched = 0;
  let clock = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  const onResize = () => {
    span = document.documentElement.clientWidth;
    foot = document.documentElement.clientHeight;
  };
  window.addEventListener("resize", onResize);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    canvas.remove();
  };

  const fade = () => {
    canvas.classList.add("is-done");
    const done = window.setTimeout(stop, 700);
    canvas.addEventListener("transitionend", () => {
      window.clearTimeout(done);
      stop();
    });
  };

  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    while (launched < cards.length && clock >= launched * GAP) {
      // Off to one side or the other, a little up or straight down.
      const side = random() < 0.5 ? -1 : 1;
      fliers[launched] = { x: x0, y: y0, vx: side * (260 + random() * 180), vy: -(80 + random() * 380) };
      launched++;
    }
    let running = launched < cards.length;
    fliers.forEach((f, i) => {
      if (!f) return;
      const next = stepFlier(f, dt, foot - h);
      if (gone(next, w, span)) {
        fliers[i] = null;
        return;
      }
      fliers[i] = next;
      running = true;
      const face = faces[i];
      if (face) g.drawImage(face, next.x, next.y, w, h);
    });
    if (running) raf = requestAnimationFrame(frame);
    else fade();
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
