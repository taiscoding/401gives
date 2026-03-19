"use client";

import type { SyntheticEvent } from "react";
import { getCauseColor } from "@/data/cause-categories";
import type { CityData, CauseData, NonprofitData } from "@/hooks/useExploration";

function handleImgError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = "flex";
}

interface SidePanelProps {
  level: "city" | "cause" | "nonprofit";
  county: string;
  city: string;
  cause: string;
  cities: CityData[];  // cities in active county
  causes: CauseData[];
  nonprofits: NonprofitData[];
  loading: boolean;
  onCitySelect: (city: string, county: string) => void;
  onCauseSelect: (cause: string) => void;
  onNonprofitSelect: (slug: string) => void;
  onBack: () => void;
}

export default function SidePanel({
  level,
  county,
  city,
  cause,
  cities,
  causes,
  nonprofits,
  loading,
  onCitySelect,
  onCauseSelect,
  onNonprofitSelect,
  onBack,
}: SidePanelProps) {
  return (
    <div
      className="fixed left-0 bottom-0 z-50 flex flex-col slide-in-left"
      style={{ top: 36, width: 320 }}
    >
      <div
        className="h-full overflow-y-auto"
        style={{
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(34, 211, 238, 0.12)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(34, 211, 238, 0.08)" }}>
          <button
            onClick={onBack}
            data-interactive
            style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              cursor: "none",
              padding: 0,
              marginBottom: 12,
            }}
          >
            &#8592; BACK
          </button>

          <h2 style={{
            fontFamily: '"Sohne", sans-serif',
            fontWeight: 800,
            fontSize: "18px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#fff",
            margin: 0,
          }}>
            {level === "city" && !city ? county + " COUNTY" : city || county}
          </h2>

          {/* Breadcrumb */}
          <div style={{
            fontFamily: '"Sohne Mono", monospace',
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#22d3ee",
            margin: "6px 0 0",
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}>
            {level === "city" && !city && (
              <span>{cities.length} CITIES</span>
            )}
            {level === "city" && city && (
              <span>{causes.reduce((s, c) => s + c.count, 0)} NONPROFITS / {causes.length} CAUSES</span>
            )}
            {(level === "cause" || level === "nonprofit") && (
              <>
                <span>{cause}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
                <span>{nonprofits.length} NONPROFITS</span>
              </>
            )}
          </div>
        </div>

        {/* Content based on level */}
        <div style={{ padding: "4px 0" }}>
          {loading && (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              fontFamily: '"Sohne Mono", monospace',
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
            }}>
              LOADING...
            </div>
          )}

          {/* City list (when county selected, no city picked yet) */}
          {level === "city" && !city && !loading && cities.map((c) => (
            <button
              key={c.name}
              data-interactive
              onClick={() => onCitySelect(c.name, c.county)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "12px 20px",
                background: "none",
                border: "none",
                cursor: "none",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,211,238,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />
              <span style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "rgba(255,255,255,0.85)",
                flex: 1,
              }}>
                {c.name}
              </span>
              <span style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "10px",
                color: "rgba(255,255,255,0.35)",
              }}>
                {c.count}
              </span>
            </button>
          ))}

          {/* Cause list (when city is selected) */}
          {level === "city" && city && !loading && causes.map((c) => {
            const color = c.color || getCauseColor(c.name);
            return (
              <button
                key={c.name}
                data-interactive
                onClick={() => onCauseSelect(c.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 20px",
                  background: "none",
                  border: "none",
                  cursor: "none",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,211,238,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: color, flexShrink: 0,
                  boxShadow: `0 0 6px ${color}40`,
                }} />
                <span style={{
                  fontFamily: '"Sohne Mono", monospace',
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "rgba(255,255,255,0.85)",
                  flex: 1,
                }}>
                  {c.name}
                </span>
                <span style={{
                  fontFamily: '"Sohne Mono", monospace',
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.35)",
                }}>
                  {c.count}
                </span>
              </button>
            );
          })}

          {/* Nonprofit list (when cause is selected) */}
          {(level === "cause" || level === "nonprofit") && !loading && nonprofits.map((np) => (
            <button
              key={np.slug}
              data-interactive
              onClick={() => onNonprofitSelect(np.slug)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "14px 20px",
                background: "none",
                border: "none",
                cursor: "none",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,211,238,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              {/* Logo or initial */}
              <div style={{
                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                background: np.logoUrl ? "transparent" : "rgba(34,211,238,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {np.logoUrl && (
                  <img src={np.logoUrl} alt="" onError={handleImgError} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {(
                  <span style={{
                    fontFamily: '"Sohne", sans-serif',
                    fontWeight: 800,
                    fontSize: "14px",
                    color: "#22d3ee",
                  }}>
                    {np.name.charAt(0)}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: '"Sohne", sans-serif',
                  fontWeight: 600,
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {np.name}
                </div>
                <div style={{
                  fontFamily: '"Sohne Mono", monospace',
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}>
                  {np.city}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
