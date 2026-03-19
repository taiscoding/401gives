"use client";

import { useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { getCauseColor } from "@/data/cause-categories";
import type { NonprofitData } from "@/hooks/useExploration";

// Geo conversion (must match RhodeIslandTerrain.tsx)
const CENTER_LNG = -71.4774;
const CENTER_LAT = 41.5801;
const S = 150;

function geo(lng: number, lat: number): [number, number] {
  return [
    (lng - CENTER_LNG) * S * Math.cos((CENTER_LAT * Math.PI) / 180),
    (lat - CENTER_LAT) * S,
  ];
}

// Elevation function (copied from RhodeIslandTerrain.tsx)
function elevation(x: number, z: number): number {
  const nx = (x + 43) / 72;
  const nz = (z + 39) / 105;
  let h = (1 - nx) * 0.4;
  const nwDist = Math.sqrt((nx - 0.15) ** 2 + (nz - 0.8) ** 2);
  h += Math.max(0, 0.35 - nwDist * 1.0);
  h += Math.max(0, 0.12 - Math.abs(nx - 0.35) * 0.6);
  const bayWidth = 0.08 + (1 - nz) * 0.1;
  const bayDist = Math.abs(nx - 0.58);
  if (bayDist < bayWidth && nz < 0.7) {
    h -= (1 - bayDist / bayWidth) * 0.35 * (0.4 + (1 - nz) * 0.6);
  }
  if (Math.abs(nx - 0.52) < 0.03 && nz > 0.6 && nz < 0.85) {
    h -= 0.15 * (1 - Math.abs(nx - 0.52) / 0.03);
  }
  if (nz < 0.12) h *= nz / 0.12;
  h += Math.sin(x * 0.12) * Math.cos(z * 0.1) * 0.04;
  h += Math.sin(x * 0.06 + z * 0.05) * 0.025;
  return Math.max(-0.1, Math.min(0.7, h));
}

// ─── Single Nonprofit Pin ───────────────────────────────────────

interface PinProps {
  nonprofit: NonprofitData;
  position: [number, number, number];
  color: string;
  onClick: () => void;
}

function NonprofitPin({ nonprofit, position, color, onClick }: PinProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (meshRef.current) {
      const scale = hovered ? 1.5 : 1.0;
      meshRef.current.scale.lerp(
        new THREE.Vector3(scale, scale, scale),
        0.12
      );
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.9 : 0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Hover label */}
      {hovered && (
        <Html
          position={[0, 1.2, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: "9px",
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textAlign: "center",
              whiteSpace: "nowrap",
              background: "rgba(0,0,0,0.8)",
              padding: "4px 8px",
              borderRadius: 3,
              border: `1px solid ${color}40`,
            }}
          >
            {nonprofit.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Nonprofit Pins Container ───────────────────────────────────

interface NonprofitPinsProps {
  nonprofits: NonprofitData[];
  cause: string;
  onNonprofitClick: (slug: string) => void;
}

export default function NonprofitPins({
  nonprofits,
  cause,
  onNonprofitClick,
}: NonprofitPinsProps) {
  const causeColor = getCauseColor(cause);

  const pins = useMemo(() => {
    return nonprofits.map((np) => {
      const [x, z] = geo(np.lng, np.lat);
      const y = elevation(x, z) * 6 + 1.5 + 0.6; // terrain height + small float
      return {
        nonprofit: np,
        position: [x, y, z] as [number, number, number],
      };
    });
  }, [nonprofits]);

  return (
    <group>
      {pins.map((pin) => (
        <NonprofitPin
          key={pin.nonprofit.slug}
          nonprofit={pin.nonprofit}
          position={pin.position}
          color={causeColor}
          onClick={() => onNonprofitClick(pin.nonprofit.slug)}
        />
      ))}
    </group>
  );
}
