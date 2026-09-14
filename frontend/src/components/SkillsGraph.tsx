import { useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_BY_ID, SKILLS } from "../skills";
import type { CategoryId } from "../skills";

interface Neuron {
  x: number; // model space, roughly -1..1
  y: number;
  z: number;
  /** Index into SKILLS, or null for the decorative filler neurons. */
  skill: number | null;
  category: CategoryId | null;
  r: number;
  charge: number; // current fire brightness 0..1
}

interface Synapse {
  a: number;
  b: number;
  weight: number;
  /** Bridges run between two different lobes and are drawn fainter. */
  bridge: boolean;
}

interface Pulse {
  synapse: number;
  from: number;
  progress: number; // 0..1 along the synapse, direction-aware
  speed: number;
  depth: number; // hops from the originating spontaneous fire
}

// Hard ceilings so a firing chain always dies out and the animation can never
// snowball into an ever-growing pulse count (that's what used to freeze the tab).
const MAX_CHAIN_DEPTH = 3;
const MAX_LIVE_PULSES = 70;

const FILLER_NEURONS = 120;
const CAM_DIST = 2.4;

export interface SkillsGraphProps {
  /** Name of the currently selected skill, or null. Controlled by the parent. */
  selected: string | null;
  onSelect: (name: string | null) => void;
  onHover?: (name: string | null) => void;
  /** Categories currently switched on in the legend. */
  active: Set<CategoryId>;
}

// Seeded PRNG so the decorative neuron cloud is stable across resizes/rerenders.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Union of two overlapping ellipsoids (hemispheres) tapering into a brainstem.
// Gives rejection-sampled points a recognizable 3D brain silhouette.
function insideBrain(x: number, y: number, z: number): boolean {
  const leftHemi = ((x + 0.32) / 0.56) ** 2 + ((y - 0.05) / 0.58) ** 2 + (z / 0.46) ** 2 <= 1;
  const rightHemi = ((x - 0.32) / 0.56) ** 2 + ((y - 0.05) / 0.58) ** 2 + (z / 0.46) ** 2 <= 1;
  const stem = Math.abs(x) < 0.14 && y < 0.05 && y > -0.58 && Math.abs(z) < 0.26;
  return leftHemi || rightHemi || stem;
}

/**
 * Skills are no longer scattered evenly over one sphere. Each category gets
 * its own lobe, so the shape of the graph carries information: a dense cluster
 * is a domain with depth behind it, and the bridges between lobes are the
 * places those domains actually touch in the codebase.
 */
