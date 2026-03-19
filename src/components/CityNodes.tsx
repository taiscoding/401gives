"use client";

import { useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { CityData } from "@/hooks/useExploration";
import { COUNTY_CENTERS } from "@/data/ri-counties";

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

// ─── County Node (overview level) ──────────────────────────────

interface CountyNodeProps {
  name: string;
  count: number;
  position: [number, number, number];
  onClick: () => void;
}

function CountyNode({ name, count, position, onClick }: CountyNodeProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      const s = hovered ? 1.3 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
    }
    if (glowRef.current) {
      const pulse = 0.15 + Math.sin(state.clock.elapsedTime * 1.5 + position[0] * 0.1) * 0.08;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = hovered ? 0.3 : pulse;
    }
  });

  const size = 1.5 + Math.log(count + 1) * 0.5;

  return (
    <group position={position}>
      {/* Glow disc on terrain */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <circleGeometry args={[size * 1.8, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Main dot */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size * 0.4, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? "#ffffff" : "#22d3ee"}
          emissive="#22d3ee"
          emissiveIntensity={hovered ? 1.0 : 0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Label: always visible for counties (only 5) */}
      <Html position={[0, size * 0.6 + 1, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{
          fontFamily: '"Sohne Mono", monospace',
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          textAlign: "center",
          whiteSpace: "nowrap",
          transition: "all 0.3s",
          opacity: hovered ? 1 : 0.7,
        }}>
          <div style={{
            fontSize: "11px",
            fontWeight: 600,
            color: hovered ? "#22d3ee" : "#ffffff",
          }}>
            {name}
          </div>
          <div style={{
            fontSize: "9px",
            color: hovered ? "#22d3ee" : "rgba(255,255,255,0.4)",
            marginTop: "2px",
          }}>
            {count}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── City Dot (after county is selected) ────────────────────────

interface CityDotProps {
  name: string;
  count: number;
  position: [number, number, number];
  onClick: () => void;
}

function CityDot({ name, count, position, onClick }: CityDotProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null!);

  const size = 0.3 + Math.log(count + 1) * 0.2;

  useFrame(() => {
    if (meshRef.current) {
      const s = hovered ? 1.4 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.12);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial
          color={hovered ? "#ffffff" : "#22d3ee"}
          emissive="#22d3ee"
          emissiveIntensity={hovered ? 0.8 : 0.3}
        />
      </mesh>

      {/* Label: only on hover */}
      {hovered && (
        <Html position={[0, size + 1, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{
            fontFamily: '"Sohne Mono", monospace',
            fontSize: "10px",
            fontWeight: 600,
            color: "#22d3ee",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}>
            <div>{name}</div>
            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)", marginTop: "1px" }}>
              {count}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Container ──────────────────────────────────────────────────

interface CityNodesProps {
  cities: CityData[];
  onCityClick: (city: string, county: string) => void;
  mode?: "counties" | "cities";
}

export default function CityNodes({ cities, onCityClick, mode = "counties" }: CityNodesProps) {
  // Group cities by county for overview mode
  const countyData = useMemo(() => {
    const map = new Map<string, { count: number; cities: CityData[] }>();
    for (const city of cities) {
      const existing = map.get(city.county) || { count: 0, cities: [] };
      existing.count += city.count;
      existing.cities.push(city);
      map.set(city.county, existing);
    }

    return Array.from(map.entries()).map(([county, data]) => {
      const center = COUNTY_CENTERS[county];
      if (!center) return null;
      const [x, z] = geo(center.lng, center.lat);
      const y = elevation(x, z) * 6 + 1.5 + 2;
      return { name: county, count: data.count, position: [x, y, z] as [number, number, number], cities: data.cities };
    }).filter(Boolean) as { name: string; count: number; position: [number, number, number]; cities: CityData[] }[];
  }, [cities]);

  // City positions (for city-level view)
  const cityPositions = useMemo(() => {
    return cities.map((city) => {
      const [x, z] = geo(city.lng, city.lat);
      const y = elevation(x, z) * 6 + 1.5 + 0.8;
      return { ...city, position: [x, y, z] as [number, number, number] };
    });
  }, [cities]);

  if (mode === "counties") {
    return (
      <group>
        {countyData.map((county) => (
          <CountyNode
            key={county.name}
            name={county.name}
            count={county.count}
            position={county.position}
            onClick={() => {
              // Click county = select the largest city in that county
              const largest = county.cities.sort((a, b) => b.count - a.count)[0];
              if (largest) onCityClick(largest.name, county.name);
            }}
          />
        ))}
      </group>
    );
  }

  return (
    <group>
      {cityPositions.map((city) => (
        <CityDot
          key={city.name}
          name={city.name}
          count={city.count}
          position={city.position}
          onClick={() => onCityClick(city.name, city.county)}
        />
      ))}
    </group>
  );
}
