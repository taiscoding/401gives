"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CityNodes from "./CityNodes";
import NonprofitPins from "./NonprofitPins";
import type { CityData, NonprofitData, ExplorationLevel } from "@/hooks/useExploration";

// Geo conversion
const CENTER_LNG = -71.4774;
const CENTER_LAT = 41.5801;
const S = 150;

function geo(lng: number, lat: number): [number, number] {
  return [
    (lng - CENTER_LNG) * S * Math.cos(CENTER_LAT * Math.PI / 180),
    (lat - CENTER_LAT) * S,
  ];
}

// Detailed RI mainland boundary
const MAINLAND = [
  [-71.862, 41.321], [-71.833, 41.345], [-71.812, 41.370],
  [-71.800, 41.395], [-71.799, 41.415], [-71.799, 41.460],
  [-71.799, 41.510], [-71.799, 41.560], [-71.799, 41.620],
  [-71.799, 41.680], [-71.799, 41.740], [-71.799, 41.800],
  [-71.799, 41.860], [-71.799, 41.920], [-71.799, 41.970],
  [-71.799, 42.006], [-71.770, 42.012], [-71.730, 42.015],
  [-71.690, 42.017], [-71.640, 42.017], [-71.590, 42.017],
  [-71.531, 42.017], [-71.480, 42.017], [-71.430, 42.017],
  [-71.383, 42.017], [-71.382, 41.995], [-71.381, 41.970],
  [-71.380, 41.940], [-71.370, 41.910], [-71.355, 41.890],
  [-71.342, 41.870], [-71.338, 41.845], [-71.335, 41.820],
  [-71.330, 41.795], [-71.328, 41.782], [-71.310, 41.765],
  [-71.285, 41.752], [-71.260, 41.742], [-71.240, 41.725],
  [-71.224, 41.710], [-71.245, 41.730], [-71.270, 41.745],
  [-71.295, 41.755], [-71.317, 41.756], [-71.335, 41.740],
  [-71.345, 41.727], [-71.360, 41.715], [-71.375, 41.700],
  [-71.388, 41.685], [-71.395, 41.665], [-71.398, 41.645],
  [-71.405, 41.625], [-71.418, 41.608], [-71.435, 41.592],
  [-71.449, 41.579], [-71.455, 41.555], [-71.460, 41.530],
  [-71.465, 41.500], [-71.470, 41.470], [-71.475, 41.440],
  [-71.478, 41.410], [-71.480, 41.385], [-71.482, 41.371],
  [-71.505, 41.355], [-71.535, 41.342], [-71.565, 41.332],
  [-71.600, 41.322], [-71.640, 41.318], [-71.680, 41.316],
  [-71.720, 41.316], [-71.760, 41.318], [-71.800, 41.319],
  [-71.835, 41.320], [-71.860, 41.322], [-71.862, 41.321],
].map(([a, b]) => geo(a, b));

const AQUIDNECK = [
  [-71.285, 41.640], [-71.268, 41.630], [-71.250, 41.615],
  [-71.235, 41.595], [-71.222, 41.575], [-71.212, 41.555],
  [-71.205, 41.530], [-71.200, 41.510], [-71.197, 41.497],
  [-71.205, 41.480], [-71.218, 41.472], [-71.240, 41.470],
  [-71.265, 41.472], [-71.290, 41.475], [-71.310, 41.480],
  [-71.317, 41.497], [-71.316, 41.520], [-71.314, 41.545],
  [-71.310, 41.570], [-71.305, 41.595], [-71.298, 41.618],
  [-71.290, 41.632], [-71.285, 41.640],
].map(([a, b]) => geo(a, b));

