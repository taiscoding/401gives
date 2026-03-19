"use client";

import dynamic from "next/dynamic";
import SpatialCursor from "@/components/SpatialCursor";
import { useExploration } from "@/hooks/useExploration";
import SidePanel from "@/components/SidePanel";
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

  const activeCounty = state.level !== "overview" ? state.county : "";
  const activeCause =
    state.level === "cause" || state.level === "nonprofit" ? state.cause : "";
  const activeCity = state.level !== "overview" ? state.city : "";

  // Cities filtered to active county for the side panel
  const countyCities = activeCounty
    ? cities.filter((c) => c.county === activeCounty)
    : [];

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

      {/* Multi-level side panel (left) */}
      {state.level !== "overview" && (
        <SidePanel
          level={state.level}
          county={activeCounty}
          city={activeCity}
          cause={activeCause}
          cities={countyCities}
          causes={causes}
          nonprofits={nonprofits}
          loading={loading}
          onCitySelect={selectCity}
          onCauseSelect={selectCause}
          onNonprofitSelect={selectNonprofit}
          onBack={goBack}
        />
      )}

      {/* Nonprofit detail panel (right) */}
      {state.level === "nonprofit" && selectedNonprofit && (
        <NonprofitPanel nonprofit={selectedNonprofit} onBack={goBack} />
      )}

      {/* Bottom HUD */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hud-panel px-6 py-3">
        <div className="flex items-center gap-4 font-sohne-mono text-[10px] uppercase tracking-wider">
          <span className="text-text-primary font-semibold">401.GIVES</span>
          {state.level === "overview" && (
            <>
              <span className="text-text-muted">
                {cities.reduce((s, c) => s + c.count, 0) || 631} NONPROFITS
              </span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">28 CAUSES</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">RHODE ISLAND</span>
            </>
          )}
          {state.level === "city" && !activeCity && (
            <>
              <span className="text-signal">{activeCounty.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{countyCities.length} CITIES</span>
            </>
          )}
          {state.level === "city" && activeCity && (
            <>
              <span className="text-signal">{activeCity.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{causes.length} CAUSES</span>
            </>
          )}
          {(state.level === "cause" || state.level === "nonprofit") && (
            <>
              <span className="text-signal">{activeCity.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-signal">{activeCause.toUpperCase()}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{nonprofits.length} NONPROFITS</span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
