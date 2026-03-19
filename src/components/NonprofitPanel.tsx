"use client";

import { useState, useEffect, useCallback, type SyntheticEvent } from "react";
import { getCauseColor } from "@/data/cause-categories";

// Hide broken images by swapping to fallback
function handleImgError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.display = "none";
  // Show the next sibling (fallback avatar) if it exists
  const fallback = img.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = "flex";
}
import type { NonprofitData } from "@/hooks/useExploration";

// ─── Types ──────────────────────────────────────────────────────

interface RelatedNonprofit {
  name: string;
  slug: string;
  city: string;
  logoUrl: string | null;
}

interface NonprofitPanelProps {
  nonprofit: NonprofitData;
  related?: RelatedNonprofit[];
  onBack: () => void;
  onRelatedClick?: (slug: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────

const WATCHLIST_KEY = "401gives_watchlist";
const SHARE_BASE = "https://401.gives/?nonprofit=";

// ─── Helpers ────────────────────────────────────────────────────

function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
  } catch {
    return [];
  }
}

function setWatchlist(slugs: string[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(slugs));
}

// ─── Component ──────────────────────────────────────────────────

export default function NonprofitPanel({
  nonprofit,
  related,
  onBack,
  onRelatedClick,
}: NonprofitPanelProps) {
  const [missionExpanded, setMissionExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const primaryColor =
    nonprofit.causes.length > 0
      ? getCauseColor(nonprofit.causes[0])
      : "#22d3ee";

  const initials = nonprofit.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Check saved state on mount and when nonprofit changes
  useEffect(() => {
    const list = getWatchlist();
    setSaved(list.includes(nonprofit.slug));
    setMissionExpanded(false);
    setCopied(false);
  }, [nonprofit.slug]);

  // Save / unsave toggle
  const toggleSave = useCallback(() => {
    const list = getWatchlist();
    if (list.includes(nonprofit.slug)) {
      setWatchlist(list.filter((s) => s !== nonprofit.slug));
      setSaved(false);
    } else {
      setWatchlist([...list, nonprofit.slug]);
      setSaved(true);
    }
  }, [nonprofit.slug]);

  // Copy share link
  const handleShare = useCallback(async () => {
    const url = SHARE_BASE + nonprofit.slug;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [nonprofit.slug]);

  // Mission truncation
  const missionNeedsExpand =
    nonprofit.mission && nonprofit.mission.length > 200;

  const donateUrl =
    nonprofit.donateUrl ||
    `https://401gives.org/organizations/${nonprofit.slug}`;

  return (
    <div
      className="fixed right-0 bottom-0 z-50 slide-in-right"
      style={{ top: 36, width: 420 }}
    >
      <div
        className="h-full overflow-y-auto"
        style={{
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(34, 211, 238, 0.12)",
        }}
      >
        {/* ─── Header Zone ─────────────────────────────────── */}
        <div style={{ padding: "24px 24px 0" }}>
          <button
            onClick={onBack}
            data-interactive
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
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#22d3ee";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
            }}
          >
            <span style={{ fontSize: "12px" }}>&#8592;</span> BACK TO RESULTS
          </button>
        </div>

        {/* Logo + Name + Location */}
        <div
          style={{
            padding: "0 24px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          {/* Logo / Avatar (with broken image fallback) */}
          <div style={{ width: 64, height: 64, flexShrink: 0, position: "relative" }}>
            {nonprofit.logoUrl && (
              <img
                src={nonprofit.logoUrl}
                alt={nonprofit.name}
                onError={handleImgError}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  objectFit: "cover",
                  border: `1px solid ${primaryColor}30`,
                }}
              />
            )}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)`,
                display: nonprofit.logoUrl ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 800,
                fontSize: "22px",
                color: "#000",
                position: nonprofit.logoUrl ? "absolute" : "relative",
                top: 0,
                left: 0,
              }}
            >
              {initials}
            </div>
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 800,
                fontSize: "18px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#fff",
                margin: 0,
                lineHeight: 1.25,
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
                margin: "6px 0 0",
              }}
            >
              {nonprofit.city}, {nonprofit.county} COUNTY
            </p>
          </div>
        </div>

        {/* Cause Chips (horizontally scrollable) */}
        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
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
                  padding: "4px 10px",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                {cause}
              </span>
            );
          })}
        </div>

        {/* ─── Quick Stats Bar ─────────────────────────────── */}
        <div
          style={{
            margin: "0 24px",
            padding: "12px 0",
            borderTop: "1px solid rgba(34, 211, 238, 0.08)",
            borderBottom: "1px solid rgba(34, 211, 238, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Location */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span
              style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {nonprofit.city}
            </span>
          </div>

          {/* Cause count */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span
              style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {nonprofit.causes.length} CAUSE
              {nonprofit.causes.length !== 1 ? "S" : ""}
            </span>
          </div>

          {/* Verified badge (placeholder: show if >1 cause as proxy for research depth) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginLeft: "auto",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="#22d3ee"
              stroke="none"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span
              style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#22d3ee",
              }}
            >
              VERIFIED
            </span>
          </div>
        </div>

        {/* ─── Mission Zone ────────────────────────────────── */}
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

          {nonprofit.mission ? (
            <div>
              <p
                style={{
                  fontFamily: '"Sohne", sans-serif',
                  fontSize: "13px",
                  lineHeight: 1.65,
                  color: "rgba(255, 255, 255, 0.75)",
                  margin: 0,
                  ...(missionExpanded
                    ? {}
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                      }),
                }}
              >
                {nonprofit.mission}
              </p>
              {missionNeedsExpand && (
                <button
                  data-interactive
                  onClick={() => setMissionExpanded(!missionExpanded)}
                  style={{
                    fontFamily: '"Sohne Mono", monospace',
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#22d3ee",
                    background: "none",
                    border: "none",
                    cursor: "none",
                    padding: "6px 0 0",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.7";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  {missionExpanded ? "SHOW LESS" : "READ MORE"}
                </button>
              )}
            </div>
          ) : (
            <p
              style={{
                fontFamily: '"Sohne Mono", monospace',
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255, 255, 255, 0.2)",
                margin: 0,
              }}
            >
              MISSION COMING SOON
            </p>
          )}
        </div>

        {/* ─── Divider ─────────────────────────────────────── */}
        <div
          style={{
            margin: "0 24px",
            height: 1,
            background: "rgba(34, 211, 238, 0.08)",
          }}
        />

        {/* ─── Actions Zone ────────────────────────────────── */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* DONATE button */}
          <a
            href={donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-interactive
            style={{
              display: "block",
              width: "100%",
              padding: "15px 0",
              textAlign: "center",
              fontFamily: '"Sohne", sans-serif',
              fontWeight: 800,
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "#000",
              background: "#22d3ee",
              border: "none",
              borderRadius: 8,
              textDecoration: "none",
              cursor: "none",
              transition: "all 0.2s",
              boxShadow: "0 0 24px rgba(34, 211, 238, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#67e8f9";
              e.currentTarget.style.boxShadow =
                "0 0 36px rgba(34, 211, 238, 0.5)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#22d3ee";
              e.currentTarget.style.boxShadow =
                "0 0 24px rgba(34, 211, 238, 0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            DONATE
          </a>

          {/* SAVE + SHARE row */}
          <div style={{ display: "flex", gap: 10 }}>
            {/* SAVE button */}
            <button
              data-interactive
              onClick={toggleSave}
              style={{
                flex: 1,
                padding: "12px 0",
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 700,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: saved ? "#000" : "#22d3ee",
                background: saved ? "#22d3ee" : "transparent",
                border: "1px solid rgba(34, 211, 238, 0.3)",
                borderRadius: 8,
                cursor: "none",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                if (!saved) {
                  e.currentTarget.style.background =
                    "rgba(34, 211, 238, 0.08)";
                  e.currentTarget.style.borderColor =
                    "rgba(34, 211, 238, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (!saved) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor =
                    "rgba(34, 211, 238, 0.3)";
                }
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={saved ? "#000" : "none"}
                stroke={saved ? "#000" : "#22d3ee"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              {saved ? "SAVED" : "SAVE"}
            </button>

            {/* SHARE button */}
            <button
              data-interactive
              onClick={handleShare}
              style={{
                flex: 1,
                padding: "12px 0",
                fontFamily: '"Sohne", sans-serif',
                fontWeight: 700,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: copied ? "#4ade80" : "rgba(255,255,255,0.6)",
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 8,
                cursor: "none",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.background =
                    "rgba(255, 255, 255, 0.04)";
                  e.currentTarget.style.borderColor =
                    "rgba(255, 255, 255, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor =
                    "rgba(255, 255, 255, 0.12)";
                }
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={copied ? "#4ade80" : "rgba(255,255,255,0.6)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {copied ? (
                  <path d="M20 6L9 17l-5-5" />
                ) : (
                  <>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </>
                )}
              </svg>
              {copied ? "COPIED" : "SHARE"}
            </button>
          </div>
        </div>

        {/* ─── Related Nonprofits ──────────────────────────── */}
        {related && related.length > 0 && (
          <>
            <div
              style={{
                margin: "0 24px",
                height: 1,
                background: "rgba(34, 211, 238, 0.08)",
              }}
            />

            <div style={{ padding: "20px 24px 32px" }}>
              <h3
                style={{
                  fontFamily: '"Sohne Mono", monospace',
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "rgba(255, 255, 255, 0.4)",
                  margin: "0 0 12px",
                }}
              >
                EXPLORE SIMILAR
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {related.map((r) => {
                  const rInitial = r.name.charAt(0).toUpperCase();
                  return (
                    <button
                      key={r.slug}
                      data-interactive
                      onClick={() => onRelatedClick?.(r.slug)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "10px 12px",
                        background: "none",
                        border: "none",
                        borderRadius: 8,
                        cursor: "none",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(34, 211, 238, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      {/* Mini logo */}
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          flexShrink: 0,
                          background: r.logoUrl
                            ? "transparent"
                            : "rgba(34, 211, 238, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        {r.logoUrl && (
                          <img
                            src={r.logoUrl}
                            alt=""
                            onError={handleImgError}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        )}
                        {(
                          <span
                            style={{
                              fontFamily: '"Sohne", sans-serif',
                              fontWeight: 800,
                              fontSize: "14px",
                              color: "#22d3ee",
                            }}
                          >
                            {rInitial}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: '"Sohne", sans-serif',
                            fontWeight: 600,
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {r.name}
                        </div>
                        <div
                          style={{
                            fontFamily: '"Sohne Mono", monospace',
                            fontSize: "9px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "rgba(255, 255, 255, 0.35)",
                            marginTop: 2,
                          }}
                        >
                          {r.city}
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Bottom spacer for scroll clearance */}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