const CONANICUT = [
  [-71.380, 41.530], [-71.370, 41.515], [-71.362, 41.498],
  [-71.358, 41.480], [-71.360, 41.462], [-71.370, 41.455],
  [-71.385, 41.458], [-71.395, 41.468], [-71.400, 41.488],
  [-71.398, 41.508], [-71.392, 41.522], [-71.380, 41.530],
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

function isInsideRI(x: number, z: number): boolean {
  return pip(x, z, MAINLAND) || pip(x, z, AQUIDNECK) || pip(x, z, CONANICUT);
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

function color(h: number): [number, number, number] {
  if (h < -0.03) return [0.03, 0.10, 0.18];
  if (h < 0.02) return [0.05, 0.16, 0.25];
  if (h < 0.08) return [0.08, 0.30, 0.16];
  if (h < 0.15) return [0.11, 0.38, 0.15];
  if (h < 0.22) return [0.14, 0.45, 0.17];
  if (h < 0.30) return [0.17, 0.52, 0.19];
  if (h < 0.38) return [0.20, 0.56, 0.21];
  if (h < 0.46) return [0.25, 0.58, 0.23];
  if (h < 0.54) return [0.32, 0.60, 0.25];
  if (h < 0.62) return [0.42, 0.60, 0.27];
  return [0.55, 0.58, 0.30];
}

// Terrain chip: top surface with elevation + thin side walls + flat bottom
const CHIP_THICKNESS = 0.8; // thin chip, like a coin

function TerrainMesh() {
  const ref = useRef<THREE.Group>(null!);

  const { topGeo, sideGeo, bottomGeo } = useMemo(() => {
    // --- TOP SURFACE ---
    const seg = 300;
    const top = new THREE.PlaneGeometry(100, 140, seg, seg);
    top.rotateX(-Math.PI / 2);

    const pos = top.attributes.position;
    const cols = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      if (isInsideRI(x, z)) {
        const h = elevation(x, z);
        pos.setY(i, h * 1.2 + CHIP_THICKNESS);
        const [r, g, b] = color(h);
        cols[i * 3] = r;
        cols[i * 3 + 1] = g;
        cols[i * 3 + 2] = b;
      } else {
        pos.setX(i, 0);
        pos.setY(i, -100);
        pos.setZ(i, 0);
        cols[i * 3] = 0;
        cols[i * 3 + 1] = 0;
        cols[i * 3 + 2] = 0;
      }
    }

    top.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    top.computeVertexNormals();

    // --- SIDE WALLS ---
    const createWalls = (polygon: [number, number][]): THREE.BufferGeometry => {
      const verts: number[] = [];
      const wallCols: number[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const [x1, z1] = polygon[i];
        const [x2, z2] = polygon[(i + 1) % polygon.length];
        const h1 = elevation(x1, z1) * 1.2 + CHIP_THICKNESS;
        const h2 = elevation(x2, z2) * 1.2 + CHIP_THICKNESS;
        // Two triangles: top-edge to bottom (y=0)
        verts.push(x1, h1, z1, x2, h2, z2, x1, 0, z1);
        verts.push(x2, h2, z2, x2, 0, z2, x1, 0, z1);
        // Dark side color
        const sc = [0.04, 0.06, 0.08];
        const bc = [0.02, 0.03, 0.04];
        wallCols.push(...sc, ...sc, ...bc, ...sc, ...bc, ...bc);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(wallCols, 3));
      g.computeVertexNormals();
      return g;
    };

    const sides = [
      createWalls(MAINLAND),
      createWalls(AQUIDNECK),
      createWalls(CONANICUT),
    ];

    // Merge side geometries
    const merged = new THREE.BufferGeometry();
    const allVerts: number[] = [];
    const allCols: number[] = [];
    for (const s of sides) {
      const p = s.attributes.position;
      const c = s.attributes.color;
      for (let i = 0; i < p.count; i++) {
        allVerts.push(p.getX(i), p.getY(i), p.getZ(i));
        allCols.push(c.getX(i), c.getY(i), c.getZ(i));
      }
    }
    merged.setAttribute("position", new THREE.Float32BufferAttribute(allVerts, 3));
    merged.setAttribute("color", new THREE.Float32BufferAttribute(allCols, 3));
    merged.computeVertexNormals();

    // --- BOTTOM FACE (flat, dark) ---
    const bottom = new THREE.PlaneGeometry(100, 140, seg, seg);
    bottom.rotateX(Math.PI / 2); // face down
    const bPos = bottom.attributes.position;
    const bCols = new Float32Array(bPos.count * 3);
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i);
      const z = bPos.getZ(i);
      if (isInsideRI(x, z)) {
        bPos.setY(i, 0);
        bCols[i * 3] = 0.02;
        bCols[i * 3 + 1] = 0.03;
        bCols[i * 3 + 2] = 0.04;
      } else {
        bPos.setX(i, 0);
        bPos.setY(i, -100);
        bPos.setZ(i, 0);
        bCols[i * 3] = 0;
        bCols[i * 3 + 1] = 0;
        bCols[i * 3 + 2] = 0;
      }
    }
    bottom.setAttribute("color", new THREE.BufferAttribute(bCols, 3));
    bottom.computeVertexNormals();

    return { topGeo: top, sideGeo: merged, bottomGeo: bottom };
  }, []);

  return (
    <group ref={ref}>
      <mesh geometry={topGeo}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh geometry={sideGeo}>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
      </mesh>
      <mesh geometry={bottomGeo}>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

// Background is now CSS (sky gradient), Canvas is transparent

// ─── Props ──────────────────────────────────────────────────────

interface RhodeIslandTerrainProps {
  cities?: CityData[];
  nonprofits?: NonprofitData[];
  explorationLevel?: ExplorationLevel;
  activeCounty?: string;
  activeCause?: string;
  onCountyClick?: (county: string) => void;
  onCityClick?: (city: string, county: string) => void;
  onNonprofitClick?: (slug: string) => void;
}

export default function RhodeIslandTerrain({
  cities = [],
  nonprofits = [],
  explorationLevel = "overview",
  activeCounty = "",
  activeCause = "",
  onCountyClick,
  onCityClick,
  onNonprofitClick,
}: RhodeIslandTerrainProps) {
  // Filter cities to only the active county when drilled in
  const visibleCities = activeCounty
    ? cities.filter((c) => c.county === activeCounty)
    : cities;
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        camera={{
          position: [30, 100, 80],
          fov: 45,
          near: 0.1,
          far: 800,
        }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[40, 80, 30]} intensity={1.8} color="#fff5e6" />
        <directionalLight position={[-30, 50, -20]} intensity={0.4} color="#22d3ee" />
        <pointLight position={[0, -5, 10]} intensity={0.3} color="#22d3ee" distance={100} />

        {/* Map-style controls: look down, limited tilt, pan and zoom */}
        <OrbitControls
          target={[-5, 0, 12]}
          enableDamping
          dampingFactor={0.08}
          minDistance={40}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 8}
          enablePan={true}
          panSpeed={0.5}
          autoRotate
          autoRotateSpeed={0.3}
          enableRotate={true}
          rotateSpeed={0.4}
        />

        <TerrainMesh />

        {/* County nodes at overview, city dots after county selected */}
        {(explorationLevel === "overview" || explorationLevel === "city") && cities.length > 0 && onCityClick && (
          <CityNodes
            cities={explorationLevel === "city" ? visibleCities : cities}
            onCityClick={onCityClick}
            onCountyClick={onCountyClick}
            mode={explorationLevel === "overview" ? "counties" : "cities"}
          />
        )}

        {/* Nonprofit pins: visible at cause or nonprofit level */}
        {(explorationLevel === "cause" || explorationLevel === "nonprofit") &&
          nonprofits.length > 0 &&
          onNonprofitClick && (
            <NonprofitPins
              nonprofits={nonprofits}
              cause={activeCause}
              onNonprofitClick={onNonprofitClick}
            />
          )}
      </Canvas>
    </div>
  );
}
