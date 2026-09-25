import { useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_BY_ID, SKILLS } from "../skills";
import type { CategoryId } from "../skills";
import { sceneBudget } from "../lib/sceneQuality";

export interface SkillsGraphProps {
  /** Name of the currently selected skill, or null. Controlled by the parent. */
  selected: string | null;
  onSelect: (name: string | null) => void;
  onHover?: (name: string | null) => void;
  /** Categories currently switched on in the legend. */
  active: Set<CategoryId>;
}

interface Dot {
  skill: number;
  category: CategoryId;
  angle: number; // base bearing, radians
  radius: number; // 0..1, from centre
  r: number; // dot radius in px at scale 1
  /** Angular drift, rad/s. Signed, so neighbouring dots separate. */
  drift: number;
  /** Phase offset for the radial bob, so they do not breathe in unison. */
  phase: number;
  /** How far it bobs in and out, in normalised radius. */
  bob: number;
}

/**
 * A radial depth scope rather than a 3D node cloud.
 *
 * The previous version drew all 52 labels at once inside a rotating
 * perspective graph. The labels collided constantly, and the rotation
 * encoded nothing - it was motion for its own sake, which is what made the
 * thing hard to read.
 *
 * Here position means something: the angle is the domain, and the distance
 * from the centre is depth, so the strongest skills sit in the core and the
 * ring you are looking at tells you the level. Only the seven domain names
 * are permanently drawn; a skill names itself when you point at it. That
 * one change is what removes the clutter.
 */
const DEPTH_RINGS = 5;
// Level 5 lands near the middle, level 1 out at the rim.
const INNER = 0.3;
const OUTER = 0.94;

function buildLayout(): Dot[] {
  const dots: Dot[] = [];
  const sector = (Math.PI * 2) / CATEGORIES.length;

  CATEGORIES.forEach((cat, ci) => {
    const members = SKILLS.map((s, i) => ({ s, i })).filter(({ s }) => s.category === cat.id);
    // Start at the top and run clockwise, leaving a gap between sectors so
    // neighbouring domains stay visually separate.
    const start = ci * sector - Math.PI / 2 + sector * 0.1;
    const usable = sector * 0.8;

    members.forEach(({ s, i }, k) => {
      // Spread members across their sector; a lone skill sits mid-sector.
      const t = members.length === 1 ? 0.5 : k / (members.length - 1);
      const depth = (s.level - 1) / (DEPTH_RINGS - 1); // 0 = level 1, 1 = level 5
      // Deterministic per-skill jitter: same layout on every load, but
      // every dot moves on its own schedule.
      const seed = (i * 2654435761) % 1000 / 1000;
      dots.push({
        skill: i,
        category: cat.id,
        angle: start + usable * t,
        radius: OUTER - (OUTER - INNER) * depth,
        r: 3.4 + s.level * 0.75,
        // Dots drift within their own sector, alternating direction.
        drift: (0.018 + seed * 0.03) * (k % 2 === 0 ? 1 : -1),
        phase: seed * Math.PI * 2,
        bob: 0.012 + seed * 0.022,
      });
    });
  });

  return dots;
}

