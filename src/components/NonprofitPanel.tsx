"use client";

import { getCauseColor } from "@/data/cause-categories";
import type { NonprofitData } from "@/hooks/useExploration";

interface NonprofitPanelProps {
  nonprofit: NonprofitData;
  onBack: () => void;
}

export default function NonprofitPanel({
  nonprofit,
  onBack,
}: NonprofitPanelProps) {
  const primaryColor =
    nonprofit.causes.length > 0
      ? getCauseColor(nonprofit.causes[0])
      : "#22d3ee";

  // First letter for avatar fallback
  const initials = nonprofit.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-50 slide-in-right"
      style={{ width: 400 }}
    >
      <div
        className="h-full overflow-y-auto"
        style={{
          background: "rgba(0, 0, 0, 0.9)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(34, 211, 238, 0.15)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 24px 0" }}>
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
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: "12px" }}>&#8592;</span> BACK TO RESULTS
          </button>
        </div>

        {/* Logo / Avatar */}
        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {nonprofit.logoUrl ? (
            <img
              src={nonprofit.logoUrl}
              alt={nonprofit.name}
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                objectFit: "cover",
                border: `1px solid ${primaryColor}30`,
              }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                background: primaryColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 800,
                fontSize: "18px",
                color: "#000",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
          )}
          <div>
            <h2
              style={{
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 800,
                fontSize: "16px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#fff",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {nonprofit.name}
            </h2>
            <p
              style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255, 255, 255, 0.4)",
                margin: "4px 0 0",
              }}
            >
              {nonprofit.city}, {nonprofit.county} COUNTY
            </p>
          </div>
        </div>

        {/* Cause chips */}
        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {nonprofit.causes.map((cause) => {
            const color = getCauseColor(cause);
            return (
              <span
                key={cause}
                style={{
                  fontFamily: '"Sohne Mono", monospace',
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: color,
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  borderRadius: 4,
                  padding: "4px 8px",
                }}
              >
                {cause}
              </span>
            );
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            margin: "0 24px",
            height: 1,
            background: "rgba(34, 211, 238, 0.1)",
          }}
        />

        {/* Mission */}
        {nonprofit.mission && (
          <div style={{ padding: "20px 24px" }}>
            <h3
              style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255, 255, 255, 0.4)",
                margin: "0 0 8px",
              }}
            >
              MISSION
            </h3>
            <p
              style={{
                fontFamily: '"Sohne", sans-serif',
                fontSize: "13px",
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.75)",
                margin: 0,
              }}
            >
              {nonprofit.mission}
            </p>
          </div>
        )}

        {/* Donate button */}
        {nonprofit.donateUrl && (
          <div style={{ padding: "12px 24px 32px" }}>
            <a
              href={nonprofit.donateUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                width: "100%",
                padding: "14px 0",
                textAlign: "center",
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 800,
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#000",
                background: "#22d3ee",
                border: "none",
                borderRadius: 6,
                textDecoration: "none",
                cursor: "none",
                transition: "background 0.15s, box-shadow 0.15s",
                boxShadow: "0 0 20px rgba(34, 211, 238, 0.3)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#67e8f9";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 30px rgba(34, 211, 238, 0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#22d3ee";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 20px rgba(34, 211, 238, 0.3)";
              }}
            >
              DONATE
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
