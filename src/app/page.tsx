"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import SpatialCursor from "@/components/SpatialCursor";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [activeCounty, setActiveCounty] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    county: string;
    x: number;
    y: number;
  } | null>(null);
  const [zoom, setZoom] = useState(9);

  return (
    <main className="fixed inset-0 bg-void">
      <SpatialCursor />

      <MapView
        onCountyClick={(county) => setActiveCounty(county)}
        onCountyHover={(county, x, y) =>
          setHoverInfo(county ? { county, x, y } : null)
        }
        onZoomChange={setZoom}
      />

      {/* County hover HUD */}
      {hoverInfo && zoom < 11 && (
        <div
          className="fixed z-50 hud-panel px-3 py-2 pointer-events-none"
          style={{
            left: hoverInfo.x + 20,
            top: hoverInfo.y - 10,
          }}
        >
          <span className="font-sohne-mono text-[10px] uppercase tracking-wider text-signal">
            {hoverInfo.county} COUNTY
          </span>
        </div>
      )}

      {/* Bottom HUD */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hud-panel px-6 py-3">
        <div className="flex items-center gap-4 font-sohne-mono text-[10px] uppercase tracking-wider">
          <span className="text-text-primary font-semibold">401.GIVES</span>
          <span className="text-text-muted">
            677 NONPROFITS
          </span>
          <span className="text-text-muted">/</span>
          <span className="text-text-muted">
            28 CAUSES
          </span>
          <span className="text-text-muted">/</span>
          <span className="text-text-muted">
            RHODE ISLAND
          </span>
        </div>
      </div>
    </main>
  );
}
