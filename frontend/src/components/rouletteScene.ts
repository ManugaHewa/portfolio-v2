import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  NearestFilter,
  Object3D,
  OctahedronGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { makeTracker } from "../lib/threeScene";
import type { SceneDef } from "../lib/threeScene";
import { scaled } from "../lib/sceneQuality";
import { readScrollVelocity, watchScrollVelocity } from "../lib/scrollVelocity";
import {
  BALL_R,
  BOWL_PROFILE,
  DIAMONDS,
  DIAMOND_R,
  HEAD_PROFILE,
  NUMBERS_R,
  POCKET,
  POCKETS,
  POCKETS_R,
  WHEEL,
  ballPose,
  newBall,
  pocketInk,
  stepBall,
  surfaceAt,
} from "../lib/roulette";
import type { PocketInk } from "../lib/roulette";

/*
 * The wheel's inks. The page's two accents stand in for the felt's red and
 * green: ember for the red numbers, sky for the zero, the near-black ink for
 * the black ones, and steel for the metalwork.
 */
const INK: Record<PocketInk, string> = { red: "#e98e49", black: "#16181c", zero: "#6ab9e7" };
const POCKET_INK: Record<PocketInk, string> = { red: "#5a3418", black: "#0c0d0f", zero: "#24485c" };
const NUMERAL = "#f6f4ef";
const STEEL = "#c4c9cf";
const IVORY = "#f6f3ec";

// The bowl and the head, one colour per point of their cross-sections
// (lib/roulette.ts): darker where a surface faces away, lighter on the rims
// and on the ball track, so the eye reads the shape without a texture.
const BOWL_INKS = [
  "#0b0c0e",
  "#17191c",
  "#2c3035",
  "#33373c",
  "#2a2e33",
  "#1b1e22",
  "#1c1f23",
  "#24282c",
  "#16181b",
  "#0f1113",
  "#0b0c0e",
];
const HEAD_INKS = [
  "#0b0c0e",
  "#2c3035",
  "#1a1d21",
  "#0d0e10",
  "#0d0e10",
  "#1e2125",
  "#191b1f",
  "#1e2125",
  "#24272b",
  "#2a2d31",
  "#2e3135",
];

/** Height of the camera above the wheel's plane, in degrees. */
const ELEVATION = 64;

/**
 * Hero: a roulette wheel. The bowl stands still, with its ball track and
 * eight diamonds; the wheel head turns in it, its numbers in wheel order
 * round the rim, frets between the pockets, a cone and a four-armed turret
 * in the middle. A ball is thrown round the track against the head's turn,
 * slows, leaves the wall, runs down the slope (knocked up by a diamond if it
 * meets one), skips across the frets and settles in a pocket, rides there a
 * few seconds, and is picked out and thrown again (lib/roulette.ts runs it).
 *
 * Scrolling spins the head up (lib/scrollVelocity.ts); a mouse in the hero
 * tilts the table a few degrees toward it. On first appearing the head spins
 * up from rest and the first ball is thrown. Never under reduced motion (no
 * scene runs then: the hero shows its still).
 */
