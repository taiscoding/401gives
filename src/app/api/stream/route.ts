import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Deterministic shuffle based on current hour (same as 24hrfreemusic schedule)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function GET() {
  try {
    // Read video CSV
    const csvPath = join(process.cwd(), "data", "nonprofit-videos.csv");
    const csv = readFileSync(csvPath, "utf-8");

    const tracks = csv
      .trim()
      .split("\n")
      .map((line) => {
        const [slug, url] = line.split(",");
        const videoIdMatch = url?.match(/[?&]v=([^&)\s]+)/);
        if (!slug || !videoIdMatch) return null;
        // Convert slug to display name
        const name = slug
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return {
          slug,
          name,
          videoId: videoIdMatch[1],
        };
      })
      .filter(Boolean);

    // Deterministic shuffle based on current hour
    const now = new Date();
    const seed = now.getFullYear() * 1000000 + (now.getMonth() + 1) * 10000 + now.getDate() * 100 + now.getHours();
    const shuffled = seededShuffle(tracks, seed);

    return NextResponse.json({
      tracks: shuffled,
      stationName: "360 SOUND",
      totalTracks: shuffled.length,
      seed,
    });
  } catch (error) {
    return NextResponse.json({ tracks: [], error: "Stream unavailable" }, { status: 500 });
  }
}
