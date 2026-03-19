// Rhode Island city-to-county mapping with coordinates
// Source: US Census Bureau, RIGIS

export const CITY_TO_COUNTY: Record<string, string> = {
  // Providence County (16 municipalities)
  "Providence": "Providence",
  "Cranston": "Providence",
  "Pawtucket": "Providence",
  "East Providence": "Providence",
  "Woonsocket": "Providence",
  "Cumberland": "Providence",
  "North Providence": "Providence",
  "Johnston": "Providence",
  "Smithfield": "Providence",
  "Lincoln": "Providence",
  "Central Falls": "Providence",
  "North Smithfield": "Providence",
  "Burrillville": "Providence",
  "Glocester": "Providence",
  "Foster": "Providence",
  "Scituate": "Providence",
  // Kent County (5 municipalities)
  "Warwick": "Kent",
  "Coventry": "Kent",
  "West Warwick": "Kent",
  "East Greenwich": "Kent",
  "West Greenwich": "Kent",
  // Washington County (9 municipalities)
  "South Kingstown": "Washington",
  "North Kingstown": "Washington",
  "Westerly": "Washington",
  "Narragansett": "Washington",
  "Hopkinton": "Washington",
  "Charlestown": "Washington",
  "Richmond": "Washington",
  "Exeter": "Washington",
  "New Shoreham": "Washington",
  // Newport County (6 municipalities)
  "Newport": "Newport",
  "Middletown": "Newport",
  "Portsmouth": "Newport",
  "Tiverton": "Newport",
  "Little Compton": "Newport",
  "Jamestown": "Newport",
  // Bristol County (3 municipalities)
  "Bristol": "Bristol",
  "Warren": "Bristol",
  "Barrington": "Bristol",
};

// Lat/lng for each city center
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Providence County
  "Providence": { lat: 41.8240, lng: -71.4128 },
  "Cranston": { lat: 41.7798, lng: -71.4373 },
  "Pawtucket": { lat: 41.8787, lng: -71.3826 },
  "East Providence": { lat: 41.8137, lng: -71.3701 },
  "Woonsocket": { lat: 42.0029, lng: -71.5145 },
  "Cumberland": { lat: 41.9670, lng: -71.4328 },
  "North Providence": { lat: 41.8501, lng: -71.4662 },
  "Johnston": { lat: 41.8220, lng: -71.5190 },
  "Smithfield": { lat: 41.9223, lng: -71.5490 },
  "Lincoln": { lat: 41.9209, lng: -71.4345 },
  "Central Falls": { lat: 41.8909, lng: -71.3934 },
  "North Smithfield": { lat: 41.9665, lng: -71.5498 },
  "Burrillville": { lat: 41.9762, lng: -71.6832 },
  "Glocester": { lat: 41.8862, lng: -71.6832 },
  "Foster": { lat: 41.8545, lng: -71.7565 },
  "Scituate": { lat: 41.8173, lng: -71.6176 },
  // Kent County
  "Warwick": { lat: 41.7001, lng: -71.4162 },
  "Coventry": { lat: 41.7001, lng: -71.6528 },
  "West Warwick": { lat: 41.6962, lng: -71.5192 },
  "East Greenwich": { lat: 41.6604, lng: -71.4590 },
  "West Greenwich": { lat: 41.6329, lng: -71.6620 },
  // Washington County
  "South Kingstown": { lat: 41.4468, lng: -71.5254 },
  "North Kingstown": { lat: 41.5501, lng: -71.4534 },
  "Westerly": { lat: 41.3776, lng: -71.8273 },
  "Narragansett": { lat: 41.4501, lng: -71.4495 },
  "Hopkinton": { lat: 41.4612, lng: -71.7776 },
  "Charlestown": { lat: 41.3832, lng: -71.6418 },
  "Richmond": { lat: 41.4776, lng: -71.6776 },
  "Exeter": { lat: 41.5779, lng: -71.5462 },
  "New Shoreham": { lat: 41.1855, lng: -71.5775 },
  // Newport County
  "Newport": { lat: 41.4901, lng: -71.3128 },
  "Middletown": { lat: 41.5176, lng: -71.2862 },
  "Portsmouth": { lat: 41.6023, lng: -71.2534 },
  "Tiverton": { lat: 41.6262, lng: -71.2134 },
  "Little Compton": { lat: 41.5151, lng: -71.1634 },
  "Jamestown": { lat: 41.4973, lng: -71.3673 },
  // Bristol County
  "Bristol": { lat: 41.6771, lng: -71.2662 },
  "Warren": { lat: 41.7301, lng: -71.2823 },
  "Barrington": { lat: 41.7409, lng: -71.3184 },
};

// County centers (approximate geometric center)
export const COUNTY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Providence": { lat: 41.8700, lng: -71.5200 },
  "Kent": { lat: 41.6800, lng: -71.5700 },
  "Washington": { lat: 41.4500, lng: -71.6000 },
  "Newport": { lat: 41.5400, lng: -71.2800 },
  "Bristol": { lat: 41.7100, lng: -71.2900 },
};

// Normalize city names (handle case variations from 401gives.org)
export function normalizeCity(city: string): string {
  const normalized = city.trim().replace(/,\s*(Rhode Island|RI)$/i, "").trim();
  // Title case
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Look up county for a city (case-insensitive)
export function getCountyForCity(city: string): string | null {
  const normalized = normalizeCity(city);
  return CITY_TO_COUNTY[normalized] ?? null;
}

// Get coordinates for a city
export function getCoordsForCity(city: string): { lat: number; lng: number } | null {
  const normalized = normalizeCity(city);
  return CITY_COORDS[normalized] ?? null;
}
