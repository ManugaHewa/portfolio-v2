import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import { mountScene } from "../lib/threeScene";
import type { SceneDef } from "../lib/threeScene";

export type SceneVariant =
  | "core"
  | "corridor"
  | "globe"
  | "field"
  | "starfield"
  | "signal";

const SKY = "#6ab9e7";
const EMBER = "#e98e49";

/**
 * Every WebGL scene on the site, behind one lazy import.
 *
 * Deliberately one module rather than a component per scene: each would
 * otherwise pull Three into its own chunk, and the library is roughly the
 * size of the entire rest of the bundle. One entry point means one shared
 * chunk, fetched once, reused by all four.
 */
export default function Scene3D({
  variant,
  className,
}: {
  variant: SceneVariant;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return mountScene(el, BUILDERS[variant]());
  }, [variant]);

  return <div className={`scene-3d ${className ?? ""}`} ref={ref} aria-hidden="true" />;
}

/** Collects anything holding GPU memory so teardown is not hand-maintained. */
function makeTracker() {
  const bag: Array<{ dispose: () => void }> = [];
  return {
    bag,
    track<T extends { dispose: () => void }>(x: T): T {
      bag.push(x);
      return x;
    },
    disposeAll() {
      bag.forEach((d) => d.dispose());
      bag.length = 0;
    },
  };
}

