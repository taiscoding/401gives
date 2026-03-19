"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

// Terrain mesh (just the top surface, no side walls or water plane box)
function TerrainMesh() {
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

      if (isInsideRI(x, z)) {
        const h = elevation(x, z);
        // Slight base lift so terrain floats above y=0
        pos.setY(i, h * 6 + 1.5);
        const [r, g, b] = color(h);
        cols[i * 3] = r;
        cols[i * 3 + 1] = g;
        cols[i * 3 + 2] = b;
      } else {
        // Flush with y=0, black, invisible on black bg
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

  return (
    <mesh ref={ref} geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.7} metalness={0.05} />
    </mesh>
  );
}

// Animated breathing background gradient (like 24hrfreemusic)
function AnimatedBackground() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const shader = useMemo(() => ({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        // Slow breathing color shifts
        float t = uTime * 0.08;

        // Deep dark base with subtle color movement
        vec3 col1 = vec3(0.01, 0.02, 0.04); // near black blue
        vec3 col2 = vec3(0.02, 0.01, 0.03); // near black purple
        vec3 col3 = vec3(0.01, 0.03, 0.03); // near black teal

        // Blend between colors based on time
        float blend1 = sin(t) * 0.5 + 0.5;
        float blend2 = sin(t * 0.7 + 1.5) * 0.5 + 0.5;

        vec3 base = mix(mix(col1, col2, blend1), col3, blend2);

        // Radial gradient: lighter in center where RI sits
        float dist = length(vUv - vec2(0.5, 0.45));
        float vignette = 1.0 - smoothstep(0.0, 0.7, dist);

        // Subtle glow around center
        vec3 glow = vec3(0.01, 0.04, 0.05) * vignette * 0.5;

        gl_FragColor = vec4(base + glow, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
    },
  }), []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={shader.vertexShader}
        fragmentShader={shader.fragmentShader}
        uniforms={shader.uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// ─── Props ──────────────────────────────────────────────────────

interface RhodeIslandTerrainProps {
  cities?: CityData[];
  nonprofits?: NonprofitData[];
  explorationLevel?: ExplorationLevel;
  activeCause?: string;
  onCityClick?: (city: string, county: string) => void;
  onNonprofitClick?: (slug: string) => void;
}

export default function RhodeIslandTerrain({
  cities = [],
  nonprofits = [],
  explorationLevel = "overview",
  activeCause = "",
  onCityClick,
  onNonprofitClick,
}: RhodeIslandTerrainProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <Canvas
        camera={{
          position: [0, 130, 65],
          fov: 45,
          near: 0.1,
          far: 800,
        }}
        gl={{ antialias: true }}
      >
        {/* Animated breathing background */}
        <AnimatedBackground />

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
          maxPolarAngle={Math.PI / 3}
          minPolarAngle={Math.PI / 8}
          enablePan={true}
          panSpeed={0.5}
          autoRotate={false}
          enableRotate={true}
          rotateSpeed={0.4}
        />

        <TerrainMesh />

        {/* County nodes at overview, city dots after county selected */}
        {(explorationLevel === "overview" || explorationLevel === "city") && cities.length > 0 && onCityClick && (
          <CityNodes
            cities={cities}
            onCityClick={onCityClick}
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
