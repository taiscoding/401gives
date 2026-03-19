"use client";

import dynamic from "next/dynamic";
import SpatialCursor from "@/components/SpatialCursor";
import { useExploration } from "@/hooks/useExploration";
import CauseSelector from "@/components/CauseSelector";
import NonprofitPanel from "@/components/NonprofitPanel";

const RhodeIslandTerrain = dynamic(
  () => import("@/components/RhodeIslandTerrain"),
  { ssr: false }
);

export default function Home() {
  const {
    state,
    cities,
    causes,
    nonprofits,
    selectedNonprofit,
    loading,
    selectCounty,
    selectCity,
    selectCause,
    selectNonprofit,
    goBack,
  } = useExploration();

  // Derive active county and cause
  const activeCounty =
    state.level !== "overview" ? state.county : "";
  const activeCause =
    state.level === "cause" || state.level === "nonprofit"
      ? state.cause
      : "";

  return (
    <main className="fixed inset-0 bg-void">
      <SpatialCursor />

      <RhodeIslandTerrain
        cities={cities}
        nonprofits={nonprofits}
        explorationLevel={state.level}
        activeCounty={activeCounty}
        activeCause={activeCause}
        onCountyClick={selectCounty}
        onCityClick={selectCity}
        onNonprofitClick={selectNonprofit}
      />

      {/* Cause selector panel (left side) */}
      {(state.level === "city" || state.level === "cause" || state.level === "nonprofit") && (
        <CauseSelector
          city={state.city}
          causes={causes}
          onSelect={selectCause}
          onBack={goBack}
          loading={loading && state.level === "city"}
        />
      )}

      {/* Nonprofit detail panel (right side) */}
      {state.level === "nonprofit" && selectedNonprofit && (
        <NonprofitPanel nonprofit={selectedNonprofit} onBack={goBack} />
      )}

      {/* Bottom HUD */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hud-panel px-6 py-3">
        <div className="flex items-center gap-4 font-sohne-mono text-[10px] uppercase tracking-wider">
          <span className="text-text-primary font-semibold">401.GIVES</span>
          {state.level === "overview" && (
            <>
              <span className="text-text-muted">{cities.reduce((s, c) => s + c.count, 0) || 677} NONPROFITS</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">28 CAUSES</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">RHODE ISLAND</span>
            </>
          )}
          {state.level === "city" && (
            <>
              <span className="text-signal">{state.city.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{causes.length} CAUSES</span>
            </>
          )}
          {(state.level === "cause" || state.level === "nonprofit") && (
            <>
              <span className="text-signal">{state.city.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-signal">{state.cause.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{nonprofits.length} NONPROFITS</span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