const BUILDERS: Record<SceneVariant, () => SceneDef> = {
  /* ---------------------------------------------------------------
     Hero: a gyroscope core. Three nested rings on orthogonal axes,
     each turning at its own rate, with a shell of particles orbiting
     outside them. Reads as a precision instrument rather than a radar,
     and the differing rates mean the silhouette never repeats.
  --------------------------------------------------------------- */
  core: () => {
    const t = makeTracker();
    const R_CORE = 0.88;
    return {
      fov: 42,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 0.5, 4.95);
        camera.lookAt(0, 0, 0);

        /**
         * The core is a real sphere in the scene rather than an HTML disc
         * layered over the canvas. That is the whole point: an HTML element
         * always paints on top, so the rings could only ever pass *behind*
         * it and the middle read as a flat circle. An opaque, depth-writing
         * mesh lets the depth buffer decide - the half of each ring nearer
         * the camera draws over the sphere, the far half is occluded - and
         * that occlusion is what makes it read as a ball with depth.
         */
        const core = new Group();
        scene.add(core);

        const body = new Mesh(
          t.track(new SphereGeometry(R_CORE, 48, 32)),
          t.track(new MeshBasicMaterial({ color: new Color("#0f171b") }))
        );
        core.add(body);

        // Latitude and longitude on the surface itself. Lines that converge
        // at the poles and crowd toward the silhouette are the cheapest
        // unambiguous cue that a disc is actually a sphere; the far side is
        // hidden by the body above, so only the near half is ever drawn.
        const grid = new LineSegments(
          t.track(sphereGridGeometry(R_CORE * 1.004, 7, 12)),
          t.track(
            new LineBasicMaterial({
              color: new Color(SKY),
              transparent: true,
              opacity: 0.16,
              depthWrite: false,
            })
          )
        );
        core.add(grid);

        // Limb glow: a slightly larger sphere drawn from the inside, so only
        // the rim survives. Gives the silhouette a lit edge instead of a
        // hard cut against the card.
        const limb = new Mesh(
          t.track(new SphereGeometry(R_CORE * 1.022, 48, 32)),
          t.track(
            new MeshBasicMaterial({
              color: new Color(EMBER),
              transparent: true,
              opacity: 0.22,
              side: BackSide,
              blending: AdditiveBlending,
              depthWrite: false,
            })
          )
        );
        core.add(limb);

        // "MH" painted into a texture and hung on the front of the sphere,
        // square to the camera. It sits just proud of the surface, so the
        // body never z-fights it and the front arcs of the rings still pass
        // over it the way they pass over the rest of the ball.
        const label = document.createElement("canvas");
        label.width = 512;
        label.height = 512;
        const lx = label.getContext("2d");
        if (lx) {
          lx.clearRect(0, 0, 512, 512);
          lx.fillStyle = EMBER;
          lx.textAlign = "center";
          lx.textBaseline = "middle";
          lx.font = "800 132px system-ui, -apple-system, Segoe UI, sans-serif";
          lx.fillText("M", 196, 260);
          lx.fillText("H", 316, 260);
        }
        const tex = t.track(new CanvasTexture(label));
        // Without this the canvas is read as linear and the ember washes out
        // to cream on the way through the sRGB output transform.
        tex.colorSpace = SRGBColorSpace;
        const plate = new Mesh(
          t.track(new PlaneGeometry(1.18, 1.18)),
          t.track(new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
        );
        // On the camera-facing point of the sphere, turned to square up with
        // the slight elevation the camera sits at.
        plate.position.set(0, 0.091, 0.9);
        plate.rotation.x = -0.101;
        scene.add(plate);

        const world = new Group();
        scene.add(world);
        // A fixed viewing tilt. Three orthogonal gimbals cannot all be
        // edge-on at once, but seen dead-on the assembly still passes
        // through poses where two of them collapse to near-flat lines. A
        // standing tilt means there is always at least one open ellipse.
        world.rotation.x = -0.34;
        world.rotation.y = 0.22;

        // A real gyroscope is nested, not three siblings spinning side by
        // side: each gimbal is a child of the one outside it, so the inner
        // rings inherit every rotation above them and the assembly tumbles
        // the way a gimballed instrument actually does.
        const outer = new Group(); // lateral, spins on Y
        const middle = new Group(); // longitudinal, spins on X
        const inner = new Group(); // third axis, spins on Z
        outer.add(middle);
        middle.add(inner);
        world.add(outer);

        const ring = (
          radius: number,
          host: Group,
          colour: string,
          opacity: number,
          tilt: [number, number, number]
        ) => {
          const mat = t.track(
            new LineBasicMaterial({
              color: new Color(colour),
              transparent: true,
              opacity,
              // Depth *test* stays on so the sphere occludes the far arc;
              // depth *write* goes off so the rings do not clip each other.
              depthWrite: false,
            })
          );
          const seg = new LineSegments(t.track(ringsGeometry([radius], 132)), mat);
          seg.rotation.set(tilt[0], tilt[1], tilt[2]);
          host.add(seg);
          return seg;
        };

        // Lateral (equatorial) and longitudinal (meridian) rings.
        ring(1.62, outer, SKY, 0.62, [0, 0, 0]);
        ring(1.34, middle, EMBER, 0.78, [Math.PI / 2, 0, 0]);
        ring(1.12, inner, SKY, 0.58, [0, 0, Math.PI / 2]);

        /**
         * Electrons. Each rides its own ring, parented to the gimbal that
         * ring belongs to, so it inherits every rotation above it - that
         * inheritance is what makes the motion read as one instrument
         * rather than loose dots on independent paths. Each carries a short
         * tail of fading dots along the ring behind it, which is what gives
         * the movement a direction you can actually see.
         */
        const electrons: Array<{ g: Group; rate: number; phase: number }> = [];
        const TAIL = 7;
        const addElectrons = (
          host: Group,
          r: number,
          rate: number,
          colour: string,
          count: number,
          size: number,
          orient: (g: Group) => void
        ) => {
          const col = new Color(colour);
          // A point at local angle a lands at a + rotation.y once the gimbal
          // turns, so the tail belongs at *negative* a for a rising angle -
          // and on the other side when the ring runs backwards.
          const dir = rate >= 0 ? 1 : -1;
          for (let k = 0; k < count; k++) {
            const spin = new Group();

            const headGeo = t.track(new BufferGeometry());
            headGeo.setAttribute("position", new Float32BufferAttribute([r, 0, 0], 3));
            spin.add(
              new Points(
                headGeo,
                t.track(
                  new PointsMaterial({
                    color: col,
                    size,
                    transparent: true,
                    opacity: 1,
                    blending: AdditiveBlending,
                    depthWrite: false,
                  })
                )
              )
            );

            const tailPos: number[] = [];
            const tailCol: number[] = [];
            for (let j = 1; j <= TAIL; j++) {
              const a = j * 0.062;
              tailPos.push(r * Math.cos(a), 0, dir * r * Math.sin(a));
              const f = (1 - j / (TAIL + 1)) ** 1.7;
              tailCol.push(col.r * f, col.g * f, col.b * f);
            }
            const tailGeo = t.track(new BufferGeometry());
            tailGeo.setAttribute("position", new Float32BufferAttribute(tailPos, 3));
            tailGeo.setAttribute("color", new Float32BufferAttribute(tailCol, 3));
            spin.add(
              new Points(
                tailGeo,
                t.track(
                  new PointsMaterial({
                    size: size * 0.62,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.9,
                    blending: AdditiveBlending,
                    depthWrite: false,
                  })
                )
              )
            );

            // The spinning group only ever turns on its own Y. Tilting it
            // into the ring plane has to happen on a parent, or the tilt
            // would be overwritten by the animation every frame.
            const plane = new Group();
            plane.add(spin);
            orient(plane);
            host.add(plane);
            electrons.push({ g: spin, rate, phase: (k / count) * Math.PI * 2 });
          }
        };

        const flat = () => {};
        addElectrons(outer, 1.62, 0.62, EMBER, 3, 0.17, flat);
        addElectrons(middle, 1.34, -0.85, SKY, 3, 0.15, (g) => {
          g.rotation.x = Math.PI / 2;
        });
        addElectrons(inner, 1.12, 1.15, EMBER, 2, 0.13, (g) => {
          g.rotation.z = Math.PI / 2;
        });

        // A faint atmosphere so the core sits in something.
        const haloPts: number[] = [];
        const N = 90;
        for (let i = 0; i < N; i++) {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
          const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
          const r = 1.9 + ((i % 4) / 4) * 0.18;
          haloPts.push(
            Math.sin(phi) * Math.cos(theta) * r,
            Math.cos(phi) * r * 0.8,
            Math.sin(phi) * Math.sin(theta) * r
          );
        }
        const haloGeo = t.track(new BufferGeometry());
        haloGeo.setAttribute("position", new Float32BufferAttribute(haloPts, 3));
        const halo = new Points(
          haloGeo,
          t.track(
            new PointsMaterial({
              color: new Color(SKY),
              size: 0.045,
              transparent: true,
              opacity: 0.55,
              blending: AdditiveBlending,
              depthWrite: false,
            })
          )
        );
        world.add(halo);

        return (time) => {
          // Each gimbal turns on its own axis; because they are nested the
          // inner ones are carried by the outer ones as well.
          outer.rotation.y = time * 0.5;
          middle.rotation.x = time * 0.7;
          inner.rotation.z = time * 0.95;

          // Electrons sweep their own ring on top of the inherited motion.
          electrons.forEach((e) => {
            e.g.rotation.y = time * e.rate + e.phase;
          });

          // The core turns on its own, slowly, so the surface grid reads as
          // a rotating body and not a static decal.
          grid.rotation.y = time * 0.11;
          body.rotation.y = time * 0.11;

          halo.rotation.y = -time * 0.05;
          // Kept on top of the standing tilt, not replacing it.
          world.rotation.z = Math.sin(time * 0.15) * 0.08;
          world.rotation.x = -0.34 + Math.sin(time * 0.11) * 0.09;
        };
      },
    };
  },

  /* ---------------------------------------------------------------
     Contact: a signal going out. Rings leave the origin and travel
     outward across a receding plane, with a drift of particles above
     it. The section asks someone to make contact, so the backdrop is
     that gesture rather than another abstract field.
  --------------------------------------------------------------- */
  signal: () => {
    const t = makeTracker();
    const RING_COUNT = 5;
    const PERIOD = 6.5;
    return {
      fov: 50,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 1.35, 4.4);
        camera.lookAt(0, 0, -1.6);

        const world = new Group();
        scene.add(world);

        // The ground plane, drawn as a grid that recedes. Lines converging
        // toward the horizon are what give the rings something to travel
        // across; without it they read as flat circles on a black card.
        const gridPts: number[] = [];
        const HALF = 9;
        const DEPTH = 15;
        for (let x = -HALF; x <= HALF; x += 1.5) {
          gridPts.push(x, 0, 1.5, x, 0, -DEPTH);
        }
        for (let z = 1.5; z >= -DEPTH; z -= 1.5) {
          gridPts.push(-HALF, 0, z, HALF, 0, z);
        }
        const gridGeo = t.track(new BufferGeometry());
        gridGeo.setAttribute("position", new Float32BufferAttribute(gridPts, 3));
        const grid = new LineSegments(
          gridGeo,
          t.track(
            new LineBasicMaterial({
              color: new Color(SKY),
              transparent: true,
              opacity: 0.085,
              depthWrite: false,
            })
          )
        );
        world.add(grid);

        // Rings expanding from the origin. One material each, because each
        // has to fade on its own schedule as it travels out.
        const ringGeo = t.track(ringsGeometry([1], 96));
        const rings: Array<{ o: LineSegments; m: LineBasicMaterial; phase: number }> = [];
        for (let i = 0; i < RING_COUNT; i++) {
          const m = t.track(
            new LineBasicMaterial({
              color: new Color(i % 2 === 0 ? SKY : EMBER),
              transparent: true,
              opacity: 0,
              depthWrite: false,
            })
          );
          const o = new LineSegments(ringGeo, m);
          o.position.y = 0.01;
          world.add(o);
          rings.push({ o, m, phase: i / RING_COUNT });
        }

        // A drift of motes above the plane, so the space has volume rather
        // than being a floor with nothing over it.
        const motes: number[] = [];
        const N = 70;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2 * 4.7;
          const r = 1 + ((i * 37) % 100) / 100 * 6;
          motes.push(
            Math.cos(a) * r,
            0.2 + ((i * 53) % 100) / 100 * 2.4,
            Math.sin(a) * r - 3
          );
        }
        const moteGeo = t.track(new BufferGeometry());
        moteGeo.setAttribute("position", new Float32BufferAttribute(motes, 3));
        const moteMat = t.track(
          new PointsMaterial({
            color: new Color(SKY),
            size: 0.035,
            transparent: true,
            opacity: 0.5,
            blending: AdditiveBlending,
            depthWrite: false,
          })
        );
        const mote = new Points(moteGeo, moteMat);
        world.add(mote);

        // The origin itself: a small ember mark the rings leave from.
        const originGeo = t.track(new BufferGeometry());
        originGeo.setAttribute("position", new Float32BufferAttribute([0, 0.02, 0], 3));
        const origin = new Points(
          originGeo,
          t.track(
            new PointsMaterial({
              color: new Color(EMBER),
              size: 0.16,
              transparent: true,
              opacity: 0.9,
              blending: AdditiveBlending,
              depthWrite: false,
            })
          )
        );
        world.add(origin);

        return (time) => {
          rings.forEach(({ o, m, phase }) => {
            // 0 at the origin, 1 at the far edge of the travel.
            const u = ((time / PERIOD + phase) % 1 + 1) % 1;
            const r = 0.25 + u * 8.5;
            o.scale.set(r, 1, r);
            // Zero at both ends, so a ring is invisible when it restarts.
            const fadeIn = Math.min(1, u / 0.07);
            const fadeOut = Math.min(1, (1 - u) / 0.45);
            m.opacity = 0.5 * fadeIn * fadeOut;
          });

          mote.rotation.y = time * 0.035;
          // A slow breath on the whole plane, so it is never quite still.
          world.rotation.y = Math.sin(time * 0.08) * 0.07;
          origin.rotation.y = time;
        };
      },
    };
  },

  /* ---------------------------------------------------------------
     Statement: a corridor of rings receding into depth, with a value
     travelling down it. The section's claim is that a type crosses the
     whole stack, so the backdrop is that journey given an actual Z axis.
  --------------------------------------------------------------- */
  corridor: () => {
    const t = makeTracker();
    return {
      fov: 58,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 0, 3.4);
        camera.lookAt(0, 0, -8);

        const world = new Group();
        scene.add(world);

        const RINGS = 26;
        const SPACING = 1.25;
        const frames: Group[] = [];
        // One material per frame, not one shared: each has to fade on its
        // own as it nears the camera. Sharing meant the closest frames
        // stayed at full strength while scaling past the viewport, which
        // read as stray diagonals cutting across the section rather than
        // as a corridor.
        const mats: LineBasicMaterial[] = [];
        const ringGeo = t.track(ringsGeometry([2.6], 4)); // a square frame

        for (let i = 0; i < RINGS; i++) {
          const mat = t.track(
            new LineBasicMaterial({ color: new Color(SKY), transparent: true, opacity: 0.85 })
          );
          mats.push(mat);
          const g = new Group();
          const seg = new LineSegments(ringGeo, mat);
          seg.rotation.x = Math.PI / 2;
          seg.rotation.z = Math.PI / 4;
          g.add(seg);
          g.position.z = -i * SPACING;
          frames.push(g);
          world.add(g);
        }

        const TOTAL = RINGS * SPACING;
        return (time) => {
          // Frames stream toward the camera and recycle, so the corridor
          // never ends without building 200 of them.
          frames.forEach((f, i) => {
            let z = (-i * SPACING + time * 2.1) % TOTAL;
            if (z > 0) z -= TOTAL;
            f.position.z = z;
            // 0 at the far end, 1 just in front of the camera.
            const near = 1 - Math.abs(z) / TOTAL;
            f.scale.setScalar(0.8 + near * 1.35);
            // Both ends of the loop have to reach exactly zero opacity, or
            // the wrap is visible. The old curve was full-strength the
            // instant a frame recycled to the vanishing point, so every
            // frame popped into existence - that is the "restart" you see.
            // Ramping in over the first 14% of the run and out over the
            // last 30% means a frame is invisible at both the moment it
            // appears and the moment it is recycled.
            const fadeIn = Math.min(1, near / 0.1);
            const fadeOut = Math.min(1, (1 - near) / 0.08);
            mats[i].opacity = 0.85 * fadeIn * fadeOut;
          });
        };
      },
    };
  },

  /* ---------------------------------------------------------------
     Skills: a slow wireframe globe sitting behind the 2D scope. Purely
     atmospheric - the readable data stays on the 2D canvas in front,
     because that legibility was the whole point of that redesign.
  --------------------------------------------------------------- */
  globe: () => {
    const t = makeTracker();
    return {
      fov: 45,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 0, 5.2);
        camera.lookAt(0, 0, 0);

        const world = new Group();
        scene.add(world);
        world.rotation.z = 0.34;

        // Slightly wider than the viewport box is tall, so it reads as a
        // backdrop the cards sit on rather than a ball behind the middle one.
        const sphere = t.track(new SphereGeometry(2.35, 26, 16));
        world.add(
          new LineSegments(
            t.track(wireframeFrom(sphere)),
            t.track(new LineBasicMaterial({ color: new Color(SKY), transparent: true, opacity: 0.1 }))
          )
        );

        // A scatter of points on the shell, so it reads as populated.
        const pts: number[] = [];
        for (let i = 0; i < 90; i++) {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / 90);
          const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
          pts.push(
            Math.sin(phi) * Math.cos(theta) * 2.35,
            Math.cos(phi) * 2.35,
            Math.sin(phi) * Math.sin(theta) * 2.35
          );
        }
        const pg = t.track(new BufferGeometry());
        pg.setAttribute("position", new Float32BufferAttribute(pts, 3));
        world.add(
          new Points(
            pg,
            t.track(
              new PointsMaterial({
                color: new Color(SKY),
                size: 0.045,
                transparent: true,
                opacity: 0.5,
                blending: AdditiveBlending,
                depthWrite: false,
              })
            )
          )
        );

        return (time) => {
          world.rotation.y = time * 0.09;
        };
      },
    };
  },


  /* ---------------------------------------------------------------
     Whole page: a quiet star layer fixed behind everything. Three depth
     bands drifting at different rates, so scrolling gives parallax
     without anything sweeping across the content - the page-wide radar
     that came before this was removed for exactly that reason.
  --------------------------------------------------------------- */
  starfield: () => {
    const t = makeTracker();
    return {
      fov: 62,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 0, 6);
        camera.lookAt(0, 0, 0);

        const world = new Group();
        scene.add(world);

        // Three bands: far ones smaller, dimmer and slower.
        const bands: Array<{ g: Group; rate: number }> = [];
        const LAYERS: Array<[number, number, number, number]> = [
          // count, spread, size, opacity
          [190, 16, 0.028, 0.34],
          [120, 12, 0.042, 0.46],
          [60, 9, 0.058, 0.6],
        ];

        LAYERS.forEach(([count, spread, size, opacity], li) => {
          const pts: number[] = [];
          for (let i = 0; i < count; i++) {
            // Golden-angle scatter: deterministic, so the sky is identical
            // on every load instead of reshuffling on each mount.
            const a = i * 2.399963 + li * 1.7;
            const r = Math.sqrt((i + 0.5) / count) * spread;
            pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.62, -li * 2.2 - ((i % 7) * 0.3));
          }
          const g = t.track(new BufferGeometry());
          g.setAttribute("position", new Float32BufferAttribute(pts, 3));
          const grp = new Group();
          grp.add(
            new Points(
              g,
              t.track(
                new PointsMaterial({
                  color: new Color(li === 2 ? EMBER : SKY),
                  size,
                  transparent: true,
                  opacity,
                  blending: AdditiveBlending,
                  depthWrite: false,
                })
              )
            )
          );
          world.add(grp);
          bands.push({ g: grp, rate: 0.004 + li * 0.004 });
        });

        return (time) => {
          bands.forEach(({ g, rate }, i) => {
            g.rotation.z = time * rate * (i % 2 === 0 ? 1 : -1);
            g.position.y = Math.sin(time * 0.07 + i) * 0.25;
          });
        };
      },
    };
  },

  /* ---------------------------------------------------------------
     Projects / contact: a slow drifting point field, giving the flat
     card grids something with parallax behind them.
  --------------------------------------------------------------- */
  field: () => {
    const t = makeTracker();
    return {
      fov: 60,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);

        const world = new Group();
        scene.add(world);

        const pts: number[] = [];
        // Deterministic scatter: a fixed pattern beats Math.random here
        // because the layout then looks identical on every load.
        for (let i = 0; i < 160; i++) {
          const a = i * 2.399963; // golden angle
          const r = Math.sqrt(i / 160) * 7;
          pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.55, -((i % 12) * 0.55));
        }
        const g = t.track(new BufferGeometry());
        g.setAttribute("position", new Float32BufferAttribute(pts, 3));
        world.add(
          new Points(
            g,
            t.track(
              new PointsMaterial({
                color: new Color(SKY),
                size: 0.05,
                transparent: true,
                opacity: 0.4,
                blending: AdditiveBlending,
                depthWrite: false,
              })
            )
          )
        );

        return (time) => {
          world.rotation.z = time * 0.012;
          world.position.y = Math.sin(time * 0.2) * 0.2;
        };
      },
    };
  },
};

