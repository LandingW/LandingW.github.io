"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { teapotView } from "@/lib/study-config.mjs";
import { approach, warmupFrame } from "@/lib/motion";

interface StudyControls {
  wireframe: (value: boolean) => void;
  rotate: (dx: number, dy: number) => void;
  reset: () => void;
}

export function TeapotPoster({ visible }: { visible: boolean }) {
  // Remove the fallback from the DOM once WebGL is ready; CSS cannot leave a ghost image behind.
  if (!visible) return null;
  return (
    <Image
      src="/studies/utah-teapot.webp"
      alt="犹他茶壶的金属材质渲染，基于经典 Bézier 曲面模型"
      width={800}
      height={640}
      priority
      className="teapot-poster"
    />
  );
}

export default function TeapotStudy() {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<StudyControls | null>(null);
  const [ready, setReady] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    // An explicit low-power link also makes the no-WebGL layout inspectable.
    if (
      new URLSearchParams(window.location.search).get("graphics") === "static"
    )
      return;
    const host = container.current,
      surface = canvas.current;
    if (!host || !surface) return;
    let disposed = false,
      initialized = false,
      visible = false,
      contextLost = false;
    let frame = 0;
    const cleanup: Array<() => void> = [];
    let requestRender = () => {};

    async function initialize() {
      if (initialized || disposed) return;
      initialized = true;
      try {
        const THREE = await import("@/lib/teapot-primitives");
        const { TeapotGeometry, RoomEnvironment } = THREE;
        if (disposed || !surface || !host) return;
        const renderer = new THREE.WebGLRenderer({
          canvas: surface,
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        cleanup.push(() => {
          renderer.dispose();
          renderer.forceContextLoss();
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(teapotView.fov, 1, 0.1, 30);
        camera.position.set(...(teapotView.camera as [number, number, number]));
        camera.lookAt(...(teapotView.target as [number, number, number]));
        const room = new RoomEnvironment();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(room, 0.04);
        scene.environment = environment.texture;
        room.dispose();
        pmrem.dispose();
        cleanup.push(() => environment.dispose());

        const geometry = new TeapotGeometry(
          teapotView.size,
          teapotView.segments,
          true,
          true,
          true,
          true,
          true,
        );
        const material = new THREE.MeshPhysicalMaterial({
          color: 0xd6ddd2,
          metalness: 1,
          roughness: 0.19,
          envMapIntensity: 1.5,
          clearcoat: 0.25,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const solid = new THREE.Mesh(geometry, material);
        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0x70836a,
          wireframe: true,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const wire = new THREE.Mesh(geometry, wireMaterial);
        wire.renderOrder = 2;
        const mesh = new THREE.Group();
        mesh.add(solid, wire);
        mesh.rotation.set(...(teapotView.rotation as [number, number, number]));
        scene.add(mesh);
        const fill = new THREE.DirectionalLight(0xffecd7, 3);
        fill.position.set(-3, 4, 5);
        scene.add(fill);
        cleanup.push(() => {
          geometry.dispose();
          material.dispose();
          wireMaterial.dispose();
        });

        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = shadowCanvas.height = 128;
        const context = shadowCanvas.getContext("2d");
        if (context) {
          const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 64);
          gradient.addColorStop(0, "rgba(30,37,28,.25)");
          gradient.addColorStop(1, "rgba(30,37,28,0)");
          context.fillStyle = gradient;
          context.fillRect(0, 0, 128, 128);
          const texture = new THREE.CanvasTexture(shadowCanvas);
          const shadowMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          });
          const shadowGeometry = new THREE.PlaneGeometry(5, 3);
          const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.y = -1.2;
          scene.add(shadow);
          cleanup.push(() => {
            shadowGeometry.dispose();
            shadowMaterial.dispose();
            texture.dispose();
          });
        }

        // Compile both display materials before exposing controls, avoiding a first-toggle hitch.
        await renderer.compileAsync(scene, camera);
        if (disposed || contextLost) return;
        const target = {
          x: teapotView.rotation[0],
          y: teapotView.rotation[1],
          wire: 0,
        };
        let modeBlend = 0,
          lastFrameTime = 0,
          firstFrameDrawn = false;
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        );
        let warmupStart: number | null = null;
        let warmupFinished = reducedMotion.matches;
        const finishWarmup = () => {
          if (!warmupFinished) setWarming(false);
          warmupFinished = true;
          material.envMapIntensity = 1.5;
          fill.intensity = 3;
        };
        const canRender = () =>
          !disposed && !contextLost && visible && !document.hidden;
        const render = (time: number) => {
          frame = 0;
          if (!canRender()) {
            lastFrameTime = 0;
            return;
          }
          const elapsed = lastFrameTime ? time - lastFrameTime : 1000 / 60;
          lastFrameTime = time;
          if (reducedMotion.matches && !warmupFinished) finishWarmup();
          if (!warmupFinished) {
            if (warmupStart === null) {
              warmupStart = time;
              setWarming(true);
            }
            const intro = warmupFrame(time - warmupStart);
            const light = 0.16 + 0.84 * intro.progress;
            material.envMapIntensity = 1.5 * light;
            fill.intensity = 3 * light;
            if (intro.done) finishWarmup();
          }
          const response = reducedMotion.matches ? 0 : 75;
          mesh.rotation.x = approach(
            mesh.rotation.x,
            target.x,
            elapsed,
            response,
          );
          mesh.rotation.y = approach(
            mesh.rotation.y,
            target.y,
            elapsed,
            response,
          );
          modeBlend = approach(modeBlend, target.wire, elapsed, response);
          if (Math.abs(modeBlend - target.wire) < 0.001)
            modeBlend = target.wire;
          material.opacity = 1 - modeBlend;
          wireMaterial.opacity = modeBlend;
          solid.visible = modeBlend < 1;
          wire.visible = modeBlend > 0;
          renderer.render(scene, camera);
          if (!firstFrameDrawn) {
            firstFrameDrawn = true;
            setReady(true);
          }
          if (
            !warmupFinished ||
            Math.abs(target.x - mesh.rotation.x) +
              Math.abs(target.y - mesh.rotation.y) +
              Math.abs(target.wire - modeBlend) >
              0.001
          )
            frame = requestAnimationFrame(render);
          else lastFrameTime = 0;
        };
        requestRender = () => {
          if (!frame && canRender()) frame = requestAnimationFrame(render);
        };
        controls.current = {
          wireframe: (value) => {
            finishWarmup();
            target.wire = value ? 1 : 0;
            requestRender();
          },
          rotate: (dx, dy) => {
            finishWarmup();
            target.y += dx;
            target.x = Math.max(-0.45, Math.min(0.65, target.x + dy));
            requestRender();
          },
          reset: () => {
            finishWarmup();
            target.x = teapotView.rotation[0];
            target.y = teapotView.rotation[1];
            requestRender();
          },
        };

        let drag: { id: number; x: number; y: number } | null = null;
        const down = (event: PointerEvent) => {
          if (event.button !== 0) return;
          finishWarmup();
          requestRender();
          drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
          surface.setPointerCapture(event.pointerId);
        };
        const move = (event: PointerEvent) => {
          if (!drag || drag.id !== event.pointerId) return;
          controls.current?.rotate(
            (event.clientX - drag.x) * 0.008,
            event.pointerType === "touch"
              ? 0
              : (event.clientY - drag.y) * 0.004,
          );
          drag.x = event.clientX;
          drag.y = event.clientY;
        };
        const up = () => {
          drag = null;
        };
        const lost = (event: Event) => {
          event.preventDefault();
          finishWarmup();
          contextLost = true;
          cancelAnimationFrame(frame);
          frame = 0;
          controls.current = null;
          setReady(false);
        };
        surface.addEventListener("pointerdown", down);
        surface.addEventListener("pointermove", move);
        surface.addEventListener("pointerup", up);
        surface.addEventListener("pointercancel", up);
        surface.addEventListener("lostpointercapture", up);
        surface.addEventListener("webglcontextlost", lost);
        cleanup.push(() => {
          surface.removeEventListener("pointerdown", down);
          surface.removeEventListener("pointermove", move);
          surface.removeEventListener("pointerup", up);
          surface.removeEventListener("pointercancel", up);
          surface.removeEventListener("lostpointercapture", up);
          surface.removeEventListener("webglcontextlost", lost);
        });
        const resize = new ResizeObserver(() => {
          if (disposed || !host.clientWidth || !host.clientHeight) return;
          renderer.setSize(host.clientWidth, host.clientHeight, false);
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
          requestRender();
        });
        resize.observe(host);
        cleanup.push(() => resize.disconnect());
        document.addEventListener("visibilitychange", requestRender);
        cleanup.push(() =>
          document.removeEventListener("visibilitychange", requestRender),
        );
        requestRender();
      } catch {
        // The same canonical geometry remains visible as a pre-rendered poster.
        cleanup
          .splice(0)
          .reverse()
          .forEach((release) => release());
        controls.current = null;
        if (!disposed) {
          setReady(false);
          setWarming(false);
        }
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          void initialize();
          requestRender();
        } else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "40px" },
    );
    observer.observe(host);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      controls.current = null;
      cleanup.reverse().forEach((release) => release());
    };
  }, []);

  return (
    <figure
      className="teapot-study"
      data-render-state={ready ? "interactive" : "poster"}
      data-warming={warming}
    >
      <div className="teapot-surface" ref={container}>
        <TeapotPoster visible={!ready} />
        <canvas
          ref={canvas}
          className={ready ? "teapot-canvas is-ready" : "teapot-canvas"}
          tabIndex={ready ? 0 : -1}
          role="img"
          aria-hidden={!ready}
          aria-label="交互式犹他茶壶，可拖动或使用方向键旋转"
          onKeyDown={(event) => {
            const motions: Record<string, [number, number]> = {
              ArrowLeft: [-0.15, 0],
              ArrowRight: [0.15, 0],
              ArrowUp: [0, -0.1],
              ArrowDown: [0, 0.1],
            };
            if (motions[event.key] && ready) {
              event.preventDefault();
              controls.current?.rotate(...motions[event.key]);
            }
          }}
        />
      </div>
      <figcaption>
        <div>
          <span className="study-hint">
            {ready
              ? "拖动旋转 · 经典曲面的当代表达"
              : "BÉZIER PATCHES / 静态预览"}
          </span>
        </div>
        <div
          className="study-controls"
          data-mode={wireframe ? "wire" : "solid"}
          role="group"
          aria-label="茶壶显示模式"
        >
          <button
            type="button"
            disabled={!ready}
            aria-pressed={!wireframe}
            onClick={() => {
              setWireframe(false);
              controls.current?.wireframe(false);
            }}
          >
            材质
          </button>
          <button
            type="button"
            disabled={!ready}
            aria-pressed={wireframe}
            onClick={() => {
              setWireframe(true);
              controls.current?.wireframe(true);
            }}
          >
            线框
          </button>
          <button
            type="button"
            disabled={!ready}
            aria-label="重置茶壶角度"
            onClick={() => controls.current?.reset()}
          >
            ↺
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
