import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
} from "three";
import { mountScene } from "../lib/threeScene";
import type { SceneController, SceneDef } from "../lib/threeScene";
import { sceneBudget, scaled } from "../lib/sceneQuality";
import { readScrollVelocity, watchScrollVelocity } from "../lib/scrollVelocity";
import type { SceneVariant } from "../lib/sceneQuality";

export type { SceneVariant };

const SKY = "#6ab9e7";
const EMBER = "#e98e49";

export interface Scene3DProps {
  variant: SceneVariant;
  /** The visitor's "Pause motion": stops the loop on the current frame. */
  paused?: boolean;
  onLive?: (live: boolean) => void;
}

/**
 * Every WebGL scene on the site, behind one lazy import.
 *
 * Deliberately one module rather than a component per scene: each would
 * otherwise pull Three into its own chunk, and the library is roughly the
 * size of the entire rest of the bundle. One entry point means one shared
 * chunk, fetched once, reused by all six.
 *
 * Whether and when this mounts is Scene.tsx's job; once mounted it builds its
 * scene, follows the pause prop, and tears everything down on unmount.
 */
export default function Scene3D({ variant, paused = false, onLive }: Scene3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  // Read through refs so a new callback or a pause from the parent never
  // rebuilds the scene. These effects run before the build below, so the
  // build sees the current values.
  const pausedRef = useRef(paused);
  const onLiveRef = useRef(onLive);
  useEffect(() => {
    onLiveRef.current = onLive;
  }, [onLive]);

  useEffect(() => {
    pausedRef.current = paused;
    controller.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = false;
    const report = (next: boolean) => {
      live = next;
      onLiveRef.current?.(next);
    };
    // Detail is read at build time, so a scene rebuilt after a rotation picks
    // up the budget for the orientation it is actually in.
    const c = mountScene(el, BUILDERS[variant](sceneBudget(variant).detail), {
      onLive: report,
      budget: () => sceneBudget(variant),
      paused: pausedRef.current,
    });
    controller.current = c;
    return () => {
      c.dispose();
      controller.current = null;
      // The canvas is gone, so whatever stood in for it (the hero's still)
      // has to come back.
      if (live) report(false);
    };
  }, [variant]);

  return <div className="scene-mount" ref={ref} />;
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

const BUILDERS: Record<SceneVariant, (detail: number) => SceneDef> = {
  /* ---------------------------------------------------------------
     Hero: a gyroscope core. Three nested rings on orthogonal axes,
     each turning at its own rate, with a shell of particles orbiting
     outside them. Reads as a precision instrument rather than a radar,
     and the differing rates mean the silhouette never repeats.
  --------------------------------------------------------------- */
  core: (detail) => {
    const t = makeTracker();
    const R_CORE = 0.88;
    // The sphere is opaque and read against its own wireframe, so it can
    // lose a lot of segments before the silhouette starts to show facets.
    const SEG_W = scaled(48, detail, 24);
    const SEG_H = scaled(32, detail, 16);
    return {
      fov: 42,
      dispose: t.disposeAll,
      setup: ({ scene, camera, renderer }) => {
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
          t.track(new SphereGeometry(R_CORE, SEG_W, SEG_H)),
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
          t.track(new SphereGeometry(R_CORE * 1.022, SEG_W, SEG_H)),
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

        // The assembly leans a few degrees toward a mouse anywhere in the
        // hero, and spins up while the page scrolls (lib/scrollVelocity.ts).
        const lean = { x: 0, y: 0, tx: 0, ty: 0 };
        const area = renderer.domElement.closest("section");
        const mouse = window.matchMedia?.("(pointer: fine) and (hover: hover)").matches ?? false;
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== "mouse" || !area) return;
          const r = area.getBoundingClientRect();
          // -1..1 across the hero, from its own centre.
          lean.ty = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
          lean.tx = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
        };
        const onLeave = () => {
          lean.tx = 0;
          lean.ty = 0;
        };
        if (area && mouse) {
          area.addEventListener("pointermove", onMove);
          area.addEventListener("pointerleave", onLeave);
          t.track({
            dispose: () => {
              area.removeEventListener("pointermove", onMove);
              area.removeEventListener("pointerleave", onLeave);
            },
          });
        }
        t.track({ dispose: watchScrollVelocity() });
        // Spin time: runs at 1x at rest and up to 3.5x at a fast scroll.
        let spin = 0;
        let boost = 0;

        // A faint atmosphere so the core sits in something.
        const haloPts: number[] = [];
        const N = scaled(90, detail, 40);
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

        return (time, dt) => {
          const target = Math.min(1, Math.abs(readScrollVelocity()) / 2600);
          boost += (target - boost) * (1 - Math.exp(-dt * 5));
          spin += dt * (1 + 2.5 * boost);
          // Spring-smoothed toward the cursor.
          const k = 1 - Math.exp(-dt * 4);
          lean.x += (lean.tx - lean.x) * k;
          lean.y += (lean.ty - lean.y) * k;

          // Each gimbal turns on its own axis; because they are nested the
          // inner ones are carried by the outer ones as well.
          outer.rotation.y = spin * 0.5;
          middle.rotation.x = spin * 0.7;
          inner.rotation.z = spin * 0.95;

          // Electrons sweep their own ring on top of the inherited motion.
          electrons.forEach((e) => {
            e.g.rotation.y = spin * e.rate + e.phase;
          });

          // The core turns on its own, slowly, so the surface grid reads as
          // a rotating body and not a static decal.
          grid.rotation.y = time * 0.11;
          body.rotation.y = time * 0.11;

          halo.rotation.y = -time * 0.05;
          // Kept on top of the standing tilt, not replacing it.
          world.rotation.z = Math.sin(time * 0.15) * 0.08;
          // About 8 degrees of lean at the hero's edges.
          world.rotation.x = -0.34 + Math.sin(time * 0.11) * 0.09 + lean.x * 0.14;
          world.rotation.y = 0.22 + lean.y * 0.2;
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
  signal: (detail) => {
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
        const ringGeo = t.track(ringsGeometry([1], scaled(96, detail, 48)));
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
        const N = scaled(70, detail, 30);
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
     How it's built: a corridor of frames receding into depth. The
     section traces the project list from one file to this page, so the
     backdrop is a journey given an actual Z axis.

     It sits behind a diagram and its text, so it is kept sparse: 14
     frames rather than the 26 it had as a section of its own, and the
     tunnel's centre is moved off to the right, away from the reading
     column on the left.
  --------------------------------------------------------------- */
  corridor: () => {
    const t = makeTracker();
    const FRAMES = 14;
    // Wider spacing than before, so fewer frames still make a corridor of
    // about the same depth rather than a short box.
    const SPACING = 1.8;
    const SPEED = 2.1;
    // Where the vanishing point sits across the stage, from the left edge.
    const CENTRE_X = 0.7;
    return {
      fov: 58,
      dispose: t.disposeAll,
      setup: ({ scene, camera }) => {
        camera.position.set(0, 0, 3.4);
        camera.lookAt(0, 0, -8);

        // An off-axis view rather than moving the frames: every frame
        // converges on the centre of the projection however far it is moved
        // sideways, so the only way to put the vanishing point at 70% of the
        // width is to slide the view window itself. setViewOffset works in
        // fractions of the full view, so it holds at any size; it also
        // overwrites the aspect ratio, which applySize has already set.
        const aspect = camera.aspect;
        camera.setViewOffset(1, 1, -(CENTRE_X - 0.5), 0, 1, 1);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();

        const world = new Group();
        scene.add(world);

        const frames: Group[] = [];
        // One material per frame, not one shared: each has to fade on its
        // own as it nears the camera. Sharing meant the closest frames
        // stayed at full strength while scaling past the viewport, which
        // read as stray diagonals cutting across the section rather than
        // as a corridor.
        const mats: LineBasicMaterial[] = [];
        const ringGeo = t.track(ringsGeometry([2.6], 4)); // a square frame

        for (let i = 0; i < FRAMES; i++) {
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

        const TOTAL = FRAMES * SPACING;
        return (time) => {
          // Frames stream toward the camera and recycle, so the corridor
          // never ends without building 200 of them.
          frames.forEach((f, i) => {
            let z = (-i * SPACING + time * SPEED) % TOTAL;
            if (z > 0) z -= TOTAL;
            f.position.z = z;
            // 0 at the far end, 1 just in front of the camera.
            const near = 1 - Math.abs(z) / TOTAL;
            f.scale.setScalar(0.8 + near * 1.35);
            // Both ends of the loop reach exactly zero opacity, so a frame
            // is invisible at the moment it appears and the moment it is
            // recycled, and the wrap never shows.
            const fadeIn = Math.min(1, near / 0.1);
            const fadeOut = Math.min(1, (1 - near) / 0.08);
            // Distant frames crowd together around the tunnel's centre line,
            // where their lines stack into a bright knot. Weighting by depth
            // keeps that knot as dim as the open frames around it.
            const depth = 0.3 + 0.7 * near * near;
            mats[i].opacity = 0.85 * fadeIn * fadeOut * depth;
          });
        };
      },
    };
  },

  /* ---------------------------------------------------------------
     Skills: a slow wireframe globe, pinned behind the section while its
     groups scroll past. Purely atmospheric: it is held at low strength
     and faded out across the left half (styles/scenes.css), so the lists
     in front stay the thing you read.
  --------------------------------------------------------------- */
  globe: (detail) => {
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
        const sphere = t.track(
          new SphereGeometry(2.35, scaled(26, detail, 16), scaled(16, detail, 10))
        );
        world.add(
          new LineSegments(
            t.track(wireframeFrom(sphere)),
            t.track(new LineBasicMaterial({ color: new Color(SKY), transparent: true, opacity: 0.1 }))
          )
        );

        // A scatter of points on the shell, so it reads as populated.
        const pts: number[] = [];
        const DOTS = scaled(90, detail, 44);
        for (let i = 0; i < DOTS; i++) {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / DOTS);
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

     Every so often a shooting star crosses part of the sky: a white-hot
     head with a soft glow, burning out through sky or ember into a long
     tapering tail, gone in about a second. One every 5 to 13 seconds of
     the scene's own clock (so none pile up while it is paused or off
     screen), sometimes followed closely by a second. Each is one small
     ribbon whose shape is drawn by its shader from a few uniforms, so a
     frame moves numbers, never buffers.
  --------------------------------------------------------------- */
  starfield: (detail) => {
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
        // The page-wide layer, and the only one that is always on screen,
        // so it is the one worth thinning most on a phone.
        const LAYERS: Array<[number, number, number, number]> = [
          // count, spread, size, opacity
          [scaled(190, detail, 70), 16, 0.028, 0.34],
          [scaled(120, detail, 50), 12, 0.042, 0.46],
          [scaled(60, detail, 28), 9, 0.058, 0.6],
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

        // Two shooting stars, reused: a lead and the odd follower.
        const glow = softDot();
        if (glow) t.track(glow);
        const meteors = [0, 1].map(() => makeMeteor(t, glow));
        meteors.forEach((m) => scene.add(m.group));
        // The first one a few seconds in, so it is not lost in the load.
        let next = 3.5;

        return (time, dt) => {
          bands.forEach(({ g, rate }, i) => {
            g.rotation.z = time * rate * (i % 2 === 0 ? 1 : -1);
            g.position.y = Math.sin(time * 0.07 + i) * 0.25;
          });

          if (time >= next) {
            const halfH = Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.position.z;
            const halfW = halfH * camera.aspect;
            const lead = meteors[0];
            if (!lead.active) {
              launchMeteor(lead, halfW, halfH, Math.random() < 0.35 ? EMBER : SKY);
              // Now and then a second, close behind on a near-parallel path.
              if (Math.random() < 0.3 && !meteors[1].active) {
                launchMeteor(meteors[1], halfW, halfH, SKY, lead, 0.22 + Math.random() * 0.25);
              }
            }
            next = time + 5 + Math.random() * 8;
          }
          meteors.forEach((m) => stepMeteor(m, dt));
        };
      },
    };
  },

  /* ---------------------------------------------------------------
     Work: a slow drifting field of motes, giving the case studies
     something with parallax behind them. The motes are round and soft-
     edged (softDot below): square GL points read as hard pixels wherever
     one drifted behind a line of text.
  --------------------------------------------------------------- */
  field: (detail) => {
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
        const MOTES = scaled(160, detail, 70);
        for (let i = 0; i < MOTES; i++) {
          const a = i * 2.399963; // golden angle
          const r = Math.sqrt(i / MOTES) * 7;
          pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.55, -((i % 12) * 0.55));
        }
        const g = t.track(new BufferGeometry());
        g.setAttribute("position", new Float32BufferAttribute(pts, 3));
        const dot = softDot();
        if (dot) t.track(dot);
        world.add(
          new Points(
            g,
            t.track(
              new PointsMaterial({
                color: new Color(SKY),
                // Larger than the old hard dots, because most of a soft
                // sprite is its falloff: the bright middle ends up about the
                // size the square used to be.
                size: dot ? 0.12 : 0.05,
                map: dot,
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

interface Meteor {
  group: Group;
  ribbon: ShaderMaterial;
  head: PointsMaterial;
  headPoint: Points;
  active: boolean;
  /** Seconds since launch, or a negative wait before a follower sets off. */
  age: number;
  life: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

/**
 * One shooting star: a ribbon (two triangles) whose shader lays it out
 * from the head back along the direction of travel, wide and white-hot at
 * the head and tapering to nothing, through the meteor's colour, at the
 * tail; and a soft glow sprite on the head. Hidden until launched.
 */
function makeMeteor(t: ReturnType<typeof makeTracker>, glow: CanvasTexture | null): Meteor {
  const geo = t.track(new BufferGeometry());
  // (along, across): along 0 is the head, 1 the tail end.
  geo.setAttribute(
    "position",
    new Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3),
  );
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  const ribbon = t.track(
    new ShaderMaterial({
      uniforms: {
        uHead: { value: new Vector2() },
        uDir: { value: new Vector2(1, 0) },
        uLen: { value: 2.4 },
        uWidth: { value: 0.05 },
        uAlpha: { value: 0 },
        uColor: { value: new Color(SKY) },
      },
      vertexShader: /* glsl */ `
        uniform vec2 uHead;
        uniform vec2 uDir;
        uniform float uLen;
        uniform float uWidth;
        varying float vAlong;
        varying float vAcross;
        void main() {
          float along = position.x;
          vAlong = along;
          vAcross = position.y;
          vec2 normal = vec2(-uDir.y, uDir.x);
          // Full width at the head, a thread at the tail.
          float w = uWidth * (1.0 - along * 0.92);
          vec2 p = uHead - uDir * uLen * along + normal * position.y * w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAlpha;
        varying float vAlong;
        varying float vAcross;
        void main() {
          float fade = pow(1.0 - vAlong, 1.8);
          float core = 1.0 - smoothstep(0.0, 1.0, abs(vAcross));
          // White at the head, the meteor's colour down the tail.
          vec3 colour = mix(vec3(1.0), uColor, smoothstep(0.0, 0.35, vAlong));
          gl_FragColor = vec4(colour, uAlpha * fade * core);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      // Laid out by the shader, so which way the triangles wind depends on
      // the direction of flight: drawn from both sides.
      side: DoubleSide,
    }),
  );
  const mesh = new Mesh(geo, ribbon);
  mesh.frustumCulled = false;

  const headGeo = t.track(new BufferGeometry());
  headGeo.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
  const head = t.track(
    new PointsMaterial({
      color: new Color("#ffffff"),
      size: glow ? 0.42 : 0.12,
      map: glow,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  const headPoint = new Points(headGeo, head);

  const group = new Group();
  group.add(mesh, headPoint);
  group.visible = false;
  return { group, ribbon, head, headPoint, active: false, age: 0, life: 1, x: 0, y: 0, dx: 1, dy: 0, speed: 1 };
}

/**
 * Sends a meteor across the upper part of the view, down and to one side at
 * 18 to 38 degrees. A follower takes the leader's path, offset a little and
 * a moment behind.
 */
function launchMeteor(m: Meteor, halfW: number, halfH: number, colour: string, lead?: Meteor, delay = 0) {
  if (lead) {
    m.dx = lead.dx;
    m.dy = lead.dy;
    m.x = lead.x - lead.dy * 0.35 + lead.dx * 0.2;
    m.y = lead.y + lead.dx * 0.35;
    m.speed = lead.speed * 0.92;
    m.life = lead.life;
  } else {
    const rightward = Math.random() < 0.5;
    const angle = ((18 + Math.random() * 20) * Math.PI) / 180;
    m.dx = Math.cos(angle) * (rightward ? 1 : -1);
    m.dy = -Math.sin(angle);
    // From somewhere across the top half, starting on the side it leaves.
    m.x = (rightward ? -1 : 1) * halfW * (0.15 + Math.random() * 0.75);
    m.y = halfH * (0.25 + Math.random() * 0.7);
    m.speed = halfW * (0.85 + Math.random() * 0.5);
    m.life = 0.9 + Math.random() * 0.5;
  }
  (m.ribbon.uniforms.uColor.value as Color).set(colour);
  (m.ribbon.uniforms.uDir.value as Vector2).set(m.dx, m.dy);
  m.age = -delay;
  m.active = true;
  m.group.visible = false;
}

function stepMeteor(m: Meteor, dt: number) {
  if (!m.active) return;
  m.age += dt;
  if (m.age < 0) return;
  if (m.age >= m.life) {
    m.active = false;
    m.group.visible = false;
    return;
  }
  m.group.visible = true;
  m.x += m.dx * m.speed * dt;
  m.y += m.dy * m.speed * dt;
  const k = m.age / m.life;
  // Flares in fast, burns, then fades over the last third.
  const alpha = Math.min(1, k / 0.08) * (k > 0.66 ? 1 - (k - 0.66) / 0.34 : 1);
  // The tail grows out of the head over the first part of the flight.
  const length = Math.min(1, k / 0.35) * 2.6;
  (m.ribbon.uniforms.uHead.value as Vector2).set(m.x, m.y);
  m.ribbon.uniforms.uLen.value = length;
  m.ribbon.uniforms.uAlpha.value = alpha * 0.95;
  m.head.opacity = alpha;
  m.headPoint.position.set(m.x, m.y, 0);
}

/**
 * A small white disc with a soft edge, drawn once into a canvas, for use as a
 * points sprite map. White so the material's colour tints it. Null where a 2D
 * context is unavailable, in which case the field falls back to plain points.
 */
function softDot(): CanvasTexture | null {
  const SIZE = 64;
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const half = SIZE / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.75)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

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
