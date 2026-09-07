"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { createNavigation, type Point } from "@/lib/client/walk-navigation";
export type CameraCommand = { type: "reset" | "in" | "out"; seq: number };
export type WalkInput = { x: number; y: number };
export default function SceneNavigation({
  mode,
  autoplay,
  activeRoom,
  rooms,
  center,
  size,
  walls,
  openings,
  items,
  bounds,
  command,
  walkInput,
  lookToWalk,
  onRoomChange,
  onNotice,
}: {
  mode: "overview" | "tour";
  autoplay: boolean;
  activeRoom: number;
  rooms: any[];
  center: THREE.Vector3;
  size: number;
  walls: any[];
  openings: any[];
  items: any[];
  bounds: any;
  command?: CameraCommand;
  walkInput?: WalkInput;
  lookToWalk?: boolean;
  onRoomChange?: (n: number) => void;
  onNotice?: (s: string) => void;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<any>(null),
    target = useRef<THREE.Vector3 | null>(null),
    cameraTarget = useRef<THREE.Vector3 | null>(null),
    route = useRef<Point[]>([]),
    keys = useRef(new Set<string>()),
    angles = useRef({ yaw: 0, pitch: 0 }),
    edge = useRef(0),
    idle = useRef(0),
    initialized = useRef(false),
    drag = useRef<{ x: number; y: number; id: number } | null>(null),
    reduced = useRef(false),
    visited = useRef(new Set<number>());
  const nav = useMemo(
    () => createNavigation(walls, openings, items, bounds),
    [walls, openings, items, bounds],
  );
  const roomPoints = useMemo(
    () =>
      rooms.map((r) =>
        nav.nearest(
          {
            x: Number(r.center?.x ?? center.x),
            z: -Number(r.center?.y ?? -center.z),
          },
          (p) => {
            const polygon = r.polygon || [];
            if (polygon.length < 3) return true;
            let inside = false;
            for (
              let i = 0, j = polygon.length - 1;
              i < polygon.length;
              j = i++
            ) {
              const a = polygon[i],
                b = polygon[j],
                y = -p.z;
              if (
                a.y > y !== b.y > y &&
                p.x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
              )
                inside = !inside;
            }
            return inside;
          },
        ),
      ),
    [rooms, nav, center.x, center.z],
  );
  const notify = useRef(onNotice);
  notify.current = onNotice;
  const changeRoom = useRef(onRoomChange);
  changeRoom.current = onRoomChange;
  function orientation() {
    camera.rotation.order = "YXZ";
    camera.rotation.y = angles.current.yaw;
    camera.rotation.x = angles.current.pitch;
    camera.rotation.z = 0;
  }
  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);
  useEffect(() => {
    if (mode !== "tour") return;
    const point =
      roomPoints[activeRoom] || nav.nearest({ x: center.x, z: center.z });
    if (!point) {
      notify.current?.(
        "لا توجد مساحة آمنة للمشي في هذا المخطط. يمكنك استكشافه من عرض 3D.",
      );
      return;
    }
    camera.position.set(point.x, 1.62, point.z);
    camera.lookAt(center.x, 1.62, center.z);
    angles.current = { yaw: camera.rotation.y, pitch: 0 };
    orientation();
    initialized.current = true;
    route.current = [];
    visited.current = new Set([activeRoom]);
    return () => {
      initialized.current = false;
      keys.current.clear();
    };
  }, [mode, nav]);
  useEffect(() => {
    const p = roomPoints[activeRoom];
    if (mode === "overview") {
      const room = rooms[activeRoom];
      if (!room) return;
      const focus = new THREE.Vector3(
        Number(room.center?.x ?? center.x),
        0,
        -Number(room.center?.y ?? -center.z),
      );
      target.current = focus;
      cameraTarget.current = focus
        .clone()
        .add(
          new THREE.Vector3(size * 0.35, Math.max(5, size * 0.45), size * 0.35),
        );
    } else if (initialized.current && p) {
      const next = nav.route({ x: camera.position.x, z: camera.position.z }, p);
      if (
        !next.length &&
        camera.position.distanceTo(new THREE.Vector3(p.x, 1.62, p.z)) > 0.35
      )
        notify.current?.(
          "لا يوجد مسار متصل لهذه الغرفة. راجع فتحات الأبواب في المخطط.",
        );
      route.current = next;
      idle.current = 0;
      visited.current.add(activeRoom);
    }
  }, [activeRoom, mode, nav]);
  useEffect(() => {
    if (!command || mode !== "overview") return;
    if (command.type === "reset") {
      target.current = center.clone();
      cameraTarget.current = new THREE.Vector3(
        center.x + size * 0.72,
        Math.max(7, size * 0.7),
        center.z + size * 0.72,
      );
    } else {
      const t = controls.current?.target || center;
      target.current = t.clone();
      cameraTarget.current = camera.position
        .clone()
        .sub(t)
        .multiplyScalar(command.type === "in" ? 0.8 : 1.25)
        .add(t);
    }
  }, [command]);
  useEffect(() => {
    if (mode !== "tour") return;
    const el = gl.domElement;
    const previousTabIndex = el.tabIndex;
    el.tabIndex = 0;
    el.setAttribute(
      "aria-label",
      "المشي داخل المنزل. اسحب للنظر واستخدم أسهم لوحة المفاتيح أو WASD للحركة.",
    );
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.focus();
    };
    const move = (e: PointerEvent) => {
      if (drag.current) {
        const dx = e.clientX - drag.current.x,
          dy = e.clientY - drag.current.y;
        angles.current.yaw -= dx * 0.003;
        angles.current.pitch = THREE.MathUtils.clamp(
          angles.current.pitch - dy * 0.003,
          -0.9,
          0.9,
        );
        drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }
      const rect = el.getBoundingClientRect();
      edge.current = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    };
    const up = () => {
      drag.current = null;
    };
    const leave = () => {
      edge.current = 0;
      drag.current = null;
    };
    const keydown = (e: KeyboardEvent) => {
      if (document.activeElement !== el) return;
      const k = e.code;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(k)
      ) {
        e.preventDefault();
        keys.current.add(k);
        route.current = [];
      }
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      el.tabIndex = previousTabIndex;
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [mode, gl]);
  useEffect(() => {
    if (!autoplay) route.current = [];
  }, [autoplay]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (mode === "overview") {
      if (cameraTarget.current) {
        const k = reduced.current ? 1 : 1 - Math.exp(-dt * 5);
        camera.position.lerp(cameraTarget.current, k);
        if (target.current) controls.current?.target.lerp(target.current, k);
        controls.current?.update();
        if (camera.position.distanceTo(cameraTarget.current) < 0.02) {
          cameraTarget.current = null;
          target.current = null;
        }
      }
      return;
    }
    if (!initialized.current) return;
    let directionX = 0,
      directionZ = 0;
    const yaw = angles.current.yaw;
    const manualX =
      (keys.current.has("KeyD") || keys.current.has("ArrowRight") ? 1 : 0) -
      (keys.current.has("KeyA") || keys.current.has("ArrowLeft") ? 1 : 0) +
      (walkInput?.x || 0);
    const manualY =
      (keys.current.has("KeyW") || keys.current.has("ArrowUp") ? 1 : 0) -
      (keys.current.has("KeyS") || keys.current.has("ArrowDown") ? 1 : 0) +
      (walkInput?.y || 0);
    if (Math.abs(manualX) + Math.abs(manualY) > 0.01) {
      route.current = [];
      directionX = Math.cos(yaw) * manualX - Math.sin(yaw) * manualY;
      directionZ = -Math.sin(yaw) * manualX - Math.cos(yaw) * manualY;
    } else if (route.current.length) {
      const p = route.current[0],
        dx = p.x - camera.position.x,
        dz = p.z - camera.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.1) route.current.shift();
      else {
        directionX = dx / d;
        directionZ = dz / d;
        const nextYaw = Math.atan2(-dx, -dz);
        const diff = Math.atan2(
          Math.sin(nextYaw - yaw),
          Math.cos(nextYaw - yaw),
        );
        angles.current.yaw += diff * (1 - Math.exp(-dt * 3));
        angles.current.pitch *= Math.exp(-dt * 3);
      }
    } else if (autoplay && !reduced.current) {
      idle.current += dt;
      angles.current.yaw += dt * 0.08;
      if (idle.current > 4) {
        idle.current = 0;
        let next = -1;
        for (let n = 1; n <= rooms.length; n++) {
          const i = (activeRoom + n) % rooms.length;
          if (!roomPoints[i] || visited.current.has(i)) continue;
          if (
            nav.route(
              { x: camera.position.x, z: camera.position.z },
              roomPoints[i]!,
            ).length
          ) {
            next = i;
            break;
          }
        }
        if (next >= 0) changeRoom.current?.(next);
        else {
          visited.current.clear();
          notify.current?.("اكتملت الغرف المتصلة في الجولة.");
        }
      }
    }
    if (
      lookToWalk &&
      !autoplay &&
      !reduced.current &&
      Math.abs(edge.current) > 0.72 &&
      !drag.current
    ) {
      angles.current.yaw -= edge.current * dt * 0.5;
      directionX = -Math.sin(angles.current.yaw) * 0.45;
      directionZ = -Math.cos(angles.current.yaw) * 0.45;
    }
    if (directionX || directionZ) {
      const norm = Math.max(1, Math.hypot(directionX, directionZ));
      const from = { x: camera.position.x, z: camera.position.z };
      const next = {
        x: from.x + (directionX / norm) * dt * 1.15,
        z: from.z + (directionZ / norm) * dt * 1.15,
      };
      if (nav.lineClear(from, next)) {
        camera.position.x = next.x;
        camera.position.z = next.z;
      } else {
        route.current = [];
      }
    }
    camera.position.y = 1.62;
    orientation();
  });
  return mode === "overview" ? (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[center.x, 0, center.z]}
      minDistance={2}
      maxDistance={Math.max(12, size * 2.5)}
      maxPolarAngle={Math.PI / 2.04}
      enableDamping
      dampingFactor={0.08}
      onStart={() => {
        target.current = null;
        cameraTarget.current = null;
      }}
    />
  ) : null;
}
