"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import SpatialCursor from "@/components/SpatialCursor";
import { useExploration } from "@/hooks/useExploration";
import SidePanel from "@/components/SidePanel";
import NonprofitPanel from "@/components/NonprofitPanel";
import AudioBar from "@/components/AudioBar";

const RhodeIslandTerrain = dynamic(
  () => import("@/components/RhodeIslandTerrain"),
  { ssr: false }
);

export default function Home() {
  const [bgGradient, setBgGradient] = useState(
    "linear-gradient(to bottom, #0a0e1a 0%, #060a14 50%, #020408 100%)"
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    (async () => {
      const { fetchSolarData, getSkyPhase, phaseToGradient } = await import("@/lib/sky-gradient");
      let lat = 41.58, lng = -71.48;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}
      const solar = await fetchSolarData(lat, lng);
      function update() {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        if (solar) setBgGradient(phaseToGradient(getSkyPhase(solar, mins)));
      }
      update();
      interval = setInterval(update, 60000);
    })();
    return () => clearInterval(interval);
  }, []);

  const {
    state, cities, causes, nonprofits, selectedNonprofit, loading,
    selectCounty, selectCity, selectCause, selectNonprofit, goBack,
  } = useExploration();

  const activeCounty = state.level !== "overview" ? state.county : "";
  const activeCause = state.level === "cause" || state.level === "nonprofit" ? state.cause : "";
  const activeCity = state.level !== "overview" ? state.city : "";
  const countyCities = activeCounty ? cities.filter((c) => c.county === activeCounty) : [];

  return (
    <main className="fixed inset-0" style={{ background: bgGradient, transition: "background 3s ease" }}>
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

      {/* 24HR SOUND audio bar */}
      <AudioBar />

      {/* GTA-style title: big, bold, simple */}
      {state.level === "overview" && (
        <>
          {/* Title: top left */}
          <div className="fixed top-14 left-10 z-20 pointer-events-none">
            <h1 style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: "clamp(48px, 7vw, 88px)",
              color: "#fff",
              lineHeight: 0.85,
              letterSpacing: "0.02em",
              margin: 0,
            }}>
              <span>401</span>
              <span style={{ color: "#22d3ee" }}>.GIVES</span>
            </h1>
            <p style={{
              fontFamily: '"Sohne", sans-serif',
              fontSize: "clamp(14px, 1.8vw, 20px)",
              fontWeight: 300,
              letterSpacing: "0.02em",
              color: "rgba(255,255,255,0.6)",
              marginTop: 8,
            }}>
              Discover where to give.
            </p>
            <p style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: 10,
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.25)",
              textTransform: "uppercase",
              marginTop: 6,
            }}>
              631 NONPROFITS ACROSS RHODE ISLAND
            </p>
          </div>

          {/* CTA: bottom center */}
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
            <p style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: "clamp(16px, 2vw, 22px)",
              letterSpacing: "0.1em",
              color: "#22d3ee",
              animation: "pulse-text 3s ease-in-out infinite",
            }}>
              SELECT A COUNTY TO EXPLORE
            </p>
            <p style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: 9,
              letterSpacing: "0.15em",
              color: "rgba(245, 158, 11, 0.5)",
              textTransform: "uppercase",
              marginTop: 6,
            }}>
              401GIVES DAY / MARCH 31
            </p>
          </div>
        </>
      )}

      {/* Side panel */}
      {state.level !== "overview" && (
        <SidePanel
          level={state.level} county={activeCounty} city={activeCity} cause={activeCause}
          cities={countyCities} causes={causes} nonprofits={nonprofits} loading={loading}
          onCitySelect={selectCity} onCauseSelect={selectCause}
          onNonprofitSelect={selectNonprofit} onBack={goBack}
        />
      )}

      {/* Detail panel */}
      {state.level === "nonprofit" && selectedNonprofit && (
        <NonprofitPanel
          nonprofit={selectedNonprofit} related={selectedNonprofit.related}
          onBack={goBack} onRelatedClick={selectNonprofit}
        />
      )}

      {/* Bottom fade */}
      <div className="fixed bottom-0 left-0 right-0 z-[3] pointer-events-none"
        style={{ height: "20vh", background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))" }}
      />
    </main>
  );
}
