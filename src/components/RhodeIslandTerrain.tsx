"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Convert geo coords to local 3D space
const CENTER_LNG = -71.4774;
const CENTER_LAT = 41.5801;
const S = 150; // scale

function geo(lng: number, lat: number): [number, number] {
  return [
    (lng - CENTER_LNG) * S * Math.cos(CENTER_LAT * Math.PI / 180),
    (lat - CENTER_LAT) * S,
  ];
}

// RI mainland boundary
const MAINLAND = [
  [-71.86, 41.32], [-71.80, 41.41], [-71.80, 42.01],
  [-71.53, 42.02], [-71.38, 42.02], [-71.33, 41.78],
  [-71.22, 41.71], [-71.34, 41.73], [-71.45, 41.58],
  [-71.48, 41.37], [-71.86, 41.32],
].map(([a, b]) => geo(a, b));

// Aquidneck Island
const AQUIDNECK = [
  [-71.20, 41.68], [-71.12, 41.50], [-71.32, 41.47], [-71.20, 41.68],
].map(([a, b]) => geo(a, b));

function pip(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function elevation(x: number, z: number): number {
  // Normalize to 0-1 within RI bounds (x: -43..29, z: -39..66)
  const nx = (x + 43) / 72;
  const nz = (z + 39) / 105;

  // RI is FLAT. Highest point is 812ft. Gentle rolling terrain.
  // Base: very gentle western slope (west side slightly higher)
  let h = (1 - nx) * 0.3;

  // NW gentle hills (Foster, Glocester area, highest terrain)
  const nwDist = Math.sqrt((nx - 0.15) ** 2 + (nz - 0.8) ** 2);
  h += Math.max(0, 0.2 - nwDist * 0.8);

  // Narragansett Bay (the defining feature, cuts deep into state)
  const bayCenter = 0.58;
  const bayWidth = 0.08 + (1 - nz) * 0.1;
  const bayDist = Math.abs(nx - bayCenter);
  if (bayDist < bayWidth && nz < 0.7) {
    const bayDepth = (1 - bayDist / bayWidth);
    h -= bayDepth * 0.35 * (0.4 + (1 - nz) * 0.6);
  }

  // Providence River (narrow, heading north into Providence)
  const riverDist = Math.abs(nx - 0.52);
  if (riverDist < 0.03 && nz > 0.6 && nz < 0.85) {
    h -= 0.15 * (1 - riverDist / 0.03);
  }

  // Coastal areas taper to sea level
  if (nz < 0.1) h *= nz / 0.1;

  // Very gentle, low-frequency noise (no visible ripples)
  h += Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.03;
  h += Math.sin(x * 0.08 + z * 0.06) * 0.02;

  return Math.max(-0.08, Math.min(0.6, h));
}

function color(h: number): [number, number, number] {
  // Vibrant game-world palette
  if (h < -0.02) return [0.02, 0.08, 0.15];  // deep water
  if (h < 0.03) return [0.04, 0.14, 0.22];   // shallow water
  if (h < 0.08) return [0.12, 0.28, 0.18];   // beach/wetland
  if (h < 0.15) return [0.10, 0.35, 0.15];   // coastal lowland
  if (h < 0.25) return [0.13, 0.42, 0.18];   // low green
  if (h < 0.35) return [0.16, 0.50, 0.20];   // meadow
  if (h < 0.45) return [0.20, 0.55, 0.22];   // forest
  if (h < 0.55) return [0.26, 0.58, 0.24];   // dense forest
  if (h < 0.65) return [0.35, 0.60, 0.26];   // upland
  if (h < 0.75) return [0.45, 0.62, 0.28];   // high hills
  if (h < 0.85) return [0.55, 0.60, 0.30];   // ridge
  return [0.65, 0.58, 0.32];                  // peak (warm amber)
}

function Terrain() {
  const ref = useRef<THREE.Mesh>(null!);

  const geometry = useMemo(() => {
    const seg = 300;
    const geo = new THREE.PlaneGeometry(100, 140, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      if (pip(x, z, MAINLAND as [number, number][]) || pip(x, z, AQUIDNECK as [number, number][])) {
        const h = elevation(x, z);
        pos.setY(i, h * 8);
        const [r, g, b] = color(h);
        cols[i * 3] = r;
        cols[i * 3 + 1] = g;
        cols[i * 3 + 2] = b;
      } else {
        // Keep flat at y=0, invisible against black background
        pos.setY(i, 0);
        cols[i * 3] = 0;
        cols[i * 3 + 1] = 0;
        cols[i * 3 + 2] = 0;
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.08) * 0.02;
    }
  });

  return (
    <mesh ref={ref} geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

export default function RhodeIslandTerrain() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <Canvas
        camera={{ position: [0, 160, 40], fov: 50, near: 0.1, far: 800 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[40, 60, 30]} intensity={1.8} color="#fff5e6" castShadow />
        <directionalLight position={[-30, 40, -20]} intensity={0.4} color="#22d3ee" />
        <pointLight position={[0, -8, 10]} intensity={0.4} color="#22d3ee" distance={100} />
        <pointLight position={[-20, 15, 40]} intensity={0.2} color="#f59e0b" distance={80} />
        <OrbitControls
          target={[0, 0, 10]}
          enableDamping
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={200}
          autoRotate
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI / 2.2}
          enablePan={false}
        />
        <Terrain />
      </Canvas>
    </div>
  );
}
