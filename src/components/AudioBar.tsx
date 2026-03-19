"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Track {
  slug: string;
  name: string;
  videoId: string;
}

// Extract YouTube video ID from URL
function extractVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

export default function AudioBar() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);

  // Load track list from API
  useEffect(() => {
    fetch("/api/stream")
      .then((r) => r.json())
      .then((data) => {
        if (data.tracks?.length) {
          setTracks(data.tracks);
          setIsLoaded(true);
        }
      })
      .catch(() => {});
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!isLoaded || tracks.length === 0) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player("yt-player", {
        height: "1",
        width: "1",
        videoId: tracks[0].videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onStateChange: (event: any) => {
            // When video ends, play next
            if (event.data === 0) {
              playNext();
            }
          },
        },
      });
    };
  }, [isLoaded, tracks]);

  const playNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % tracks.length;
    setCurrentIndex(nextIndex);
    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(tracks[nextIndex].videoId);
    }
  }, [currentIndex, tracks]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const skip = useCallback(() => {
    playNext();
  }, [playNext]);

  const current = tracks[currentIndex];

  if (!isLoaded || !current) return null;

  return (
    <>
      {/* Hidden YouTube player */}
      <div style={{ position: "fixed", top: -100, left: -100, width: 1, height: 1, overflow: "hidden" }}>
        <div id="yt-player" />
      </div>

      {/* Audio bar: thin strip across top */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 36,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(34, 211, 238, 0.08)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
        }}
      >
        {/* Play/Pause */}
        <button
          data-interactive
          onClick={togglePlay}
          style={{
            background: "none",
            border: "none",
            cursor: "none",
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="1" width="3.5" height="12" rx="1" fill="#22d3ee" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="#22d3ee" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 1.5L12 7L3 12.5V1.5Z" fill="#22d3ee" />
            </svg>
          )}
        </button>

        {/* Skip */}
        <button
          data-interactive
          onClick={skip}
          style={{
            background: "none",
            border: "none",
            cursor: "none",
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1.5L8 7L1 12.5V1.5Z" fill="rgba(255,255,255,0.4)" />
            <path d="M7 1.5L14 7L7 12.5V1.5Z" fill="rgba(255,255,255,0.4)" />
          </svg>
        </button>

        {/* EQ bars (animated when playing) */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={isPlaying ? "eq-bar" : ""}
              style={{
                width: 2,
                height: isPlaying ? undefined : 4,
                background: "#22d3ee",
                borderRadius: 1,
                ["--bar-speed" as any]: `${0.5 + i * 0.15}s`,
                ["--bar-delay" as any]: `${i * 0.1}s`,
                ["--bar-max-h" as any]: `${8 + i * 3}px`,
              }}
            />
          ))}
        </div>

        {/* Now playing info */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            NOW PLAYING
          </span>
          <span
            style={{
              fontFamily: '"Sohne", sans-serif',
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {current.name}
          </span>
        </div>

        {/* 24HR SOUND branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: '"Sohne Mono", monospace',
              fontSize: 8,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase",
            }}
          >
            POWERED BY
          </span>
          <span
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: 16,
              letterSpacing: "0.05em",
              color: "rgba(34, 211, 238, 0.6)",
            }}
          >
            24HR SOUND
          </span>
        </div>
      </div>
    </>
  );
}