/* ---------------------------------------------------------------------
   Geometry helpers
--------------------------------------------------------------------- */

function wireframeFrom(geo: SphereGeometry): BufferGeometry {
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  const out: number[] = [];
  const g = new BufferGeometry();
  if (!index) return g;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      out.push(pos.getX(p), pos.getY(p), pos.getZ(p), pos.getX(q), pos.getY(q), pos.getZ(q));
    }
  }
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return g;
}

/**
 * Latitude rings and longitude meridians on a sphere.
 *
 * Not the triangle wireframe: that is the edges of a triangulated shell,
 * and at a low segment count the diagonals read as a field of asterisks
 * rather than as a globe. Lat/long lines curve with the surface and crowd
 * toward the silhouette, which is the cue that says "sphere".
 */
function sphereGridGeometry(r: number, lats: number, lons: number, seg = 72): BufferGeometry {
  const out: number[] = [];
  const push = (
    p0: [number, number, number],
    p1: [number, number, number]
  ) => out.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);

  const at = (phi: number, theta: number): [number, number, number] => [
    Math.sin(phi) * Math.cos(theta) * r,
    Math.cos(phi) * r,
    Math.sin(phi) * Math.sin(theta) * r,
  ];

  for (let i = 1; i <= lats; i++) {
    const phi = (i / (lats + 1)) * Math.PI;
    for (let j = 0; j < seg; j++) {
      push(at(phi, (j / seg) * Math.PI * 2), at(phi, ((j + 1) / seg) * Math.PI * 2));
    }
  }
  for (let i = 0; i < lons; i++) {
    const theta = (i / lons) * Math.PI * 2;
    for (let j = 0; j < seg; j++) {
      push(at((j / seg) * Math.PI, theta), at(((j + 1) / seg) * Math.PI, theta));
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return g;
}

function ringsGeometry(radii: number[], segments: number): BufferGeometry {
  const out: number[] = [];
  for (const r of radii) {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      out.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return g;
}