export function rouletteScene(detail: number): SceneDef {
  const t = makeTracker();
  const ROUND = scaled(192, detail, 112);
  return {
    fov: 30,
    dispose: t.disposeAll,
    setup: ({ scene, camera, renderer }) => {
      const e = (ELEVATION * Math.PI) / 180;
      // Far enough that the bowl spans about 95% of the stage (Hero.tsx, WHEEL_SPAN).
      const distance = 7.2;
      camera.position.set(0, distance * Math.sin(e), distance * Math.cos(e));
      camera.lookAt(0, -0.02, 0);
      scene.fog = new Fog(new Color("#08090b"), 7.2, 12);

      // A cool key light from the upper left and a warm one low on the
      // right: the rims catch one, the turret and the ball both.
      scene.add(new AmbientLight(0xffffff, 0.55));
      const key = new DirectionalLight(0xeef5ff, 1.25);
      key.position.set(-2.5, 6, 3.5);
      scene.add(key);
      const fill = new DirectionalLight(0xffd9b8, 0.35);
      fill.position.set(3, 2.5, -2.5);
      scene.add(fill);

      const steel = t.track(new MeshPhongMaterial({ color: new Color(STEEL), specular: 0xffffff, shininess: 90 }));

      const table = new Group();
      scene.add(table);

      // The bowl.
      table.add(
        new Mesh(t.track(lathe(BOWL_PROFILE, BOWL_INKS, ROUND)), t.track(new MeshLambertMaterial({ vertexColors: true }))),
      );

      // Fine steel lines where the rim meets the wall, round the inside of the
      // ball track, and round the head's rim: they draw each edge crisply
      // where the soft shading alone would blur it.
      const line = t.track(new MeshLambertMaterial({ color: new Color("#80868d") }));
      for (const [r, y, tube] of [
        [1.655, 0.21, 0.006],
        [1.46, 0.075, 0.005],
      ] as const) {
        const edge = new Mesh(t.track(new TorusGeometry(r, tube, 6, ROUND)), line);
        edge.rotation.x = Math.PI / 2;
        edge.position.y = y;
        table.add(edge);
      }

      // The diamonds: on the slope, lying along it, upright and crosswise in
      // turn, in a duller steel than the turret so they read as fittings, not
      // as glints.
      const diamond = t.track(new OctahedronGeometry(1, 0));
      const fitting = t.track(new MeshPhongMaterial({ color: new Color("#8d939a"), specular: 0x555555, shininess: 40 }));
      const slope = surfaceAt(DIAMOND_R);
      for (let k = 0; k < DIAMONDS; k++) {
        const a = (k / DIAMONDS) * Math.PI * 2;
        const at = new Group();
        at.position.set(DIAMOND_R * Math.cos(a), slope.y + 0.012, DIAMOND_R * Math.sin(a));
        at.rotation.y = -a;
        const tilt = new Group();
        tilt.rotation.z = Math.atan(slope.slope);
        const gem = new Mesh(diamond, fitting);
        gem.scale.set(0.065, 0.018, 0.026);
        if (k % 2 === 1) gem.rotation.y = Math.PI / 2;
        tilt.add(gem);
        at.add(tilt);
        table.add(at);
      }

      // The wheel head, turning.
      const head = new Group();
      table.add(head);
      head.add(
        new Mesh(
          t.track(lathe(HEAD_PROFILE, HEAD_INKS, ROUND)),
          t.track(new MeshPhongMaterial({ vertexColors: true, specular: 0x222222, shininess: 30 })),
        ),
      );

      // The number ring, lying on the head's rim, and the pockets' floors in
      // a darker shade of each pocket's colour.
      const numbers = numbersTexture(renderer.capabilities.getMaxAnisotropy());
      if (numbers) {
        t.track(numbers.texture);
        head.add(
          new Mesh(
            t.track(ring(NUMBERS_R[0], -0.03 + 0.002, NUMBERS_R[1], -0.01 + 0.002, POCKETS * 8)),
            t.track(
              new MeshLambertMaterial({ map: numbers.texture, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
            ),
          ),
        );
      }
      const floors = floorsTexture();
      if (floors) {
        t.track(floors);
        head.add(
          new Mesh(
            t.track(ring(POCKETS_R[0], -0.07 + 0.001, POCKETS_R[1], -0.07 + 0.001, POCKETS * 4)),
            t.track(new MeshLambertMaterial({ map: floors, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
          ),
        );
      }

      // The frets between the pockets.
      const fretLength = POCKETS_R[1] - POCKETS_R[0];
      const frets = new InstancedMesh(t.track(new BoxGeometry(fretLength, 0.042, 0.012)), steel, POCKETS);
      const place = new Object3D();
      for (let i = 0; i < POCKETS; i++) {
        const a = i * POCKET;
        const mid = (POCKETS_R[0] + POCKETS_R[1]) / 2;
        place.position.set(mid * Math.cos(a), -0.07 + 0.021, mid * Math.sin(a));
        place.rotation.set(0, -a, 0);
        place.updateMatrix();
        frets.setMatrixAt(i, place.matrix);
      }
      head.add(frets);
      const rim = new Mesh(t.track(new TorusGeometry(1.27, 0.007, 6, ROUND)), line);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.01;
      head.add(rim);

      // An ember inlay round the cone.
      const inlay = new Mesh(
        t.track(new TorusGeometry(0.6, 0.006, 6, ROUND)),
        t.track(new MeshLambertMaterial({ color: new Color(INK.red), emissive: new Color(INK.red).multiplyScalar(0.25) })),
      );
      inlay.rotation.x = Math.PI / 2;
      inlay.position.y = 0.067;
      head.add(inlay);

      // The turret: a stem, a collar, four arms with a knob on each, a finial.
      const turret = new Group();
      const SIDES = scaled(18, detail, 10);
      const stem = new Mesh(t.track(new CylinderGeometry(0.038, 0.05, 0.28, SIDES)), steel);
      stem.position.y = 0.178 + 0.14;
      const collar = new Mesh(t.track(new CylinderGeometry(0.1, 0.11, 0.03, SIDES * 2)), steel);
      collar.position.y = 0.19;
      turret.add(stem, collar);
      const arm = t.track(new CylinderGeometry(0.015, 0.015, 0.68, SIDES));
      const knob = t.track(new SphereGeometry(0.034, SIDES, SIDES));
      for (const across of [0, 1]) {
        const bar = new Mesh(arm, steel);
        bar.position.y = 0.37;
        if (across) bar.rotation.x = Math.PI / 2;
        else bar.rotation.z = Math.PI / 2;
        turret.add(bar);
        for (const s of [-1, 1]) {
          const k = new Mesh(knob, steel);
          k.position.set(across ? 0 : s * 0.34, 0.37, across ? s * 0.34 : 0);
          turret.add(k);
        }
      }
      const finial = new Mesh(t.track(new SphereGeometry(0.05, SIDES, SIDES)), steel);
      finial.position.y = 0.47;
      turret.add(finial);
      head.add(turret);

      // The ball, and the soft dark spot under it that keeps it on the wheel.
      const ball = new Mesh(
        t.track(new SphereGeometry(BALL_R, 24, 16)),
        t.track(new MeshPhongMaterial({ color: new Color(IVORY), specular: 0xffffff, shininess: 120 })),
      );
      table.add(ball);
      const spot = softSpot();
      const shadowInk = t.track(
        new MeshBasicMaterial({
          color: 0x000000,
          map: spot ? t.track(spot) : null,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      const shadow = new Mesh(t.track(new CircleGeometry(BALL_R * 1.7, 24)), shadowInk);
      table.add(shadow);

      // The table leans a few degrees toward a mouse anywhere in the hero.
      const lean = { x: 0, y: 0, tx: 0, ty: 0 };
      const area = renderer.domElement.closest("section, .hero");
      const mouse = window.matchMedia?.("(pointer: fine) and (hover: hover)").matches ?? false;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerType !== "mouse" || !area) return;
        const r = area.getBoundingClientRect();
        lean.ty = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
        lean.tx = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
      };
      const onLeave = () => {
        lean.tx = 0;
        lean.ty = 0;
      };
      if (area && mouse) {
        area.addEventListener("pointermove", onMove as EventListener);
        area.addEventListener("pointerleave", onLeave);
        t.track({
          dispose: () => {
            area.removeEventListener("pointermove", onMove as EventListener);
            area.removeEventListener("pointerleave", onLeave);
          },
        });
      }
      t.track({ dispose: watchScrollVelocity() });

      let wheel = 0;
      let boost = 0;
      let run = newBall(0.6);
      const up = new Vector3();
      const FACE = new Vector3(0, 0, 1);

      return (time, dt) => {
        // A push from the page: spins up quickly, runs down slowly.
        const target = Math.min(1, Math.abs(readScrollVelocity()) / 2400);
        boost += (target - boost) * (1 - Math.exp(-dt * (target > boost ? 5 : 1.2)));
        // From rest when it first appears, to about a turn every twelve
        // seconds, and up to two a second on a fast scroll.
        const spinUp = 1 - (1 - Math.min(1, time / 1.8)) ** 3;
        const speed = (0.52 + 2.6 * boost) * spinUp;
        wheel += speed * dt;
        head.rotation.y = -wheel;

        run = stepBall(run, dt, { angle: wheel, speed });
        const p = ballPose(run, wheel, speed);
        const x = p.r * Math.cos(p.angle);
        const z = p.r * Math.sin(p.angle);
        ball.visible = p.scale > 0.001;
        ball.position.set(x, p.y, z);
        // Fast, the ball draws out along its path, as the eye sees it.
        const blur = 1 + Math.min(2, ((Math.abs(p.speed) * p.r) / 60 / (2 * BALL_R)) * 0.5);
        ball.scale.set(p.scale * blur, p.scale, p.scale);
        ball.rotation.y = -(p.angle + Math.PI / 2);

        const ground = surfaceAt(p.r);
        shadow.visible = ball.visible;
        shadow.position.set(x, ground.y, z);
        up.set(-ground.slope * Math.cos(p.angle), 1, -ground.slope * Math.sin(p.angle)).normalize();
        shadow.quaternion.setFromUnitVectors(FACE, up);
        const spread = 1 + p.air * 6;
        shadow.scale.set(Math.max(0.001, p.scale) * spread * (0.6 + 0.4 * blur), Math.max(0.001, p.scale) * spread, 1);
        shadowInk.opacity = (0.6 * p.scale) / spread;

        const k = 1 - Math.exp(-dt * 4);
        lean.x += (lean.tx - lean.x) * k;
        lean.y += (lean.ty - lean.y) * k;
        table.rotation.x = lean.x * 0.07;
        table.rotation.z = -lean.y * 0.07;
      };
    },
  };
}

/** A lathe from a cross-section, coloured point by point. */
function lathe(profile: ReadonlyArray<readonly [number, number]>, inks: string[], segments: number): BufferGeometry {
  const geo = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
  const colours: number[] = [];
  const c = new Color();
  // Three lays the vertices out a meridian at a time, point by point.
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j < profile.length; j++) {
      c.set(inks[j] ?? inks[inks.length - 1]);
      colours.push(c.r, c.g, c.b);
    }
  }
  geo.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return geo;
}

/**
 * A flat ring facing up, from (r0, y0) to (r1, y1) in cross-section, mapped
 * so a texture runs once round it (u) and across it from the inside out (v).
 * Its angle runs the same way as lib/roulette.ts's, so pocket i of a texture
 * lies over pocket i of the wheel.
 */
function ring(r0: number, y0: number, r1: number, y1: number, segments: number): BufferGeometry {
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    position.push(r0 * c, y0, r0 * s, r1 * c, y1, r1 * s);
    uv.push(i / segments, 0, i / segments, 1);
  }
  for (let i = 0; i < segments; i++) {
    const inner = i * 2;
    // Inner, next inner, outer; then outer, next inner, next outer: both face up.
    index.push(inner, inner + 2, inner + 1, inner + 1, inner + 2, inner + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(position, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * The numbers, one cell a pocket in wheel order, each upright with its top
 * toward the rim, in the page's mono face. Cells are as wide as they are on
 * the ring (86 by 64 maps onto about 0.2 by 0.15 units), so the digits are
 * not stretched. Drawn again once the web font has loaded.
 */
function numbersTexture(anisotropy: number): { texture: CanvasTexture } | null {
  const cell = 86;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = cell * POCKETS;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
  const font = `600 31px ${family}`;
  const draw = () => {
    WHEEL.forEach((n, i) => {
      g.fillStyle = INK[pocketInk(n)];
      g.fillRect(i * cell, 0, cell, height);
      g.fillStyle = NUMERAL;
      g.font = font;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(n), i * cell + cell / 2, height / 2 + 1);
    });
    // A hairline between each number and the next.
    g.fillStyle = "rgba(8, 9, 11, 0.6)";
    for (let i = 0; i <= POCKETS; i++) g.fillRect(i * cell - 1, 0, 2, height);
  };
  draw();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(8, anisotropy);
  document.fonts
    ?.load(font)
    .then(() => {
      draw();
      texture.needsUpdate = true;
    })
    .catch(() => {});
  return { texture };
}

/** The pockets' floors: one texel a pocket, unfiltered, so each edge is sharp under its fret. */
function floorsTexture(): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = POCKETS;
  canvas.height = 1;
  const g = canvas.getContext("2d");
  if (!g) return null;
  WHEEL.forEach((n, i) => {
    g.fillStyle = POCKET_INK[pocketInk(n)];
    g.fillRect(i, 0, 1, 1);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** A soft round spot, dark in the middle and gone at the edge. */
function softSpot(): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}
