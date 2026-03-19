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
  // Linear gradients: lighter sky at top, darker ground/horizon at bottom
  // Like looking at the sky from Rhode Island
  switch (phase) {
    case "night":
      return "linear-gradient(to bottom, #0a0e1a 0%, #060a14 40%, #020408 100%)";
    case "first_light":
      return "linear-gradient(to bottom, #0c0a20 0%, #0a0818 50%, #1a1535 100%)";
    case "dawn":
      return "linear-gradient(to bottom, #0a0c20 0%, #1a1040 50%, #3a1a30 100%)";
    case "sunrise":
      return "linear-gradient(to bottom, #121830 0%, #2a1838 40%, #4a2028 100%)";
    case "morning":
      return "linear-gradient(to bottom, #1e3a5c 0%, #152c4a 50%, #0e1e38 100%)";
    case "midday":
      return "linear-gradient(to bottom, #1e4070 0%, #183460 50%, #0e1e38 100%)";
    case "golden_hour":
      return "linear-gradient(to bottom, #142040 0%, #2a1838 40%, #3a2030 100%)";
    case "sunset":
      return "linear-gradient(to bottom, #1a1035 0%, #351530 40%, #4a1820 100%)";
    case "dusk":
      return "linear-gradient(to bottom, #080814 0%, #141028 50%, #201530 100%)";
    case "last_light":
      return "linear-gradient(to bottom, #040608 0%, #0a0818 50%, #141025 100%)";
  }
}
