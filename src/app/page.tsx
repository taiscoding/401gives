"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import SpatialCursor from "@/components/SpatialCursor";

const RhodeIslandTerrain = dynamic(
  () => import("@/components/RhodeIslandTerrain"),
  { ssr: false }
);

export default function Home() {
  const [activeCounty, setActiveCounty] = useState<string | null>(null);

  return (
    <main className="fixed inset-0 bg-void">
      <SpatialCursor />

      <RhodeIslandTerrain
        onCountyClick={(county) => setActiveCounty(county)}
      />

      {/* Bottom HUD */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hud-panel px-6 py-3">
        <div className="flex items-center gap-4 font-sohne-mono text-[10px] uppercase tracking-wider">
          <span className="text-text-primary font-semibold">401.GIVES</span>
          <span className="text-text-muted">677 NONPROFITS</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-muted">28 CAUSES</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-muted">RHODE ISLAND</span>
        </div>
      </div>
    </main>
  );
}
