"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float, Line } from "@react-three/drei";
import * as THREE from "three";

// RI center and scale for coordinate conversion
const RI_CENTER = { lng: -71.4774, lat: 41.5801 };
const SCALE = 200;

// Convert lng/lat to local 3D coordinates (x, z)
function geoToLocal(lng: number, lat: number): [number, number] {
  return [
    (lng - RI_CENTER.lng) * SCALE * Math.cos((RI_CENTER.lat * Math.PI) / 180),
    (lat - RI_CENTER.lat) * SCALE,
  ];
}

// RI mainland boundary (simplified polygon)
const RI_MAINLAND: [number, number][] = [
  [-71.862772, 41.3205],
  [-71.862772, 41.3505],
  [-71.833, 41.382],
  [-71.799309, 41.414677],
  [-71.799309, 41.68],
  [-71.799309, 41.86],
  [-71.799309, 42.006186],
  [-71.791, 42.01714],
  [-71.530939, 42.01714],
  [-71.383061, 42.01714],
  [-71.381, 41.985],
  [-71.382, 41.93],
  [-71.342, 41.893],
  [-71.34, 41.862],
  [-71.34, 41.831],
  [-71.328292, 41.781632],
  [-71.265, 41.752],
  [-71.22423, 41.710431],
  [-71.258, 41.752],
  [-71.29, 41.757],
  [-71.317, 41.756],
  [-71.344723, 41.726862],
  [-71.365, 41.71],
  [-71.388, 41.695],
  [-71.39, 41.665],
  [-71.395, 41.637],
  [-71.418, 41.615],
  [-71.43, 41.598],
  [-71.448785, 41.578985],
  [-71.456, 41.543],
  [-71.462, 41.505],
  [-71.468, 41.465],
  [-71.473, 41.425],
  [-71.478, 41.39],
  [-71.481646, 41.370861],
  [-71.52, 41.348],
  [-71.575, 41.33],
  [-71.63, 41.318],
  [-71.695, 41.315],
  [-71.755, 41.317],
  [-71.81, 41.318],
  [-71.859555, 41.321569],
  [-71.862772, 41.3205],
].map(([lng, lat]) => geoToLocal(lng, lat));

// Aquidneck Island (Newport area)
const AQUIDNECK: [number, number][] = [
  [-71.285, 41.64],
  [-71.255, 41.625],
  [-71.225, 41.59],
  [-71.21, 41.555],
  [-71.2, 41.52],
  [-71.196845, 41.497],
  [-71.215, 41.477],
  [-71.24, 41.472],
  [-71.275, 41.474],
  [-71.31, 41.477],
  [-71.317338, 41.497],
  [-71.315, 41.535],
  [-71.31, 41.565],
  [-71.305, 41.595],
  [-71.295, 41.625],
  [-71.285, 41.64],
].map(([lng, lat]) => geoToLocal(lng, lat));

// Conanicut Island (Jamestown)
const CONANICUT: [number, number][] = [
  [-71.38, 41.53],
  [-71.36, 41.505],
  [-71.355, 41.48],
  [-71.36, 41.46],
  [-71.375, 41.455],
  [-71.395, 41.465],
  [-71.4, 41.49],
  [-71.395, 41.515],
  [-71.38, 41.53],
].map(([lng, lat]) => geoToLocal(lng, lat));

// Prudence Island
const PRUDENCE: [number, number][] = [
  [-71.325, 41.64],
  [-71.31, 41.615],
  [-71.305, 41.59],
  [-71.315, 41.575],
  [-71.335, 41.58],
  [-71.34, 41.605],
  [-71.335, 41.63],
  [-71.325, 41.64],
].map(([lng, lat]) => geoToLocal(lng, lat));