function buildNetwork(rng: () => number): { neurons: Neuron[]; synapses: Synapse[] } {
  const neurons: Neuron[] = [];

  // Category centroids on a Fibonacci sphere, then squashed onto the brain's
  // proportions (wider than it is deep) so no two lobes overlap.
  const nCat = CATEGORIES.length;
  const centroids = CATEGORIES.map((c, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / nCat);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    return {
      id: c.id,
      x: Math.sin(phi) * Math.cos(theta) * 0.70,
      y: Math.cos(phi) * 0.52 + 0.02,
      z: Math.sin(phi) * Math.sin(theta) * 0.42,
    };
  });

  // Scatter each category's skills in a small blob around its centroid, again
  // on a mini Fibonacci sphere so labels inside a lobe stay legible.
  centroids.forEach((c) => {
    const members = SKILLS.map((s, i) => ({ s, i })).filter(({ s }) => s.category === c.id);
    const m = members.length;
    members.forEach(({ i }, k) => {
      const phi = Math.acos(1 - (2 * (k + 0.5)) / m);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (k + 0.5);
      // Higher-level skills sit slightly nearer their lobe's core.
      const spread = 0.3 - (SKILLS[i].level - 3) * 0.018;
      neurons.push({
        x: c.x + Math.sin(phi) * Math.cos(theta) * spread,
        y: c.y + Math.cos(phi) * spread * 0.8,
        z: c.z + Math.sin(phi) * Math.sin(theta) * spread * 0.75,
        skill: i,
        category: c.id,
        r: 4.5 + SKILLS[i].level * 0.7,
        charge: 0,
      });
    });
  });

  const labelled = neurons.length;

  // Decorative unlabelled neurons filling the rest of the volume for texture.
  let attempts = 0;
  while (neurons.length < labelled + FILLER_NEURONS && attempts < 12000) {
    attempts++;
    const x = (rng() * 2 - 1) * 0.98;
    const y = (rng() * 2 - 1) * 0.78 + 0.05;
    const z = (rng() * 2 - 1) * 0.58;
    if (!insideBrain(x, y, z)) continue;
    neurons.push({ x, y, z, skill: null, category: null, r: 1.4 + rng() * 1.5, charge: 0 });
  }

  // Connect each neuron to its nearest neighbours, a simple k-NN mesh. A
  // synapse spanning two categories is flagged as a bridge so it can be drawn
  // as the weaker, longer-range connection it is.
  const synapses: Synapse[] = [];
  const seen = new Set<string>();
  const link = (i: number, j: number, weight: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (seen.has(key)) return;
    seen.add(key);
    const ca = neurons[i].category;
    const cb = neurons[j].category;
    synapses.push({ a: i, b: j, weight, bridge: ca !== null && cb !== null && ca !== cb });
  };

  neurons.forEach((n, i) => {
    const k = n.skill !== null ? 4 : 3;
    neurons
      .map((m, j) => ({
        j,
        d: i === j ? Infinity : (m.x - n.x) ** 2 + (m.y - n.y) ** 2 + (m.z - n.z) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .forEach(({ j, d }) => {
        if (d > 0.16) return;
        link(i, j, 0.4 + rng() * 0.6);
      });
  });

  // Guarantee every lobe is reachable from its neighbours: connect the closest
  // pair of skill neurons between each pair of categories, even if the k-NN
  // pass didn't happen to bridge them.
  for (let a = 0; a < centroids.length; a++) {
    for (let b = a + 1; b < centroids.length; b++) {
      let bestI = -1;
      let bestJ = -1;
      let bestD = Infinity;
      neurons.forEach((n, i) => {
        if (n.category !== centroids[a].id) return;
        neurons.forEach((m, j) => {
          if (m.category !== centroids[b].id) return;
          const d = (m.x - n.x) ** 2 + (m.y - n.y) ** 2 + (m.z - n.z) ** 2;
          if (d < bestD) {
            bestD = d;
            bestI = i;
            bestJ = j;
          }
        });
      });
      if (bestI >= 0) link(bestI, bestJ, 0.5);
    }
  }

  return { neurons, synapses };
}

interface Projected {
  sx: number;
  sy: number;
  scale: number; // perspective size/brightness multiplier
  z2: number; // view-space depth, for back-to-front sorting
}

export function SkillsGraph({ selected, onSelect, onHover, active }: SkillsGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  // Props the render loop reads every frame. Kept in a ref so changing the
  // selection or the legend filter never tears down and rebuilds the network.
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

    const rng = mulberry32(20260912);
    const { neurons, synapses } = buildNetwork(rng);
    const adjacency: number[][] = neurons.map(() => []);
    synapses.forEach((s, i) => {
      adjacency[s.a].push(i);
      adjacency[s.b].push(i);
    });

    // Neuron index -> skill name, and the reverse, for hit testing and for
    // resolving the parent's `selected` name back to a node each frame.
    const neuronBySkillName = new Map<string, number>();
    neurons.forEach((n, i) => {
      if (n.skill !== null) neuronBySkillName.set(SKILLS[n.skill].name, i);
    });

    const pulses: Pulse[] = [];
    const synapseGlow = new Array<number>(synapses.length).fill(0);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Updated every frame; pointer hit testing reads it in CSS pixel space.
    let hitTargets: Array<{ i: number; sx: number; sy: number; scale: number }> = [];
    let hoverIdx: number | null = null;

    // --- Orbit state: yaw/pitch + drag with momentum -----------------------
    let rotY = 0.4;
    let rotX = -0.15;
    // velY/velX are angular velocity in radians PER MILLISECOND, matching
    // the `rotY += velY * dt` below. Mixing this up with an un-normalized
    // per-pointer-event pixel delta is what caused runaway spin.
    const MAX_ANGULAR_VEL = 0.0035;
    let velY = reduceMotion ? 0 : 0.00022; // gentle idle drift when untouched
    let velX = 0;
    let dragging = false;
    let lastPX = 0;
    let lastPY = 0;
    let lastMoveT = 0;
    // Distinguishes a click (select a skill) from a drag (orbit the graph).
    let pointerTravel = 0;

    const clampPitch = (v: number) => Math.max(-0.62, Math.min(0.62, v));
    const clampVel = (v: number) => Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, v));

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    /** Nearest labelled neuron under the pointer, in CSS pixels. */
    const pick = (lx: number, ly: number): number | null => {
      let best: number | null = null;
      let bestD = Infinity;
      const { active: act } = viewRef.current;
      for (const t of hitTargets) {
        const n = neurons[t.i];
        if (n.category && !act.has(n.category)) continue;
        const d = (t.sx - lx) ** 2 + (t.sy - ly) ** 2;
        // Generous radius, scaled by perspective so near nodes are easier to hit.
        const radius = 15 * t.scale;
        if (d < radius * radius && d < bestD) {
          bestD = d;
          best = t.i;
        }
      }
      return best;
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      pointerTravel = 0;
      velY = 0;
      velX = 0;
      lastPX = e.clientX;
      lastPY = e.clientY;
      lastMoveT = performance.now();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        // Hover: highlight the node under the cursor and tell the parent, so
        // the detail panel can preview without committing a selection.
        const { x, y } = toLocal(e);
        const hit = pick(x, y);
        if (hit !== hoverIdx) {
          hoverIdx = hit;
          canvas.style.cursor = hit === null ? "grab" : "pointer";
          const n = hit === null ? null : neurons[hit];
          viewRef.current.onHover?.(n && n.skill !== null ? SKILLS[n.skill].name : null);
        }
        return;
      }
      const now = performance.now();
      const dtEvent = Math.max(1, now - lastMoveT); // ms since last sample
      const dx = e.clientX - lastPX;
      const dy = e.clientY - lastPY;
      pointerTravel += Math.abs(dx) + Math.abs(dy);
      lastPX = e.clientX;
      lastPY = e.clientY;
      lastMoveT = now;
      const rotDX = dx * 0.009;
      const rotDY = -dy * 0.009;
      rotY += rotDX;
      rotX = clampPitch(rotX + rotDY);
      // Carry drag speed forward as release momentum, in true rad/ms so it
      // composes correctly with `rotY += velY * dt` once the loop takes over.
      velY = clampVel(rotDX / dtEvent);
      velX = clampVel(rotDY / dtEvent);
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      // A short press that barely moved is a click, not a flick: select the
      // node under it (or clear the selection when clicking empty space).
      if (pointerTravel < 6 && e.type === "pointerup") {
        const { x, y } = toLocal(e);
        const hit = pick(x, y);
        const n = hit === null ? null : neurons[hit];
        const name = n && n.skill !== null ? SKILLS[n.skill].name : null;
        viewRef.current.onSelect(name === viewRef.current.selected ? null : name);
        velY = 0;
        velX = 0;
        return;
      }
      if (reduceMotion) {
        // A user-driven drag is fine under reduced motion; an unrequested
        // glide afterwards isn't, so stop dead instead of coasting.
        velY = 0;
        velX = 0;
      }
    };

    const onPointerLeave = () => {
      if (hoverIdx !== null) {
        hoverIdx = null;
        viewRef.current.onHover?.(null);
      }
    };

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    // Rotate a model-space point by the current orbit and project it to
    // screen space with a simple perspective divide.
    const project = (x: number, y: number, z: number, w: number, h: number): Projected => {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const scale = CAM_DIST / (CAM_DIST - z2);
      const baseRadius = Math.min(w, h) * 0.585;
      return {
        sx: w / 2 + x1 * scale * baseRadius,
        sy: h / 2 - y2 * scale * baseRadius,
        scale,
        z2,
      };
    };

    const fireFrom = (idx: number, depth: number) => {
      // Always light the neuron itself, even at max depth. Only the
      // *spread* to further neurons is what needs to terminate.
      neurons[idx].charge = 1;
      if (depth >= MAX_CHAIN_DEPTH) return;
      if (pulses.length >= MAX_LIVE_PULSES) return;

      const options = adjacency[idx];
      if (!options.length) return;
      // Fan out along a couple of synapses to look like a propagating signal.
      const count = Math.min(options.length, 1 + Math.floor(rng() * 2));
      const shuffled = [...options].sort(() => rng() - 0.5).slice(0, count);
      shuffled.forEach((synIdx) => {
        if (pulses.length >= MAX_LIVE_PULSES) return;
        // depth + 1: the depth the destination neuron will be at once this
        // pulse arrives, which is what makes the chain actually terminate.
        pulses.push({
          synapse: synIdx,
          from: idx,
          progress: 0,
          speed: 0.012 + rng() * 0.016,
          depth: depth + 1,
        });
      });
    };

    let spawnTimer = 0;
    let last = performance.now();

    const draw = (now: number) => {
      if (!runningRef.current) return;
      const dt = Math.min(now - last, 48);
      last = now;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const { selected: selName, active: act } = viewRef.current;
      const selIdx = selName != null ? (neuronBySkillName.get(selName) ?? null) : null;
      const focusIdx = hoverIdx ?? selIdx;

      // Neurons one synapse away from the focused node stay bright while the
      // rest dim. That's the "what does this actually touch" read.
      const related = new Set<number>();
      if (focusIdx !== null) {
        related.add(focusIdx);
        adjacency[focusIdx].forEach((si) => {
          related.add(synapses[si].a);
          related.add(synapses[si].b);
        });
      }

      /** How visible a neuron should be, given filter + focus state. */
      const emphasis = (i: number): number => {
        const n = neurons[i];
        if (n.category && !act.has(n.category)) return 0.06;
        if (focusIdx === null) return 1;
        if (related.has(i)) return 1;
        return 0.16;
      };

      // Orbit motion: drag sets rotation directly; otherwise coast on
      // momentum (from a flick, or the idle drift) with friction.
      if (!dragging) {
        rotY += velY * dt;
        rotX = clampPitch(rotX + velX * dt);
        const friction = Math.pow(0.92, dt / 16);
        velY *= friction;
        velX *= friction;
        // Hold still while the user is reading a selected skill.
        const idle = !reduceMotion && focusIdx === null;
        if (idle && Math.abs(velY) < 0.00022) velY = 0.00022;
      }

      // Spontaneously fire a random neuron every so often, like background
      // cortical activity, rather than a single scripted animation loop.
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = reduceMotion ? 900 + rng() * 900 : 240 + rng() * 380;
        // Prefer firing inside the focused lobe when one is selected, so the
        // activity reinforces what the user is looking at.
        let idx = Math.floor(rng() * neurons.length);
        if (focusIdx !== null && rng() < 0.6) {
          const pool = [...related];
          idx = pool[Math.floor(rng() * pool.length)] ?? idx;
        }
        fireFrom(idx, 0);
      }

      for (let i = 0; i < synapseGlow.length; i++) {
        synapseGlow[i] = Math.max(0, synapseGlow[i] - dt * 0.002);
      }

      // Project every neuron once per frame; edges, pulses and hit testing
      // all reuse this.
      const projected: Projected[] = neurons.map((n) => project(n.x, n.y, n.z, w, h));

      hitTargets = [];
      neurons.forEach((n, i) => {
        if (n.skill === null) return;
        const p = projected[i];
        hitTargets.push({ i, sx: p.sx / dpr, sy: p.sy / dpr, scale: p.scale });
      });

      const travelling: Array<{ px: number; py: number; scale: number; alpha: number }> = [];
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += p.speed;
        const syn = synapses[p.synapse];
        synapseGlow[p.synapse] = 1;

        if (p.progress >= 1) {
          fireFrom(p.from === syn.a ? syn.b : syn.a, p.depth);
          pulses.splice(i, 1);
          continue;
        }

        if (!reduceMotion) {
          const from = neurons[p.from];
          const toIdx = p.from === syn.a ? syn.b : syn.a;
          const to = neurons[toIdx];
          const mx = from.x + (to.x - from.x) * p.progress;
          const my = from.y + (to.y - from.y) * p.progress;
          const mz = from.z + (to.z - from.z) * p.progress;
          const proj = project(mx, my, mz, w, h);
          travelling.push({
            px: proj.sx,
            py: proj.sy,
            scale: proj.scale,
            alpha: Math.min(emphasis(p.from), emphasis(toIdx)),
          });
        }
      }

      // Draw synapses, tinted toward their lobe's colour and brighter where a
      // signal is currently passing through.
      ctx.lineWidth = Math.max(1, dpr * 0.7);
      synapses.forEach((s, i) => {
        const a = projected[s.a];
        const b = projected[s.b];
        const em = Math.min(emphasis(s.a), emphasis(s.b));
        if (em < 0.08) return;
        const lit = synapseGlow[i];
        const cat = neurons[s.a].category ?? neurons[s.b].category;
        const rgb = cat ? CATEGORY_BY_ID[cat].rgb : [130, 130, 145];
        const base = s.bridge ? 0.04 : 0.06 + s.weight * 0.07;
        ctx.strokeStyle =
          lit > 0.01
            ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.12 + lit * 0.6) * em})`
            : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${base * em})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      });

      travelling.forEach(({ px, py, scale, alpha }) => {
        if (alpha < 0.08) return;
        const rad = 7 * dpr * scale;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, rad);
        glow.addColorStop(0, `rgba(255,240,214,${0.6 * alpha})`);
        glow.addColorStop(1, "rgba(255,240,214,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,248,235,${0.8 * alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 2 * dpr * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw neurons back-to-front so nearer ones correctly sit in front.
      const order = neurons.map((_, i) => i).sort((i, j) => projected[i].z2 - projected[j].z2);

      order.forEach((i) => {
        const n = neurons[i];
        const { sx: px, sy: py, scale } = projected[i];
        n.charge = Math.max(0, n.charge - dt * 0.0016);
        const em = emphasis(i);
        if (em < 0.05) return;
        const depthAlpha = Math.max(0.4, Math.min(1, (scale - 0.5) / 0.9)) * em;
        const isFocus = i === focusIdx;
        const r = (n.r + (reduceMotion ? 0 : n.charge * 3) + (isFocus ? 3 : 0)) * dpr * scale;
        const rgb = n.category ? CATEGORY_BY_ID[n.category].rgb : [205, 205, 218];

        if (n.charge > 0.05 || isFocus) {
          const strength = isFocus ? 1 : n.charge;
          const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3.2);
          glow.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.4 * strength * depthAlpha})`);
          glow.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = n.skill !== null
          ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.78 + n.charge * 0.22) * depthAlpha})`
          : `rgba(205,205,218,${(0.24 + n.charge * 0.45) * depthAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        if (isFocus) {
          ctx.strokeStyle = `rgba(255,255,255,${0.9 * em})`;
          ctx.lineWidth = 1.6 * dpr;
          ctx.beginPath();
          ctx.arc(px, py, r + 4 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = Math.max(1, dpr * 0.7);
        }
      });

      // Labels are placed in a separate pass, after every node is drawn, so a
      // declutter step can nudge apart any two that would otherwise land on
      // top of each other at this particular rotation.
      const labels = neurons
        .map((n, i) => ({ n, i }))
        .filter(({ n, i }) => n.skill !== null && emphasis(i) > 0.12)
        .map(({ n, i }) => {
          const { sx: px, sy: py, z2 } = projected[i];
          const isFocus = i === focusIdx;
          const size = (isFocus ? 15 : 12.5) * dpr;
          ctx.font = `${isFocus ? 800 : 700} ${size}px system-ui, sans-serif`;
          // Alternate above/below by index so neighbouring labels default to
          // opposite sides instead of stacking on each other.
          let above = i % 2 === 0;
          if (py < h * 0.14) above = false; // too close to the top edge
          if (py > h * 0.88) above = true; // too close to the bottom edge
          const ty = above ? py - 13 * dpr : py + 19 * dpr;
          // Nodes now reach much closer to the frame edge, so a centred label
          // could hang off it. Nudge it back inside rather than clipping.
          const halfWidth = ctx.measureText(SKILLS[n.skill as number].name).width / 2;
          const margin = halfWidth + 10 * dpr;
          const clampedX = Math.max(margin, Math.min(w - margin, px));
          return {
            text: SKILLS[n.skill as number].name,
            px: clampedX,
            ty,
            z2,
            size,
            isFocus,
            em: emphasis(i),
            rgb: n.category ? CATEGORY_BY_ID[n.category].rgb : ([255, 255, 255] as number[]),
            width: halfWidth * 2,
          };
        });

      // Relaxation: 52 labels at this density need more than one pass, and
      // a little horizontal give as well, or pairs sitting on the same
      // vertical line never separate however far they are pushed apart.
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i];
            const b = labels[j];
            const dx = Math.abs(a.px - b.px);
            const dy = Math.abs(a.ty - b.ty);
            const minDx = (a.width + b.width) / 2 + 8 * dpr;
            const minDy = 16 * dpr;
            if (dx >= minDx || dy >= minDy) continue;

            moved = true;
            const push = (minDy - dy) / 2 + 0.5;
            if (a.ty <= b.ty) {
              a.ty -= push;
              b.ty += push;
            } else {
              a.ty += push;
              b.ty -= push;
            }
            // Nudge sideways too, so a stubborn pair stops fighting purely
            // along one axis.
            const side = (minDx - dx) / 6;
            if (a.px <= b.px) {
              a.px -= side;
              b.px += side;
            } else {
              a.px += side;
              b.px -= side;
            }
          }
        }
        if (!moved) break;
      }

      // Draw back-to-front so a nearer label correctly sits above a farther one.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      labels.sort((a, b) => a.z2 - b.z2);
      labels.forEach(({ text, px, ty, z2, size, isFocus, em, rgb }) => {
        const depthAlpha =
          Math.max(0.4, Math.min(1, (CAM_DIST / (CAM_DIST - z2) - 0.5) / 0.9)) * em;
        ctx.font = `${isFocus ? 800 : 700} ${size}px system-ui, sans-serif`;
        ctx.lineWidth = 3.5 * dpr;
        ctx.strokeStyle = `rgba(10,10,12,${0.95 * depthAlpha})`;
        ctx.lineJoin = "round";
        ctx.strokeText(text, px, ty);
        ctx.fillStyle = isFocus
          ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0.85, depthAlpha)})`
          : `rgba(255,255,255,${Math.max(0.62, 0.95 * depthAlpha)})`;
        ctx.fillText(text, px, ty);
      });

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
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="skills-network" ref={containerRef}>
      <div className="skills-hint">
        <strong>Drag</strong> to orbit · <strong>click</strong> a node to inspect it
      </div>
      <canvas ref={canvasRef} aria-hidden="true" />

      {/* The canvas is decorative to assistive tech; this is the real content.
          It's visually hidden but focusable, so a keyboard user can walk the
          same skill list and drive the same selection the pointer does. */}
      <ul className="visually-hidden">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            {c.label}
            <ul>
              {SKILLS.filter((s) => s.category === c.id).map((s) => (
                <li key={s.name}>
                  {s.name}: {s.blurb}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