export function SkillsGraph({ selected, onSelect, onHover, active }: SkillsGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  const viewRef = useRef({ selected, active, onSelect, onHover });
  useEffect(() => {
    viewRef.current = { selected, active, onSelect, onHover };
  }, [selected, active, onSelect, onHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = buildLayout();
    const byName = new Map<string, number>();
    dots.forEach((d, i) => byName.set(SKILLS[d.skill].name, i));

    // Same budget the WebGL scenes use, so every canvas on the page agrees
    // about what a phone should be asked to draw.
    let dpr = sceneBudget().pixelRatio;
    let hoverIdx: number | null = null;
    // Screen positions in CSS pixels, refreshed each frame for hit testing.
    let hits: Array<{ i: number; x: number; y: number; r: number }> = [];
    // The sweep, echoing the sonar on the hero mark.
    let sweep = -Math.PI / 2;
    let elapsed = 0;
    let last = performance.now();

    const resize = () => {
      const rect = container.getBoundingClientRect();
      dpr = sceneBudget().pixelRatio;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    const pick = (lx: number, ly: number): number | null => {
      const { active: act } = viewRef.current;
      let best: number | null = null;
      let bestD = Infinity;
      for (const h of hits) {
        if (!act.has(dots[h.i].category)) continue;
        const d = (h.x - lx) ** 2 + (h.y - ly) ** 2;
        const reach = Math.max(h.r + 7, 12);
        if (d < reach * reach && d < bestD) {
          bestD = d;
          best = h.i;
        }
      }
      return best;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
      if (hit === hoverIdx) return;
      hoverIdx = hit;
      canvas.style.cursor = hit === null ? "default" : "pointer";
      viewRef.current.onHover?.(hit === null ? null : SKILLS[dots[hit].skill].name);
    };

    const onLeave = () => {
      if (hoverIdx === null) return;
      hoverIdx = null;
      viewRef.current.onHover?.(null);
    };

    const onClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
      const name = hit === null ? null : SKILLS[dots[hit].skill].name;
      viewRef.current.onSelect(name === viewRef.current.selected ? null : name);
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);

    const draw = (now: number) => {
      if (!runningRef.current) return;
      const dt = Math.min(now - last, 48);
      last = now;
      if (!reduceMotion) {
        elapsed += dt / 1000;
        sweep += (dt / 1000) * ((Math.PI * 2) / 5.5); // one turn per 5.5s
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      // Fills the card: the rim labels sit just inside the edge at 1.06R,
      // so the scope uses the height it has instead of floating in it.
      const R = Math.min(w, h) * 0.455;
      /**
       * The whole display turns clockwise. On a canvas the y axis points
       * down, so a *rising* angle sweeps from +x toward +y, which reads
       * clockwise on screen. Sector dividers, rim labels and dots all take
       * the same offset, so a skill never drifts out of its own domain
       * wedge - the map keeps meaning while it rotates.
       */
      const spin = reduceMotion ? 0 : elapsed * 0.075;
      const { selected: selName, active: act } = viewRef.current;
      const selIdx = selName != null ? (byName.get(selName) ?? null) : null;
      const focus = hoverIdx ?? selIdx;

      // --- Depth rings -------------------------------------------------
      ctx.lineWidth = dpr;
      for (let ring = 1; ring <= DEPTH_RINGS; ring++) {
        const t = (ring - 1) / (DEPTH_RINGS - 1);
        const rr = R * (OUTER - (OUTER - INNER) * t);
        ctx.strokeStyle = `rgba(106,185,231,${ring === DEPTH_RINGS ? 0.16 : 0.07})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- Sector dividers ---------------------------------------------
      const sector = (Math.PI * 2) / CATEGORIES.length;
      ctx.strokeStyle = "rgba(106,185,231,0.06)";
      for (let i = 0; i < CATEGORIES.length; i++) {
        const a = i * sector - Math.PI / 2 + spin;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * INNER * 0.7, cy + Math.sin(a) * R * INNER * 0.7);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }

      // --- Range pings expanding from the hub ---------------------------
      if (!reduceMotion) {
        // Was 2.75s with three concurrent rings, so a new ping left the hub
        // every 0.9s. Now one crossing takes 7s and only two are in flight,
        // which is a pulse every 3.5s instead - slower and far less busy.
        const PING_PERIOD = 7;
        const PING_COUNT = 2;
        for (let k = 0; k < PING_COUNT; k++) {
          const t = ((elapsed + k * (PING_PERIOD / PING_COUNT)) % PING_PERIOD) / PING_PERIOD;
          const rr = R * (0.12 + t * 0.95);
          ctx.strokeStyle = `rgba(106,185,231,${0.4 * (1 - t) ** 1.4})`;
          ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.lineWidth = dpr;
      }

      // --- Sweep: bright leading edge, long wake ------------------------
      if (!reduceMotion) {
        const grad = ctx.createConicGradient?.(sweep, cx, cy);
        if (grad) {
          /**
           * The stops are mirrored (1 - offset) so the wash TRAILS the arm.
           *
           * createConicGradient runs clockwise from its start angle, and the
           * arm also travels clockwise (sweep rises, and on a canvas the y
           * axis points down, so a rising angle turns clockwise). Putting the
           * bright stop at offset 0 therefore painted the wake in the
           * direction the arm was heading - the glow arrived somewhere before
           * the beam did. Anchoring the bright stop at offset 1 puts it on
           * the arm with the falloff running back the way it came, which also
           * matches the contact pings: those use (sweep - angle), so a dot
           * lights up once the beam has passed it and decays behind.
           */
          grad.addColorStop(0, "rgba(106,185,231,0)");
          grad.addColorStop(0.58, "rgba(106,185,231,0)");
          grad.addColorStop(0.76, "rgba(106,185,231,0.028)");
          grad.addColorStop(0.91, "rgba(106,185,231,0.1)");
          grad.addColorStop(0.988, "rgba(106,185,231,0.3)");
          grad.addColorStop(1, "rgba(106,185,231,0.62)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.fill();
        }

        // The arm itself, so the beam has a hard edge to lead with.
        ctx.strokeStyle = "rgba(150,215,245,0.85)";
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
        ctx.stroke();
        ctx.lineWidth = dpr;
      }

      // --- Domain labels at the rim -------------------------------------
      ctx.font = `600 ${11.5 * dpr}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      CATEGORIES.forEach((cat, i) => {
        const a = i * sector - Math.PI / 2 + sector / 2 + spin;
        const lr = R * 1.06;
        const on = act.has(cat.id);
        const [cr, cg, cb] = cat.rgb;
        const text = cat.short.toUpperCase();
        // The window is square now and the labels ride at 1.06R, so a wide
        // one like LANGUAGE ran off the side when the rotation carried it to
        // the horizontal. Clamping each label into an inset box keeps the
        // scope at full size and the text whole: the labels trace a rounded
        // rectangle rather than a circle, which is not visible as anything
        // other than them staying on screen.
        const half = ctx.measureText(text).width / 2;
        const padX = half + 6 * dpr;
        const padY = 9 * dpr;
        const lx = Math.min(Math.max(cx + Math.cos(a) * lr, padX), w - padX);
        const ly = Math.min(Math.max(cy + Math.sin(a) * lr, padY), h - padY);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${on ? 0.92 : 0.2})`;
        ctx.fillText(text, lx, ly);
      });

      // --- Dots ----------------------------------------------------------
      hits = [];
      dots.forEach((d, i) => {
        // Live position: the bearing creeps around its sector and the
        // range breathes, so the scope reads as tracking something rather
        // than displaying a fixed diagram.
        // Global clockwise rotation plus the dot's own bearing wobble. The
        // old per-dot net drift is gone: it ran in alternating directions,
        // which fought the shared rotation and slowly smeared each domain.
        const ang = reduceMotion
          ? d.angle
          : d.angle + spin + Math.sin(elapsed * d.drift * 2.4 + d.phase) * 0.06;
        // `dist` not `rad`: `rad` is already the dot's pixel radius below.
        const dist = reduceMotion ? d.radius : d.radius + Math.sin(elapsed * 0.55 + d.phase) * d.bob;
        const x = cx + Math.cos(ang) * R * dist;
        const y = cy + Math.sin(ang) * R * dist;
        hits.push({ i, x: x / dpr, y: y / dpr, r: (d.r * dpr) / dpr });

        const on = act.has(d.category);
        const isFocus = i === focus;
        let alpha = on ? 0.85 : 0.08;
        if (focus !== null && on && !isFocus) alpha = 0.3;

        // Light up and swell as the beam crosses, then decay behind it -
        // a contact being painted by the sweep rather than a static dot.
        let ping = 0;
        if (!reduceMotion && on) {
          let diff = (sweep - ang) % (Math.PI * 2);
          if (diff < 0) diff += Math.PI * 2;
          const WAKE = 1.5;
          if (diff < WAKE) {
            ping = (1 - diff / WAKE) ** 2;
            alpha = Math.min(1, alpha + ping * 0.6);
          }
        }

        const [cr, cg, cb] = CATEGORY_BY_ID[d.category].rgb;
        const rad = d.r * dpr * (isFocus ? 1.7 : 1) * (1 + ping * 0.85);

        if (isFocus || (on && ping > 0.05)) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 4);
          g.addColorStop(0, `rgba(${cr},${cg},${cb},${(isFocus ? 0.4 : 0.55 * ping) * alpha})`);
          g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, rad * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();

        if (isFocus) {
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.6 * dpr;
          ctx.beginPath();
          ctx.arc(x, y, rad + 4 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = dpr;
        }
      });

      // --- One label, for whatever is being pointed at --------------------
      if (focus !== null) {
        const d = dots[focus];
        const skill = SKILLS[d.skill];
        // Read back the position the dot was actually drawn at this frame,
        // otherwise the chip lags behind a moving dot.
        const live = hits.find((hh) => hh.i === focus);
        const x = live ? live.x * dpr : cx + Math.cos(d.angle) * R * d.radius;
        const y = live ? live.y * dpr : cy + Math.sin(d.angle) * R * d.radius;
        const text = skill.name;
        ctx.font = `700 ${13 * dpr}px system-ui, sans-serif`;
        const tw = ctx.measureText(text).width;
        const padX = 9 * dpr;
        const bw = tw + padX * 2;
        const bh = 25 * dpr;
        // Flip the chip to the inside near the rim so it never clips.
        const side = (live ? Math.hypot(x - cx, y - cy) / R : d.radius) > 0.62 ? -1 : 1;
        let bx = x - bw / 2;
        const by = y + side * (18 * dpr) - bh / 2;
        bx = Math.max(4 * dpr, Math.min(w - bw - 4 * dpr, bx));

        ctx.fillStyle = "rgba(10,18,21,0.94)";
        ctx.strokeStyle = "rgba(106,185,231,0.35)";
        ctx.lineWidth = dpr;
        const rr = 7 * dpr;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, rr);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(240,246,248,0.98)";
        ctx.textAlign = "center";
        ctx.fillText(text, bx + bw / 2, by + bh / 2);
      }

      // --- Centre hub -----------------------------------------------------
      ctx.fillStyle = "rgba(106,185,231,0.5)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      frame = requestAnimationFrame(draw);
    };

    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        runningRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          last = performance.now();
          frame = requestAnimationFrame(draw);
        }
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    window.addEventListener("resize", resize);
    resize();

    return () => {
      io.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="skills-network" ref={containerRef}>
      <canvas ref={canvasRef} aria-hidden="true" />

      {/* The canvas is decorative to assistive tech; this is the real content. */}
      <ul className="visually-hidden">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            {c.label}
            <ul>
              {SKILLS.filter((s) => s.category === c.id).map((s) => (
                <li key={s.name}>
                  {s.name} — {s.blurb}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