// Ray casting point-in-polygon check
function pointInPolygon(
  x: number,
  z: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      zi = polygon[i][1];
    const xj = polygon[j][0],
      zj = polygon[j][1];
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInsideRI(x: number, z: number): boolean {
  return (
    pointInPolygon(x, z, RI_MAINLAND) ||
    pointInPolygon(x, z, AQUIDNECK) ||
    pointInPolygon(x, z, CONANICUT) ||
    pointInPolygon(x, z, PRUDENCE)
  );
}

// Distance from point to nearest edge of polygon
function distToPolygonEdge(
  x: number,
  z: number,
  polygon: [number, number][]
): number {
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ax = polygon[j][0],
      az = polygon[j][1];
    const bx = polygon[i][0],
      bz = polygon[i][1];
    const dx = bx - ax,
      dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 === 0 ? 0 : ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx,
      pz = az + t * dz;
    const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function minDistToRI(x: number, z: number): number {
  return Math.min(
    distToPolygonEdge(x, z, RI_MAINLAND),
    distToPolygonEdge(x, z, AQUIDNECK),
    distToPolygonEdge(x, z, CONANICUT),
    distToPolygonEdge(x, z, PRUDENCE)
  );
}

// Procedural elevation for RI
function getElevation(x: number, z: number): number {
  // Normalize into 0..1 within RI bounding box (approx -30..30 x, -30..50 z)
  const nx = (x + 30) / 60;
  const nz = (z + 30) / 80;

  // Base elevation: western side is higher
  let elevation = (1 - nx) * 0.5;

  // Northwest highlands (Foster, Burrillville, Glocester)
  const hillX = nx - 0.15;
  const hillZ = nz - 0.75;
  elevation += Math.max(
    0,
    0.45 - Math.sqrt(hillX * hillX + hillZ * hillZ) * 1.3
  );

  // Jerimoth Hill area peak (812 ft, highest point)
  const jX = nx - 0.1;
  const jZ = nz - 0.68;
  elevation += Math.max(0, 0.2 - Math.sqrt(jX * jX + jZ * jZ) * 2.0);

  // Western rolling hills (Exeter, West Greenwich, Coventry)
  const westX = nx - 0.2;
  const westZ = nz - 0.5;
  elevation += Math.max(
    0,
    0.25 - Math.sqrt(westX * westX + westZ * westZ) * 0.8
  );

  // Narragansett Bay depression (center-east, cutting north from the south)
  const bayX = nx - 0.55;
  const bayWidth = 0.12 + nz * 0.08;
  if (Math.abs(bayX) < bayWidth && nz < 0.7) {
    const depth = 1 - Math.abs(bayX) / bayWidth;
    elevation -= 0.35 * depth * depth;
  }

  // Providence River valley
  const riverX = nx - 0.5;
  if (Math.abs(riverX) < 0.06 && nz > 0.6 && nz < 0.82) {
    elevation -= 0.18 * (1 - Math.abs(riverX) / 0.06);
  }

  // Southern coast is low
  if (nz < 0.25) {
    elevation *= 0.4 + nz * 2.4;
  }

  // East Bay is flatter and lower
  if (nx > 0.55 && nz > 0.3) {
    elevation *= 0.6;
  }

  // Natural noise layers for organic feel
  elevation += Math.sin(x * 0.6) * Math.cos(z * 0.4) * 0.07;
  elevation += Math.sin(x * 1.3 + z * 0.9) * 0.035;
  elevation += Math.cos(x * 0.8 - z * 1.2) * 0.04;
  elevation += Math.sin(x * 2.5 + z * 1.7) * 0.015;
  elevation += Math.cos(x * 3.1 - z * 2.3) * 0.01;

  // Soften edges near the coast using distance to polygon edge
  const edgeDist = minDistToRI(x, z);
  if (edgeDist < 3) {
    elevation *= edgeDist / 3;
  }

  return Math.max(-0.05, Math.min(1.0, elevation));
}

// Elevation-based color mapping
function getColor(elevation: number): THREE.Color {
  if (elevation < 0.0) return new THREE.Color(0x0a1628);
  if (elevation < 0.03) return new THREE.Color(0x0e3d5c);
  if (elevation < 0.08) return new THREE.Color(0x134d3e);
  if (elevation < 0.15) return new THREE.Color(0x1a5e42);
  if (elevation < 0.25) return new THREE.Color(0x276b4a);
  if (elevation < 0.35) return new THREE.Color(0x358854);
  if (elevation < 0.45) return new THREE.Color(0x459e5e);
  if (elevation < 0.55) return new THREE.Color(0x5aaa68);
  if (elevation < 0.65) return new THREE.Color(0x72b570);
  if (elevation < 0.75) return new THREE.Color(0x8fc17a);
  if (elevation < 0.85) return new THREE.Color(0xa8c97a);
  return new THREE.Color(0xc4d27e);
}

// The terrain mesh with vertex displacement and per-vertex colors
function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const segments = 256;
    const size = 90;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colorArray = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const inside = isInsideRI(x, z);

      if (inside) {
        const elev = getElevation(x, z);
        positions.setY(i, elev * 7);
        const c = getColor(elev);
        colorArray[i * 3] = c.r;
        colorArray[i * 3 + 1] = c.g;
        colorArray[i * 3 + 2] = c.b;
      } else {
        // Drop to void
        positions.setY(i, -3);
        colorArray[i * 3] = 0;
        colorArray[i * 3 + 1] = 0;
        colorArray[i * 3 + 2] = 0;
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Subtle breathing animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.05) * 0.015;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        flatShading
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
}

// Glowing boundary outline around the state
function StateGlow() {
  const lineGeometry = useMemo(() => {
    const allPoints: THREE.Vector3[] = [];

    const tracePolygon = (polygon: number[][]) => {
      const raw = polygon === RI_MAINLAND
        ? [
            [-71.862772, 41.3205], [-71.862772, 41.3505], [-71.833, 41.382],
            [-71.799309, 41.414677], [-71.799309, 41.68], [-71.799309, 41.86],
            [-71.799309, 42.006186], [-71.791, 42.01714], [-71.530939, 42.01714],
            [-71.383061, 42.01714], [-71.381, 41.985], [-71.382, 41.93],
            [-71.342, 41.893], [-71.34, 41.862], [-71.34, 41.831],
            [-71.328292, 41.781632], [-71.265, 41.752], [-71.22423, 41.710431],
            [-71.258, 41.752], [-71.29, 41.757], [-71.317, 41.756],
            [-71.344723, 41.726862], [-71.365, 41.71], [-71.388, 41.695],
            [-71.39, 41.665], [-71.395, 41.637], [-71.418, 41.615],
            [-71.43, 41.598], [-71.448785, 41.578985], [-71.456, 41.543],
            [-71.462, 41.505], [-71.468, 41.465], [-71.473, 41.425],
            [-71.478, 41.39], [-71.481646, 41.370861], [-71.52, 41.348],
            [-71.575, 41.33], [-71.63, 41.318], [-71.695, 41.315],
            [-71.755, 41.317], [-71.81, 41.318], [-71.859555, 41.321569],
            [-71.862772, 41.3205],
          ]
        : polygon === AQUIDNECK
        ? [
            [-71.285, 41.64], [-71.255, 41.625], [-71.225, 41.59],
            [-71.21, 41.555], [-71.2, 41.52], [-71.196845, 41.497],
            [-71.215, 41.477], [-71.24, 41.472], [-71.275, 41.474],
            [-71.31, 41.477], [-71.317338, 41.497], [-71.315, 41.535],
            [-71.31, 41.565], [-71.305, 41.595], [-71.295, 41.625],
            [-71.285, 41.64],
          ]
        : polygon === CONANICUT
        ? [
            [-71.38, 41.53], [-71.36, 41.505], [-71.355, 41.48],
            [-71.36, 41.46], [-71.375, 41.455], [-71.395, 41.465],
            [-71.4, 41.49], [-71.395, 41.515], [-71.38, 41.53],
          ]
        : [
            [-71.325, 41.64], [-71.31, 41.615], [-71.305, 41.59],
            [-71.315, 41.575], [-71.335, 41.58], [-71.34, 41.605],
            [-71.335, 41.63], [-71.325, 41.64],
          ];

      const pts: THREE.Vector3[] = [];
      for (const [lng, lat] of raw) {
        const [x, z] = geoToLocal(lng, lat);
        const elev = getElevation(x, z);
        pts.push(new THREE.Vector3(x, Math.max(elev * 7, 0) + 0.3, z));
      }
      return pts;
    };

    allPoints.push(
      ...tracePolygon(RI_MAINLAND),
      // gap
      new THREE.Vector3(NaN, NaN, NaN),
      ...tracePolygon(AQUIDNECK),
      new THREE.Vector3(NaN, NaN, NaN),
      ...tracePolygon(CONANICUT),
      new THREE.Vector3(NaN, NaN, NaN),
      ...tracePolygon(PRUDENCE)
    );

    // Filter out NaN segments, build separate line segments
    return allPoints;
  }, []);

  // Split into separate line groups at NaN boundaries
  const segments = useMemo(() => {
    const result: [number, number, number][][] = [];
    let current: [number, number, number][] = [];
    for (const pt of lineGeometry) {
      if (isNaN(pt.x)) {
        if (current.length > 0) result.push(current);
        current = [];
      } else {
        current.push([pt.x, pt.y, pt.z]);
      }
    }
    if (current.length > 0) result.push(current);
    return result;
  }, [lineGeometry]);

  return (
    <>
      {segments.map((pts, idx) => (
        <Line
          key={idx}
          points={pts}
          color="#22d3ee"
          lineWidth={1.5}
          transparent
          opacity={0.5}
        />
      ))}
    </>
  );
}

// Floating city labels
function CityLabels() {
  const cities = [
    { name: "PROVIDENCE", lng: -71.4128, lat: 41.824 },
    { name: "WARWICK", lng: -71.4162, lat: 41.7001 },
    { name: "CRANSTON", lng: -71.4373, lat: 41.7798 },
    { name: "PAWTUCKET", lng: -71.3826, lat: 41.8787 },
    { name: "NEWPORT", lng: -71.3128, lat: 41.4901 },
    { name: "WOONSOCKET", lng: -71.5145, lat: 42.0029 },
    { name: "WESTERLY", lng: -71.8273, lat: 41.3776 },
    { name: "EAST GREENWICH", lng: -71.46, lat: 41.66 },
    { name: "SOUTH KINGSTOWN", lng: -71.53, lat: 41.445 },
  ];

  return (
    <>
      {cities.map((city) => {
        const [x, z] = geoToLocal(city.lng, city.lat);
        if (!isInsideRI(x, z)) return null;
        const elev = getElevation(x, z);
        const isPrimary = city.name === "PROVIDENCE";
        return (
          <Float
            key={city.name}
            speed={1.5}
            floatIntensity={0.2}
            rotationIntensity={0}
          >
            <group position={[x, elev * 7 + (isPrimary ? 2.5 : 1.8), z]}>
              {/* Vertical line from terrain to label */}
              <Line
                points={[
                  [0, -(isPrimary ? 2.5 : 1.8), 0],
                  [0, -0.3, 0],
                ]}
                color="#22d3ee"
                lineWidth={1}
                transparent
                opacity={0.25}
              />
              <Text
                fontSize={isPrimary ? 1.4 : 0.8}
                color={isPrimary ? "#22d3ee" : "#ffffff"}
                anchorX="center"
                anchorY="middle"
                font="/fonts/TestSohneMono-Buch.otf"
                letterSpacing={0.15}
                outlineWidth={0.04}
                outlineColor="#000000"
              >
                {city.name}
              </Text>
            </group>
          </Float>
        );
      })}
    </>
  );
}

// Ambient particle dust floating around the terrain
function ParticleDust() {
  const ref = useRef<THREE.Points>(null);

  const { positions, sizes } = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 15 + 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      sz[i] = Math.random() * 0.3 + 0.05;
    }
    return { positions: pos, sizes: sz };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3 + 1] +=
        Math.sin(state.clock.elapsedTime * 0.3 + i) * 0.003;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color="#22d3ee"
        size={0.15}
        transparent
        opacity={0.2}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

interface RhodeIslandTerrainProps {
  onCountyClick?: (county: string) => void;
}

export default function RhodeIslandTerrain({
  onCountyClick,
}: RhodeIslandTerrainProps) {
  return (
    <div className="map-container">
      <Canvas
        camera={{
          position: [0, 40, 50],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
        style={{ background: "#000000" }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[30, 50, 20]}
          intensity={1.0}
          color="#ffffff"
          castShadow
        />
        <directionalLight
          position={[-20, 30, -10]}
          intensity={0.25}
          color="#22d3ee"
        />
        {/* Rim light from below for floating-in-void feel */}
        <pointLight position={[0, -10, 0]} intensity={0.15} color="#22d3ee" />
        {/* Warm accent from side */}
        <pointLight
          position={[40, 20, -30]}
          intensity={0.1}
          color="#f59e0b"
        />

        {/* Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={15}
          maxDistance={120}
          autoRotate
          autoRotateSpeed={0.3}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
          enablePan={false}
        />

        {/* Terrain */}
        <TerrainMesh />
        <StateGlow />
        <CityLabels />
        <ParticleDust />

        {/* Fog for depth fade */}
        <fog attach="fog" args={["#000000", 80, 200]} />
      </Canvas>
    </div>
  );
}
