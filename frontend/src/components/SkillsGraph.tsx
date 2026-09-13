import { useEffect, useRef } from "react";

const SKILLS = [
  "TypeScript", "React", "Node.js", "Express", "PostgreSQL", "Prisma",
  "Docker", "GitHub Actions", "REST APIs", "React Native", "Vitest",
  "Zod", "Vite", "ESLint", "Supertest", "Git",
];

interface Neuron {
  x: number; // model space, roughly -1..1
  y: number;
  z: number;
  label: string | null;
  r: number;
  charge: number; // current fire brightness 0..1
}

interface Synapse {
  a: number;
  b: number;
  weight: number;
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
const MAX_LIVE_PULSES = 60;

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

// Union of two overlapping ellipsoids (hemispheres) tapering into a brainstem —
// gives rejection-sampled points a recognizable 3D brain silhouette.
function insideBrain(x: number, y: number, z: number): boolean {
  const leftHemi = ((x + 0.32) / 0.52) ** 2 + ((y - 0.05) / 0.55) ** 2 + (z / 0.42) ** 2 <= 1;
  const rightHemi = ((x - 0.32) / 0.52) ** 2 + ((y - 0.05) / 0.55) ** 2 + (z / 0.42) ** 2 <= 1;
  const stem = Math.abs(x) < 0.14 && y < 0.05 && y > -0.55 && Math.abs(z) < 0.26;
  return leftHemi || rightHemi || stem;
}

function buildNetwork(rng: () => number): { neurons: Neuron[]; synapses: Synapse[] } {
  const neurons: Neuron[] = [];

  // Labeled skill neurons spread on a Fibonacci sphere — evenly distributed
  // points, so no two labels cluster together no matter how it's rotated —
  // then stretched onto the brain's proportions (wider than it is deep).
  const n = SKILLS.length;
  SKILLS.forEach((label, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    const ux = Math.sin(phi) * Math.cos(theta);
    const uy = Math.cos(phi);
    const uz = Math.sin(phi) * Math.sin(theta);
    neurons.push({ x: ux * 0.72, y: uy * 0.62 + 0.03, z: uz * 0.5, label, r: 6, charge: 0 });
  });

  // Decorative unlabeled neurons filling the rest of the volume for texture.
  let attempts = 0;
  while (neurons.length < SKILLS.length + 70 && attempts < 8000) {
    attempts++;
    const x = (rng() * 2 - 1) * 0.95;
    const y = (rng() * 2 - 1) * 0.75 + 0.05;
    const z = (rng() * 2 - 1) * 0.55;
    if (!insideBrain(x, y, z)) continue;
    neurons.push({ x, y, z, label: null, r: 1.5 + rng() * 1.5, charge: 0 });
  }

  // Connect each neuron to its nearest neighbors — a simple k-NN synapse mesh.
  const synapses: Synapse[] = [];
  const seen = new Set<string>();
  neurons.forEach((n, i) => {
    const dists = neurons
      .map((m, j) => ({
        j,
        d: i === j ? Infinity : (m.x - n.x) ** 2 + (m.y - n.y) ** 2 + (m.z - n.z) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n.label ? 4 : 3);

    dists.forEach(({ j, d }) => {
      if (d > 0.14) return;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      synapses.push({ a: i, b: j, weight: 0.4 + rng() * 0.6 });
    });
  });

  return { neurons, synapses };
}

interface Projected {
  sx: number;
  sy: number;
  scale: number; // perspective size/brightness multiplier, ~0.55..1.6
  z2: number; // view-space depth, for back-to-front sorting
}

const CAM_DIST = 2.4;

export function SkillsGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

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

    const pulses: Pulse[] = [];
    const synapseGlow = new Array<number>(synapses.length).fill(0);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // --- Orbit state: yaw/pitch + drag with momentum -----------------------
    let rotY = 0.4;
    let rotX = -0.15;
    // velY/velX are angular velocity in radians PER MILLISECOND, matching
    // the `rotY += velY * dt` below — mixing this up with an un-normalized
    // per-pointer-event pixel delta is what caused runaway spin (pointer
    // events don't reliably arrive once per frame, so a raw per-event delta
    // reused as a per-ms rate could be off by 10-100x depending on timing).
    const MAX_ANGULAR_VEL = 0.0035;
    let velY = reduceMotion ? 0 : 0.00025; // gentle idle drift when untouched
    let velX = 0;
    let dragging = false;
    let lastPX = 0;
    let lastPY = 0;
    let lastMoveT = 0;

    const clampPitch = (v: number) => Math.max(-0.62, Math.min(0.62, v));
    const clampVel = (v: number) => Math.max(-MAX_ANGULAR_VEL, Math.min(MAX_ANGULAR_VEL, v));

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      velY = 0;
      velX = 0;
      lastPX = e.clientX;
      lastPY = e.clientY;
      lastMoveT = performance.now();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dtEvent = Math.max(1, now - lastMoveT); // ms since last sample
      const dx = e.clientX - lastPX;
      const dy = e.clientY - lastPY;
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
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      if (reduceMotion) {
        // A user-driven drag is fine under reduced motion; an unrequested
        // glide afterwards isn't, so stop dead instead of coasting.
        velY = 0;
        velX = 0;
      }
    };

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", endDrag);

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
      const baseRadius = Math.min(w, h) * 0.47;
      return {
        sx: w / 2 + x1 * scale * baseRadius,
        sy: h / 2 - y2 * scale * baseRadius,
        scale,
        z2,
      };
    };

