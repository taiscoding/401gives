"use client";

import { getCauseColor } from "@/data/cause-categories";
import type { CauseData } from "@/hooks/useExploration";

interface CauseSelectorProps {
  city: string;
  causes: CauseData[];
  onSelect: (cause: string) => void;
  onBack: () => void;
  loading: boolean;
}

export default function CauseSelector({
  city,
  causes,
  onSelect,
  onBack,
  loading,
}: CauseSelectorProps) {
  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col slide-in-left"
      style={{ width: 320 }}
    >
      <div
        className="h-full overflow-y-auto"
        style={{
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid rgba(34, 211, 238, 0.15)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 20px 16px",
            borderBottom: "1px solid rgba(34, 211, 238, 0.1)",
          }}
        >
          <button
            onClick={onBack}
            style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255, 255, 255, 0.5)",
              background: "none",
              border: "none",
              cursor: "none",
              padding: 0,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: "12px" }}>&#8592;</span> BACK TO MAP
          </button>
          <h2
            style={{
              fontFamily: '"Sohne", sans-serif',
              fontWeight: 800,
              fontSize: "18px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#fff",
              margin: 0,
            }}
          >
            {city}
          </h2>
          <p
            style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#22d3ee",
              margin: "6px 0 0",
            }}
          >
            {causes.reduce((sum, c) => sum + c.count, 0)} NONPROFITS /{" "}
            {causes.length} CAUSES
          </p>
        </div>

        {/* Cause list */}
        <div style={{ padding: "8px 0" }}>
          {loading ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255, 255, 255, 0.3)",
              }}
            >
              LOADING CAUSES...
            </div>
          ) : (
            causes.map((cause) => {
              const color = cause.color || getCauseColor(cause.name);
              return (
                <button
                  key={cause.name}
                  onClick={() => onSelect(cause.name)}
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
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(34, 211, 238, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "none";
                  }}
                >
                  {/* Cause color dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${color}40`,
                    }}
                  />

                  {/* Name */}
                  <span
                    style={{
                      fontFamily: '"Sohne Mono", monospace',
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "rgba(255, 255, 255, 0.85)",
                      flex: 1,
                    }}
                  >
                    {cause.name}
                  </span>

                  {/* Count */}
                  <span
                    style={{
                      fontFamily: '"Sohne Mono", monospace',
                      fontSize: "10px",
                      color: "rgba(255, 255, 255, 0.4)",
                      flexShrink: 0,
                    }}
                  >
                    {cause.count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
