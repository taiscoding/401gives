/**
 * Sky Gradient
 *
 * Uses the SunriseSunset.io API to get real solar data for the
 * user's location, then maps the current time to a sky gradient
 * that reflects what's actually outside their window.
 *
 * The background IS the sky. Not an approximation. The real thing.
 */

export type SolarData = {
  sunrise: string;
  sunset: string;
  dawn: string;
  dusk: string;
  goldenHour: string;
  solarNoon: string;
  firstLight: string;
  lastLight: string;
};

export type SkyPhase =
  | "night"        // lastLight -> firstLight
  | "first_light"  // firstLight -> dawn
  | "dawn"         // dawn -> sunrise
  | "sunrise"      // sunrise -> sunrise+30min
  | "morning"      // sunrise+30min -> solarNoon-1hr
  | "midday"       // solarNoon-1hr -> goldenHour
  | "golden_hour"  // goldenHour -> sunset
  | "sunset"       // sunset -> sunset+20min
  | "dusk"         // sunset+20min -> dusk
  | "last_light";  // dusk -> lastLight

/**
 * Fetch solar data from SunriseSunset.io.
 * No API key needed. Free.
 */
export async function fetchSolarData(lat: number, lng: number): Promise<SolarData | null> {
  try {
    const res = await fetch(
      `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&time_format=24`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK") return null;

    return {
      sunrise: data.results.sunrise,
      sunset: data.results.sunset,
      dawn: data.results.dawn,
      dusk: data.results.dusk,
      goldenHour: data.results.golden_hour,
      solarNoon: data.results.solar_noon,
      firstLight: data.results.first_light,
      lastLight: data.results.last_light,
    };
  } catch {
    return null;
  }
}

/**
 * Parse "HH:MM:SS" time string to minutes since midnight.
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Determine the current sky phase from solar data.
 */
export function getSkyPhase(solar: SolarData, nowMinutes: number): SkyPhase {
  const firstLight = timeToMinutes(solar.firstLight);
  const dawn = timeToMinutes(solar.dawn);
  const sunrise = timeToMinutes(solar.sunrise);
  const noon = timeToMinutes(solar.solarNoon);
  const golden = timeToMinutes(solar.goldenHour);
  const sunset = timeToMinutes(solar.sunset);
  const dusk = timeToMinutes(solar.dusk);
  const lastLight = timeToMinutes(solar.lastLight);

  if (nowMinutes < firstLight || nowMinutes >= lastLight) return "night";
  if (nowMinutes < dawn) return "first_light";
  if (nowMinutes < sunrise) return "dawn";
  if (nowMinutes < sunrise + 30) return "sunrise";
  if (nowMinutes < noon - 60) return "morning";
  if (nowMinutes < golden) return "midday";
  if (nowMinutes < sunset) return "golden_hour";
  if (nowMinutes < sunset + 20) return "sunset";
  if (nowMinutes < dusk) return "dusk";
  return "last_light";
}

/**
 * Map sky phase to a CSS gradient.
 * Colors from real sky photography. The background should feel
 * like looking up from wherever you are.
 */
export function phaseToGradient(phase: SkyPhase): string {
  switch (phase) {
    case "night":
      // Deep space. Stars would be here.
      return "radial-gradient(ellipse at 50% 50%, #0a0e1a 0%, #050810 60%, #010204 100%)";
    case "first_light":
      // Navy with a hint of indigo on the horizon
      return "radial-gradient(ellipse at 50% 90%, #1a1535 0%, #0c0a20 50%, #050810 100%)";
    case "dawn":
      // Deep blue-purple, warm glow at bottom
      return "radial-gradient(ellipse at 50% 95%, #3a1a30 0%, #1a1040 40%, #0a0c20 100%)";
    case "sunrise":
      // Orange-pink horizon bleeding into blue
      return "radial-gradient(ellipse at 50% 95%, #4a2028 0%, #2a1838 30%, #121830 70%, #0c1020 100%)";
    case "morning":
      // Clear blue sky, lighter than you think
      return "radial-gradient(ellipse at 50% 30%, #1e3a5c 0%, #152c4a 40%, #0e1e38 100%)";
    case "midday":
      // Brightest blue. Real sky.
      return "radial-gradient(ellipse at 50% 25%, #1e4070 0%, #183460 40%, #102848 100%)";
    case "golden_hour":
      // Warm amber creeping in, sky still blue above
      return "radial-gradient(ellipse at 50% 70%, #3a2030 0%, #2a1838 30%, #142040 70%, #0e1830 100%)";
    case "sunset":
      // Fire at the horizon, deep purple above
      return "radial-gradient(ellipse at 50% 85%, #4a1820 0%, #351530 30%, #1a1035 70%, #0c0a1a 100%)";
    case "dusk":
      // Purple-blue fading, last warmth gone
      return "radial-gradient(ellipse at 50% 70%, #201530 0%, #141028 50%, #080814 100%)";
    case "last_light":
      // Almost night, deep indigo
      return "radial-gradient(ellipse at 50% 60%, #141025 0%, #0a0818 50%, #040608 100%)";
  }
}