    const fireFrom = (idx: number, depth: number) => {
      // Always light the neuron itself, even at max depth — only the
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
        // pulse arrives — this is what makes the chain actually terminate.
        pulses.push({ synapse: synIdx, from: idx, progress: 0, speed: 0.012 + rng() * 0.016, depth: depth + 1 });
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

      // Orbit motion: drag sets rotation directly; otherwise coast on
      // momentum (from a flick, or the idle drift) with friction.
      if (!dragging) {
        rotY += velY * dt;
        rotX = clampPitch(rotX + velX * dt);
        const friction = Math.pow(0.92, dt / 16);
        velY *= friction;
        velX *= friction;
        if (!reduceMotion && Math.abs(velY) < 0.00025) velY = 0.00025; // never fully stalls
      }

      // Spontaneously fire a random neuron every so often, like background
      // cortical activity, rather than a single scripted animation loop.
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = reduceMotion ? 900 + rng() * 900 : 260 + rng() * 420;
        const idx = Math.floor(rng() * neurons.length);
        fireFrom(idx, 0);
      }

      for (let i = 0; i < synapseGlow.length; i++) {
        synapseGlow[i] = Math.max(0, synapseGlow[i] - dt * 0.002);
      }

      // Project every neuron once per frame; edges and pulses reuse this.
      const projected: Projected[] = neurons.map((n) => project(n.x, n.y, n.z, w, h));

      const travelling: Array<{ px: number; py: number; scale: number }> = [];
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
          travelling.push({ px: proj.sx, py: proj.sy, scale: proj.scale });
        }
      }

      // Draw synapses, brighter where a signal is currently passing through.
      ctx.lineWidth = Math.max(1, dpr * 0.7);
      synapses.forEach((s, i) => {
        const a = projected[s.a];
        const b = projected[s.b];
        const lit = synapseGlow[i];
        ctx.strokeStyle =
          lit > 0.01
            ? `rgba(140,220,255,${0.08 + lit * 0.55})`
            : `rgba(120,170,255,${0.05 + s.weight * 0.06})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      });

      travelling.forEach(({ px, py, scale }) => {
        const rad = 10 * dpr * scale;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, rad);
        glow.addColorStop(0, "rgba(120,220,255,0.95)");
        glow.addColorStop(1, "rgba(120,220,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.95)";
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
        const depthAlpha = Math.max(0.4, Math.min(1, (scale - 0.5) / 0.9));
        const r = (n.r + (reduceMotion ? 0 : n.charge * 3)) * dpr * scale;

        if (n.charge > 0.05) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
          glow.addColorStop(0, `rgba(167,139,250,${0.35 * n.charge * depthAlpha})`);
          glow.addColorStop(1, "rgba(167,139,250,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = n.label
          ? `rgba(78,242,255,${(0.75 + n.charge * 0.25) * depthAlpha})`
          : `rgba(200,215,255,${(0.28 + n.charge * 0.5) * depthAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Labels are placed in a separate pass, after every node is drawn, so
      // a declutter step can nudge apart any two that would otherwise land
      // on top of each other at this particular rotation.
      ctx.font = `700 ${13 * dpr}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const labels = neurons
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.label)
        .map(({ n, i }) => {
          const { sx: px, sy: py, z2 } = projected[i];
          // Alternate above/below by index so neighbouring labels default to
          // opposite sides — the actual bug wasn't "clipping", it was that
          // everyone defaulted to the same side and stacked on each other.
          let above = i % 2 === 0;
          if (py < h * 0.16) above = false; // too close to the top edge — must go below
          if (py > h * 0.86) above = true; // too close to the bottom edge — must go above
          const ty = above ? py - 13 * dpr : py + 19 * dpr;
          return { text: n.label as string, px, ty, z2, width: ctx.measureText(n.label as string).width };
        });

      // One relaxation pass: push apart any two labels whose boxes overlap.
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i];
          const b = labels[j];
          const dx = Math.abs(a.px - b.px);
          const dy = Math.abs(a.ty - b.ty);
          const minDx = (a.width + b.width) / 2 + 10 * dpr;
          const minDy = 15 * dpr;
          if (dx < minDx && dy < minDy) {
            const push = (minDy - dy) / 2 + 1;
            if (a.ty <= b.ty) {
              a.ty -= push;
              b.ty += push;
            } else {
              a.ty += push;
              b.ty -= push;
            }
          }
        }
      }

      // Draw back-to-front so a nearer label correctly sits above a farther one.
      labels.sort((a, b) => a.z2 - b.z2);
      labels.forEach(({ text, px, ty, z2 }) => {
        const depthAlpha = Math.max(0.4, Math.min(1, (CAM_DIST / (CAM_DIST - z2) - 0.5) / 0.9));
        ctx.lineWidth = 3.5 * dpr;
        ctx.strokeStyle = `rgba(5,6,14,${0.9 * depthAlpha})`;
        ctx.lineJoin = "round";
        ctx.strokeText(text, px, ty);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.7, 0.98 * depthAlpha)})`;
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
      { threshold: 0.1 }
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
      canvas.removeEventListener("pointerleave", endDrag);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="skills-network" ref={containerRef}>
      <div className="skills-label">Drag to rotate — skill synapse map</div>
      <canvas ref={canvasRef} aria-hidden="true" />
      {/* Visually-hidden but real DOM text so screen readers and search
          engines see the actual skill list, not just canvas pixels. */}
      <ul className="visually-hidden">
        {SKILLS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
