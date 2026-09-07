"use client";

import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import SceneNavigation, {
  type CameraCommand,
  type WalkInput,
} from "./SceneNavigation";

const EMPTY_SCENE: any[] = [];

type DesignItem = {
  category: string;
  name: string;
  room: string;
  planX: number;
  planY: number;
  widthM: number;
  depthM: number;
  heightM: number;
  rotationDeg: number;
  color: string;
  material: string;
  details: string;
};

function wallTransform(w: any) {
  const dx = Number(w.x2) - Number(w.x1);
  const dz = -(Number(w.y2) - Number(w.y1));
  const length = Math.hypot(dx, dz);
  const angle = -Math.atan2(dz, dx);
  const x = (Number(w.x1) + Number(w.x2)) / 2;
  const z = -(Number(w.y1) + Number(w.y2)) / 2;
  return { length, angle, x, z };
}

function WallMesh({
  wall,
  openings,
  onSelect,
  walking = false,
}: {
  wall: any;
  openings: any[];
  onSelect: (item: any) => void;
  walking?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const { length, angle, x, z } = wallTransform(wall);
  const h = Number(wall.heightM) || 2.8;
  const thick = Math.max(0.08, Number(wall.thickness) || 0.18);
  const intervals = openings
    .map((o) => {
      const width = Math.min(
        length * 0.9,
        Math.max(0.55, Number(o.widthM) || 0.9),
      );
      const center = Math.max(
        0,
        Math.min(length, length * (Number(o.position) || 0)),
      );
      return {
        ...o,
        start: Math.max(0, center - width / 2),
        end: Math.min(length, center + width / 2),
        width,
      };
    })
    .sort((a, b) => a.start - b.start);

  const segments: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const o of intervals) {
    if (o.start > cursor + 0.02) segments.push({ start: cursor, end: o.start });
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < length - 0.02) segments.push({ start: cursor, end: length });

  const localToWorld = (along: number, y: number) => {
    const lx = along - length / 2;
    return {
      x: x + lx * Math.cos(-angle),
      z: z - lx * Math.sin(angle),
      y,
    };
  };

  return (
    <group>
      {segments.map((s, i) => {
        const segLen = s.end - s.start;
        const center = (s.start + s.end) / 2;
        const p = localToWorld(center, h / 2);
        return (
          <mesh
            castShadow
            receiveShadow
            key={i}
            position={[p.x, p.y, p.z]}
            rotation={[0, angle, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({
                type: "wall",
                category: "جدار",
                name: "جدار داخلي",
                entityId: wall.entityId,
                lengthM: length,
                heightM: h,
                thicknessM: thick,
                material: "تشطيب الجدار يحدد بعد التصميم",
                source: "BIMy / IFC",
              });
            }}
          >
            <boxGeometry args={[segLen, h, thick]} />
            <meshStandardMaterial
              color={hovered ? "#c2a574" : "#e4ddd1"}
              roughness={0.82}
            />
          </mesh>
        );
      })}

      {intervals.map((o, i) => {
        const openH = Math.max(
          0.8,
          Math.min(
            h - 0.15,
            Number(o.heightM) || (o.kind === "window" ? 1.25 : 2.15),
          ),
        );
        const sill = o.kind === "window" ? Math.min(0.95, h - openH - 0.1) : 0;
        const top = sill + openH;
        const center = (o.start + o.end) / 2;
        const p = localToWorld(center, 0);

        const pieces: any[] = [];
        if (sill > 0.05)
          pieces.push({ key: "sill", y: sill / 2, height: sill });
        if (h - top > 0.05)
          pieces.push({
            key: "lintel",
            y: top + (h - top) / 2,
            height: h - top,
          });

        return (
          <group key={i}>
            {pieces.map((piece) => (
              <mesh
                key={piece.key}
                position={[p.x, piece.y, p.z]}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[o.end - o.start, piece.height, thick]} />
                <meshStandardMaterial color="#e4ddd1" roughness={0.82} />
              </mesh>
            ))}
            <mesh
              visible={!(walking && o.kind === "door")}
              position={[p.x, sill + openH / 2, p.z]}
              rotation={[0, angle, 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
              }}
              onPointerOut={() => setHovered(false)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect({
                  type: o.kind,
                  category: o.kind === "window" ? "نافذة" : "باب",
                  name: o.kind === "window" ? "نافذة" : "باب",
                  widthM: o.end - o.start,
                  heightM: openH,
                  sillM: sill,
                  confidence: o.confidence ?? null,
                  source: o.source || "BIMy / Bayti Vision",
                });
              }}
            >
              <boxGeometry
                args={[
                  Math.max(0.5, o.end - o.start),
                  openH,
                  Math.max(0.025, thick * 0.18),
                ]}
              />
              <meshStandardMaterial
                color={o.kind === "window" ? "#8eb9c7" : "#6f5847"}
                transparent={o.kind === "window"}
                opacity={o.kind === "window" ? 0.42 : 1}
                roughness={o.kind === "window" ? 0.28 : 0.65}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Furniture({
  item,
  position,
  onSelect,
}: {
  item: DesignItem;
  position: [number, number, number];
  onSelect: (i: DesignItem) => void;
}) {
  const [hover, setHover] = useState(false);
  const cat = (item.category + " " + item.name).toLowerCase();
  const w = Math.max(0.25, Number(item.widthM) || 1);
  const d = Math.max(0.25, Number(item.depthM) || 1);
  const h = Math.max(0.15, Number(item.heightM) || 0.7);
  const rot = (-(Number(item.rotationDeg) || 0) * Math.PI) / 180;
  const common = {
    onPointerOver: (e: any) => {
      e.stopPropagation();
      setHover(true);
    },
    onPointerOut: () => setHover(false),
    onClick: (e: any) => {
      e.stopPropagation();
      onSelect(item);
    },
  };

  if (/sofa|كنب/.test(cat)) {
    return (
      <group position={position} rotation={[0, rot, 0]} {...common}>
        <RoundedBox
          castShadow
          receiveShadow
          args={[w, 0.45, d]}
          position={[0, 0.23, 0]}
          radius={0.08}
        >
          <meshStandardMaterial
            color={
              hover
                ? "#b89566"
                : item.color?.startsWith("#")
                  ? item.color
                  : "#ddd4c6"
            }
          />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[w, 0.65, 0.22]}
          position={[0, 0.65, -d / 2 + 0.12]}
          radius={0.06}
        >
          <meshStandardMaterial color="#a99b88" />
        </RoundedBox>
      </group>
    );
  }
  if (/bed|سرير/.test(cat)) {
    return (
      <group position={position} rotation={[0, rot, 0]} {...common}>
        <RoundedBox
          castShadow
          receiveShadow
          args={[w, 0.32, d]}
          position={[0, 0.25, 0]}
          radius={0.05}
        >
          <meshStandardMaterial color={hover ? "#c6aa83" : "#d3c8b8"} />
        </RoundedBox>
        <RoundedBox
          castShadow
          receiveShadow
          args={[w, 0.85, 0.16]}
          position={[0, 0.55, -d / 2]}
          radius={0.04}
        >
          <meshStandardMaterial color="#8f7259" />
        </RoundedBox>
      </group>
    );
  }
  if (/table|طاول/.test(cat)) {
    return (
      <group position={position} rotation={[0, rot, 0]} {...common}>
        <mesh position={[0, h, 0]}>
          <boxGeometry args={[w, 0.08, d]} />
          <meshStandardMaterial color={hover ? "#c3a77e" : "#8b735c"} />
        </mesh>
        {[
          [-w * 0.4, -d * 0.4],
          [w * 0.4, -d * 0.4],
          [-w * 0.4, d * 0.4],
          [w * 0.4, d * 0.4],
        ].map((p, i) => (
          <mesh castShadow receiveShadow key={i} position={[p[0], h / 2, p[1]]}>
            <boxGeometry args={[0.06, h, 0.06]} />
            <meshStandardMaterial color="#51473f" />
          </mesh>
        ))}
      </group>
    );
  }
  if (/light|إنار/.test(cat)) {
    return (
      <group
        position={[position[0], Math.max(2.45, position[1] + h), position[2]]}
        rotation={[0, rot, 0]}
        {...common}
      >
        <mesh>
          <cylinderGeometry
            args={[
              Math.max(0.08, w * 0.16),
              Math.max(0.12, w * 0.25),
              0.22,
              24,
            ]}
          />
          <meshStandardMaterial
            color="#c6a46c"
            emissive="#ffda91"
            emissiveIntensity={hover ? 4 : 2}
          />
        </mesh>
        <pointLight intensity={12} distance={4} color="#ffd79b" />
      </group>
    );
  }
  if (/ac|تكييف|مكيف/.test(cat)) {
    return (
      <mesh
        position={[position[0], 2.35, position[2]]}
        rotation={[0, rot, 0]}
        {...common}
      >
        <boxGeometry
          args={[Math.max(0.7, w), Math.min(0.4, h), Math.min(0.35, d)]}
        />
        <meshStandardMaterial color={hover ? "#d9c8aa" : "#efeee9"} />
      </mesh>
    );
  }
  if (/toilet|مرحاض|كرسي/.test(cat)) {
    return (
      <group position={position} rotation={[0, rot, 0]} {...common}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[w * 0.28, w * 0.35, 0.42, 24]} />
          <meshStandardMaterial color="#ece9e2" />
        </mesh>
        <mesh position={[0, 0.55, -d * 0.28]}>
          <boxGeometry args={[w * 0.65, 0.55, 0.22]} />
          <meshStandardMaterial color="#ece9e2" />
        </mesh>
      </group>
    );
  }

  return (
    <RoundedBox
      castShadow
      receiveShadow
      position={[position[0], h / 2, position[2]]}
      rotation={[0, rot, 0]}
      args={[w, h, d]}
      radius={0.04}
      {...common}
    >
      <meshStandardMaterial
        color={
          hover
            ? "#b99360"
            : item.color?.startsWith("#")
              ? item.color
              : "#9a8873"
        }
        roughness={0.7}
      />
    </RoundedBox>
  );
}

export default function RealHouse3D({
  analysis,
  design,
  detectedDoors = EMPTY_SCENE,
  mode = "overview",
  autoplay = false,
  onSelect,
  activeRoom = 0,
  command,
  walkInput,
  lookToWalk = false,
  onRoomChange,
  onNotice,
  night = false,
}: {
  analysis: any;
  design: any;
  detectedDoors?: any[];
  mode?: "overview" | "tour";
  autoplay?: boolean;
  onSelect?: (i: any) => void;
  activeRoom?: number;
  command?: CameraCommand;
  walkInput?: WalkInput;
  lookToWalk?: boolean;
  onRoomChange?: (n: number) => void;
  onNotice?: (s: string) => void;
  night?: boolean;
}) {
  const walls = Array.isArray(analysis?.ifcPlan?.walls)
    ? analysis.ifcPlan.walls
    : EMPTY_SCENE;
  const providerOpenings = Array.isArray(analysis?.ifcPlan?.openings)
    ? analysis.ifcPlan.openings
    : EMPTY_SCENE;
  const openings = useMemo(
    () => [
      ...providerOpenings,
      ...detectedDoors.map((d: any) => ({
        kind: "door",
        wallEntityId: Number(d.wallEntityId),
        position: Number(d.position),
        widthM: Number(d.widthM) || 0.9,
        heightM: 2.1,
        sillM: 0,
        confidence: Number(d.confidence) || 0.6,
        source: "bayti-door-arc",
      })),
    ],
    [providerOpenings, detectedDoors],
  );
  const items: DesignItem[] = Array.isArray(design?.design?.items)
    ? design.design.items
    : EMPTY_SCENE;
  const lights: DesignItem[] = Array.isArray(design?.design?.lighting)
    ? design.design.lighting
    : EMPTY_SCENE;
  const ac: DesignItem[] = Array.isArray(design?.design?.airConditioning)
    ? design.design.airConditioning
    : EMPTY_SCENE;
  const inferredRooms = Array.isArray(analysis?.inferredRooms)
    ? analysis.inferredRooms
    : EMPTY_SCENE;

  const bounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    walls.forEach((w: any) => {
      minX = Math.min(minX, Number(w.x1), Number(w.x2));
      maxX = Math.max(maxX, Number(w.x1), Number(w.x2));
      minY = Math.min(minY, Number(w.y1), Number(w.y2));
      maxY = Math.max(maxY, Number(w.y1), Number(w.y2));
    });
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 12, maxY: 12 };
    return { minX, minY, maxX, maxY };
  }, [walls]);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const center = useMemo(() => new THREE.Vector3(cx, 0, -cy), [cx, cy]);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(window.matchMedia("(max-width: 800px)").matches);
  }, []);

  const openingByWall = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const o of openings) {
      const arr = map.get(o.wallEntityId) || [];
      arr.push(o);
      map.set(o.wallEntityId, arr);
    }
    return map;
  }, [openings]);

  function itemPos(item: DesignItem): [number, number, number] {
    const x =
      bounds.minX +
      (Math.max(0, Math.min(1000, item.planX)) / 1000) *
        (bounds.maxX - bounds.minX);
    const y =
      bounds.maxY -
      (Math.max(0, Math.min(1000, item.planY)) / 1000) *
        (bounds.maxY - bounds.minY);
    return [x, 0.02, -y];
  }

  const camera = useMemo(
    () =>
      mode === "tour"
        ? {
            position: [cx, 1.62, -bounds.minY + 1.5] as [
              number,
              number,
              number,
            ],
            fov: 60,
          }
        : {
            position: [
              cx + size * 0.72,
              Math.max(7, size * 0.58),
              -cy + size * 0.72,
            ] as [number, number, number],
            fov: 45,
          },
    [mode, cx, cy, size, bounds.minY],
  );

  return (
    <div className={`real3dCanvas ${mode}`}>
      <Canvas
        camera={camera}
        onPointerMissed={() => onSelect?.(null)}
        shadows={!mobile}
        dpr={mobile ? 1 : [1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#ebe7df");
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={[night ? "#303938" : "#ebe7df"]} />
        <fog
          attach="fog"
          args={[
            night ? "#303938" : "#ebe7df",
            Math.max(30, size * 1.8),
            Math.max(58, size * 3.6),
          ]}
        />
        <hemisphereLight
          intensity={night ? 0.35 : 1.5}
          color="#fff9ee"
          groundColor="#7c7368"
        />
        <directionalLight
          castShadow={!mobile}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-size}
          shadow-camera-right={size}
          shadow-camera-top={size}
          shadow-camera-bottom={-size}
          shadow-bias={-0.0005}
          position={[cx + 8, 18, -cy + 6]}
          intensity={night ? 0.45 : 2.4}
          color={night ? "#9daecc" : "#fff5e4"}
        />
        <mesh receiveShadow position={[cx, -0.08, -cy]}>
          <boxGeometry
            args={[
              Math.max(4, bounds.maxX - bounds.minX + 2),
              0.12,
              Math.max(4, bounds.maxY - bounds.minY + 2),
            ]}
          />
          <meshStandardMaterial color="#c8bcae" roughness={0.9} />
        </mesh>

        {inferredRooms.map((room: any, i: number) => {
          const points = Array.isArray(room?.polygon) ? room.polygon : [];
          if (points.length < 3) return null;
          const shape = new THREE.Shape();
          shape.moveTo(Number(points[0].x), Number(points[0].y));
          for (let j = 1; j < points.length; j++)
            shape.lineTo(Number(points[j].x), Number(points[j].y));
          shape.closePath();
          return (
            <mesh
              receiveShadow
              key={room.id || i}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.015, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.({
                  type: "floor",
                  category: "أرضية / فراغ",
                  name: room.name || "غرفة " + String(i + 1),
                  areaM2: Number(room.areaM2) || 0,
                  perimeterM: Number(room.perimeterM) || 0,
                  material: "البلاط والخامة تحدد بعد التصميم",
                  source: "Bayti Topology",
                });
              }}
            >
              <shapeGeometry args={[shape]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#d6cbbb" : "#c9bca7"}
                roughness={0.95}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}

        {walls.map((w: any) => (
          <WallMesh
            walking={mode === "tour"}
            key={w.entityId}
            wall={w}
            openings={openingByWall.get(w.entityId) || []}
            onSelect={onSelect || (() => {})}
          />
        ))}
        {[...items, ...lights, ...ac].map((item, i) => (
          <Furniture
            key={`${item.category}-${item.name}-${i}`}
            item={item}
            position={itemPos(item)}
            onSelect={onSelect || (() => {})}
          />
        ))}

        <SceneNavigation
          mode={mode}
          autoplay={autoplay}
          activeRoom={activeRoom}
          rooms={inferredRooms}
          center={center}
          size={size}
          walls={walls}
          openings={openings}
          items={items}
          bounds={bounds}
          command={command}
          walkInput={walkInput}
          lookToWalk={lookToWalk}
          onRoomChange={onRoomChange}
          onNotice={onNotice}
        />
      </Canvas>
    </div>
  );
}
