import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
} from "three";
import { makeTracker, mountScene } from "../lib/threeScene";
import { rouletteScene } from "./rouletteScene";
import type { SceneController, SceneDef } from "../lib/threeScene";
import { sceneBudget, scaled } from "../lib/sceneQuality";
import { hashKey, readConstellation } from "../lib/constellation";
import { readSend } from "../lib/sendSignal";
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


const BUILDERS: Record<SceneVariant, (detail: number) => SceneDef> = {
  // Hero: a roulette wheel (rouletteScene.ts).
  core: (detail) => rouletteScene(detail),

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
        const originMat = origin.material as PointsMaterial;

        /*
         * The visitor's message (lib/sendSignal.ts). Pressing send launches
         * a packet from the side of the section the form is on; it curves
         * down to the origin and holds there, pulsing, until the server
         * answers. Then it lands: on success an ember shockwave runs out
         * across the plane and the origin flares; on a failure a short grey
         * ring, and nothing goes out. What the server said is written
         * beside the form; this is the same event, seen.
         */
        const glow = softDot();
        if (glow) t.track(glow);
        const packetGeo = t.track(new BufferGeometry());
        packetGeo.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
        const packetMat = t.track(
          new PointsMaterial({
            color: new Color("#ffffff"),
            size: glow ? 0.55 : 0.16,
            map: glow,
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
          })
        );
        const packet = new Points(packetGeo, packetMat);
        packet.visible = false;
        world.add(packet);

        // Its trail: the last few positions, brightest nearest the packet.
        const TRAIL = 16;
        const trailPos = new Float32Array(TRAIL * 3);
        const trailCol: number[] = [];
        const emberCol = new Color(EMBER);
        for (let i = 0; i < TRAIL; i++) {
          const f = (1 - i / TRAIL) ** 1.6;
          trailCol.push(emberCol.r * f, emberCol.g * f, emberCol.b * f);
        }
        const trailGeo = t.track(new BufferGeometry());
        const trailAttr = new BufferAttribute(trailPos, 3);
        trailGeo.setAttribute("position", trailAttr);
        trailGeo.setAttribute("color", new Float32BufferAttribute(trailCol, 3));
        const trailMat = t.track(
          new PointsMaterial({
            size: glow ? 0.22 : 0.07,
            map: glow,
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
          })
        );
        const trail = new Points(trailGeo, trailMat);
        trail.frustumCulled = false;
        trail.visible = false;
        world.add(trail);

        const burstMat = t.track(
          new LineBasicMaterial({ color: new Color(EMBER), transparent: true, opacity: 0, depthWrite: false })
        );
        const burst = new LineSegments(ringGeo, burstMat);
        burst.position.y = 0.015;
        burst.visible = false;
        world.add(burst);

        // Off to the right and in front, where the form is; in over the
        // plane; down onto the origin.
        const FROM = [2.9, 1.9, 2.5];
        const VIA = [1.4, 2.5, 0.3];
        const TO = [0, 0.06, 0];
        const FLY = 1.05;
        let seen = readSend()?.seq ?? 0;
        let flight = -1;
        let answer: { ok: boolean } | null = null;
        let burstAge = -1;
        let burstOk = true;
        let trailCount = 0;

        const place = (k: number, out: number[]) => {
          const a = (1 - k) * (1 - k);
          const b = 2 * (1 - k) * k;
          const c = k * k;
          for (let i = 0; i < 3; i++) out[i] = a * FROM[i] + b * VIA[i] + c * TO[i];
        };
        const at = [0, 0, 0];

        const stepPacket = (dt: number) => {
          const sent = readSend();
          if (sent && sent.seq !== seen) {
            seen = sent.seq;
            if (sent.event.kind === "launch") {
              flight = 0;
              answer = null;
              trailCount = 0;
            } else if (flight >= 0) {
              answer = { ok: sent.event.ok };
            }
          }

          if (flight >= 0) {
            flight += dt;
            const k = Math.min(1, flight / FLY);
            place(easeInOutCubic(k), at);
            packet.visible = true;
            trail.visible = true;
            packet.position.set(at[0], at[1], at[2]);
            // Holding over the origin: a pulse, the way a request waits.
            packetMat.size = (glow ? 0.55 : 0.16) * (k < 1 ? 1 : 1 + 0.25 * Math.sin(flight * 9));
            packetMat.opacity = Math.min(1, flight / 0.12);
            trailMat.opacity = packetMat.opacity * 0.9;
            trailPos.copyWithin(3, 0, (TRAIL - 1) * 3);
            trailPos[0] = at[0];
            trailPos[1] = at[1];
            trailPos[2] = at[2];
            trailCount = Math.min(TRAIL, trailCount + 1);
            trailGeo.setDrawRange(0, trailCount);
            trailAttr.needsUpdate = true;

            if (k >= 1 && answer) {
              burstOk = answer.ok;
              burstAge = 0;
              burstMat.color.set(burstOk ? EMBER : "#8f949a");
              burst.visible = true;
              flight = -1;
              answer = null;
              packet.visible = false;
              trail.visible = false;
            } else if (flight > FLY + 30) {
              // No answer worth waiting for: let it go quietly.
              flight = -1;
              packet.visible = false;
              trail.visible = false;
            }
          }

          if (burstAge >= 0) {
            burstAge += dt;
            const u = Math.min(1, burstAge / (burstOk ? 1.4 : 0.8));
            const r = 0.2 + easeOutCubic(u) * (burstOk ? 7 : 1.6);
            burst.scale.set(r, 1, r);
            burstMat.opacity = (burstOk ? 0.95 : 0.6) * (1 - u);
            originMat.size = 0.16 * (1 + (burstOk ? 2.2 : 0.4) * (1 - u));
            if (u >= 1) {
              burstAge = -1;
              burst.visible = false;
              originMat.size = 0.16;
            }
          }
        };

        return (time, dt) => {
          stepPacket(dt);
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
        // Each band's star positions, kept for the constellations.
        const bandPts: number[][] = [];
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
          bandPts.push(pts);
        });

        /*
         * Constellations (lib/constellation.ts): while the page points at a
         * project (a skill row, a case card), the middle band joins one of
         * its stars per technology that project used into a figure, drawn a
         * line at a time. The stars are chosen among those on screen, from a
         * start fixed by the project's name, walking to the nearest unused
         * star each step, so a project always draws its own shape.
         */
        const MAX_STARS = 16;
        const host = bands[1];
        const hostPts = bandPts[1];
        const figPos = new Float32Array((MAX_STARS - 1) * 2 * 3);
        const figGeo = t.track(new BufferGeometry());
        const figAttr = new BufferAttribute(figPos, 3);
        figGeo.setAttribute("position", figAttr);
        const figMat = t.track(
          new LineBasicMaterial({ color: new Color(SKY), transparent: true, opacity: 0, depthWrite: false })
        );
        const figLines = new LineSegments(figGeo, figMat);
        figLines.frustumCulled = false;
        const starPos = new Float32Array(MAX_STARS * 3);
        const starGeo = t.track(new BufferGeometry());
        const starAttr = new BufferAttribute(starPos, 3);
        starGeo.setAttribute("position", starAttr);
        const starGlow = softDot();
        if (starGlow) t.track(starGlow);
        const starMat = t.track(
          new PointsMaterial({
            color: new Color(EMBER),
            size: starGlow ? 0.34 : 0.1,
            map: starGlow,
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
          })
        );
        const figStars = new Points(starGeo, starMat);
        figStars.frustumCulled = false;
        host?.g.add(figLines, figStars);
        let figKey: string | null = null;
        let figCount = 0;
        let figAge = 0;
        let figFade = 0;

        const drawFigure = (key: string, want: number) => {
          const g = host.g;
          const cos = Math.cos(g.rotation.z);
          const sin = Math.sin(g.rotation.z);
          const halfH = Math.tan(((camera.fov / 2) * Math.PI) / 180);
          // Stars on screen now, by index into the band.
          const seen: number[] = [];
          for (let i = 0; i < hostPts.length / 3; i++) {
            const x = hostPts[i * 3];
            const y = hostPts[i * 3 + 1];
            const z = hostPts[i * 3 + 2];
            const wx = x * cos - y * sin;
            const wy = x * sin + y * cos + g.position.y;
            const h = halfH * (camera.position.z - z);
            if (Math.abs(wx) < h * camera.aspect * 0.86 && Math.abs(wy) < h * 0.8) seen.push(i);
          }
          if (seen.length === 0) return 0;
          const n = Math.min(want, MAX_STARS, seen.length);
          const chosen = [seen[hashKey(key) % seen.length]];
          const used = new Set(chosen);
          while (chosen.length < n) {
            const last = chosen[chosen.length - 1];
            let best = -1;
            let bestD = Infinity;
            for (const i of seen) {
              if (used.has(i)) continue;
              const dx = hostPts[i * 3] - hostPts[last * 3];
              const dy = hostPts[i * 3 + 1] - hostPts[last * 3 + 1];
              const d = dx * dx + dy * dy;
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
            if (best < 0) break;
            chosen.push(best);
            used.add(best);
          }
          chosen.forEach((i, k) => {
            starPos.set([hostPts[i * 3], hostPts[i * 3 + 1], hostPts[i * 3 + 2]], k * 3);
            if (k > 0) {
              const j = chosen[k - 1];
              figPos.set([hostPts[j * 3], hostPts[j * 3 + 1], hostPts[j * 3 + 2]], (k - 1) * 6);
              figPos.set([hostPts[i * 3], hostPts[i * 3 + 1], hostPts[i * 3 + 2]], (k - 1) * 6 + 3);
            }
          });
          figAttr.needsUpdate = true;
          starAttr.needsUpdate = true;
          return chosen.length;
        };

        const stepFigure = (dt: number) => {
          if (!host) return;
          const want = readConstellation();
          if (want && want.key !== figKey) {
            figKey = want.key;
            figCount = drawFigure(want.key, want.count);
            figAge = 0;
          } else if (!want) {
            figKey = null;
          }
          figAge += dt;
          figFade = Math.max(0, Math.min(1, figFade + (figKey ? dt / 0.2 : -dt / 0.35)));
          // A star every 70ms, each line drawn as its far star arrives.
          const lit = Math.min(figCount, Math.floor(figAge / 0.07) + 1);
          starGeo.setDrawRange(0, lit);
          figGeo.setDrawRange(0, Math.max(0, lit - 1) * 2);
          starMat.opacity = figFade;
          figMat.opacity = 0.85 * figFade;
          figLines.visible = figStars.visible = figFade > 0;
        };

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
          stepFigure(dt);
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

const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

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
