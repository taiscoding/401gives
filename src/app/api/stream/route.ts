import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

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

// Fallback: hardcoded first 20 tracks in case file read fails on serverless
const FALLBACK_TRACKS = [
  { slug: "as220", name: "AS220", videoId: "NPApWNC6VNQ" },
  { slug: "college-unbound", name: "College Unbound", videoId: "eeHEeJ9njKA" },
  { slug: "progreso-latino", name: "Progreso Latino", videoId: "BzWpw8CODHs" },
  { slug: "foster-forward", name: "Foster Forward", videoId: "wxHGrYy3-s0" },
  { slug: "clean-water-fund-ri", name: "Clean Water Fund RI", videoId: "PBIMb2NWf4g" },
  { slug: "leadership-rhode-island", name: "Leadership Rhode Island", videoId: "4qQwxCqZU24" },
  { slug: "newport-pride", name: "Newport Pride", videoId: "GkKkZ5LFRV8" },
  { slug: "habitat-for-humanity-west-bay-and-northern-ri-inc", name: "Habitat For Humanity West Bay", videoId: "YGrXh8IjGGg" },
  { slug: "dare-to-dream-ranch-inc", name: "Dare To Dream Ranch", videoId: "jTToxd-KLdU" },
  { slug: "esperanza-hope", name: "Esperanza Hope", videoId: "raybbH1j4Vk" },
  { slug: "bridge-builders-of-diversity", name: "Bridge Builders Of Diversity", videoId: "ihSpOBmAOKk" },
  { slug: "operationstanddownri", name: "Operation Stand Down RI", videoId: "qb44w2QPYmA" },
  { slug: "bikenewportri", name: "Bike Newport RI", videoId: "qA49uwICdxk" },
  { slug: "east-bay-rowing", name: "East Bay Rowing", videoId: "OJfZYbCuOmw" },
  { slug: "ensemble-altera", name: "Ensemble Altera", videoId: "88nGsAS5-9A" },
  { slug: "15-minute-field-trips", name: "15 Minute Field Trips", videoId: "YNJgmJpJuik" },
  { slug: "aldersbridge-communities", name: "Aldersbridge Communities", videoId: "EvcJ2S0FfNY" },
  { slug: "empower-spinal-cord-injury", name: "Empower Spinal Cord Injury", videoId: "SAHD1UCnq6k" },
  { slug: "gloria-gemma-breast-cancer-resource-foudation-73e5656d-3ce5-45d6-a202-f239bd1dd100", name: "Gloria Gemma Breast Cancer Resource Foundation", videoId: "S84D7ScVEt4" },
  { slug: "international-tennis-hall-of-fame", name: "International Tennis Hall Of Fame", videoId: "Bq7dyP4zX9s" },
];

export async function GET() {
  try {
    let tracks: { slug: string; name: string; videoId: string }[];

    try {
      const csvPath = join(process.cwd(), "data", "nonprofit-videos.csv");
      const csv = readFileSync(csvPath, "utf-8");
      tracks = csv
        .trim()
        .split("\n")
        .map((line) => {
          const [slug, url] = line.split(",");
          const match = url?.match(/[?&]v=([^&)\s]+)/);
          if (!slug || !match) return null;
          const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return { slug, name, videoId: match[1] };
        })
        .filter(Boolean) as { slug: string; name: string; videoId: string }[];
    } catch {
      tracks = FALLBACK_TRACKS;
    }

    const now = new Date();
    const seed = now.getFullYear() * 1000000 + (now.getMonth() + 1) * 10000 + now.getDate() * 100 + now.getHours();
    const shuffled = seededShuffle(tracks, seed);

    return NextResponse.json({
      tracks: shuffled,
      stationName: "360 SOUND",
      totalTracks: shuffled.length,
    });
  } catch {
    return NextResponse.json({ tracks: FALLBACK_TRACKS, stationName: "360 SOUND" });
  }
}
