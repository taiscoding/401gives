"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Convert geo coords to local 3D space
const CENTER_LNG = -71.4774;
const CENTER_LAT = 41.5801;
const S = 150;

function geo(lng: number, lat: number): [number, number] {
  return [
    (lng - CENTER_LNG) * S * Math.cos(CENTER_LAT * Math.PI / 180),
    (lat - CENTER_LAT) * S,
  ];
}

// More detailed RI mainland boundary
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

// Aquidneck Island (more points)
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

// Conanicut Island (Jamestown)
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

  // More dramatic for game-world feel (exaggerated but plausible)
  let h = (1 - nx) * 0.4;

  // NW highlands
  const nwDist = Math.sqrt((nx - 0.15) ** 2 + (nz - 0.8) ** 2);
  h += Math.max(0, 0.35 - nwDist * 1.0);

  // Central gentle ridge
  h += Math.max(0, 0.12 - Math.abs(nx - 0.35) * 0.6);

  // Narragansett Bay depression
  const bayWidth = 0.08 + (1 - nz) * 0.1;
  const bayDist = Math.abs(nx - 0.58);
  if (bayDist < bayWidth && nz < 0.7) {
    h -= (1 - bayDist / bayWidth) * 0.35 * (0.4 + (1 - nz) * 0.6);
  }

  // Providence River
  if (Math.abs(nx - 0.52) < 0.03 && nz > 0.6 && nz < 0.85) {
    h -= 0.15 * (1 - Math.abs(nx - 0.52) / 0.03);
  }

  // South coast taper
  if (nz < 0.12) h *= nz / 0.12;

  // Gentle rolling noise
  h += Math.sin(x * 0.12) * Math.cos(z * 0.1) * 0.04;
  h += Math.sin(x * 0.06 + z * 0.05) * 0.025;

  return Math.max(-0.1, Math.min(0.7, h));
}

// Rich game-world color palette
function color(h: number): [number, number, number] {
  if (h < -0.03) return [0.03, 0.10, 0.18];  // deep water
  if (h < 0.02) return [0.05, 0.16, 0.25];   // shallow
  if (h < 0.08) return [0.08, 0.30, 0.16];   // wetland
  if (h < 0.15) return [0.11, 0.38, 0.15];   // lowland
  if (h < 0.22) return [0.14, 0.45, 0.17];   // meadow
  if (h < 0.30) return [0.17, 0.52, 0.19];   // field
  if (h < 0.38) return [0.20, 0.56, 0.21];   // forest
  if (h < 0.46) return [0.25, 0.58, 0.23];   // dense forest
  if (h < 0.54) return [0.32, 0.60, 0.25];   // upland
  if (h < 0.62) return [0.42, 0.60, 0.27];   // high
  return [0.55, 0.58, 0.30];                  // peak
}

// The terrain surface
function TerrainSurface() {
  const ref = useRef<THREE.Group>(null!);

  const { topGeo, sideGeo, waterGeo } = useMemo(() => {
    const seg = 300;
    const top = new THREE.PlaneGeometry(100, 140, seg, seg);
    top.rotateX(-Math.PI / 2);

    const pos = top.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const BASE_HEIGHT = 3; // thickness of the island "slab"

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const inside = isInsideRI(x, z);

      if (inside) {
        const h = elevation(x, z);
        pos.setY(i, h * 10 + BASE_HEIGHT);
        const [r, g, b] = color(h);
        cols[i * 3] = r;
        cols[i * 3 + 1] = g;
        cols[i * 3 + 2] = b;
      } else {
        pos.setY(i, -50); // far below, invisible
        cols[i * 3] = 0;
        cols[i * 3 + 1] = 0;
        cols[i * 3 + 2] = 0;
      }
    }

    top.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    top.computeVertexNormals();

    // Create the extruded side walls using a Shape
    const createSideWalls = (polygon: [number, number][]): THREE.BufferGeometry => {
      const vertices: number[] = [];
      const colors: number[] = [];

      for (let i = 0; i < polygon.length; i++) {
        const [x1, z1] = polygon[i];
        const [x2, z2] = polygon[(i + 1) % polygon.length];
        const h1 = elevation(x1, z1) * 10 + BASE_HEIGHT;
        const h2 = elevation(x2, z2) * 10 + BASE_HEIGHT;
        const bottom = -1;

        // Two triangles per wall segment
        vertices.push(x1, h1, z1, x2, h2, z2, x1, bottom, z1);
        vertices.push(x2, h2, z2, x2, bottom, z2, x1, bottom, z1);

        // Dark side color (subtle gradient)
        const sideColor = [0.06, 0.08, 0.10];
        const bottomColor = [0.02, 0.03, 0.04];
        for (let t = 0; t < 2; t++) {
          colors.push(...sideColor, ...sideColor, ...bottomColor);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    };

    // Combine side walls for all landmasses
    const sides: THREE.BufferGeometry[] = [
      createSideWalls(MAINLAND),
      createSideWalls(AQUIDNECK),
      createSideWalls(CONANICUT),
    ];

    // Water plane (sits at the bay level inside RI)
    const water = new THREE.PlaneGeometry(100, 140, 1, 1);
    water.rotateX(-Math.PI / 2);
    water.translate(0, BASE_HEIGHT - 0.3, 0); // just below land surface

    return {
      topGeo: top,
      sideGeo: sides,
      waterGeo: water,
    };
  }, []);

  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.06) * 0.015;
    }
  });

  return (
    <group ref={ref}>
      {/* Top terrain surface */}
      <mesh geometry={topGeo}>
        <meshStandardMaterial
          vertexColors
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* Extruded side walls */}
      {sideGeo.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial
            vertexColors
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
      ))}

      {/* Water plane (visible through bay and around islands) */}
      <mesh geometry={waterGeo}>
        <meshStandardMaterial
          color="#0a2a3a"
          roughness={0.2}
          metalness={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Subtle edge glow ring at base */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[70, 72, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

export default function RhodeIslandTerrain() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <Canvas
        camera={{ position: [20, 120, 100], fov: 45, near: 0.1, far: 800 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#000000"]} />

        {/* Lighting */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[50, 80, 30]} intensity={2.0} color="#fff5e6" />
        <directionalLight position={[-30, 40, -20]} intensity={0.5} color="#22d3ee" />
        {/* Underside rim light for floating effect */}
        <pointLight position={[0, -5, 10]} intensity={0.5} color="#22d3ee" distance={120} />
        <pointLight position={[-25, 20, 50]} intensity={0.25} color="#f59e0b" distance={100} />

        <OrbitControls
          target={[-5, 2, 12]}
          enableDamping
          dampingFactor={0.05}
          minDistance={30}
          maxDistance={250}
          autoRotate
          autoRotateSpeed={0.3}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 8}
          enablePan={false}
        />

        <TerrainSurface />

        <fog attach="fog" args={["#000000", 180, 400]} />
      </Canvas>
    </div>
  );
}
