// Cause categories from 401gives.org
// Colors derived from a palette that works on void-black backgrounds

export interface CauseCategory {
  name: string;
  slug: string;
  color: string;
}

export const CAUSE_CATEGORIES: CauseCategory[] = [
  { name: "Animals", slug: "animals", color: "#4ade80" },
  { name: "Arts and Culture", slug: "arts-and-culture", color: "#c084fc" },
  { name: "Community Advocacy", slug: "community-advocacy", color: "#f472b6" },
  { name: "Disability Services", slug: "disability-services", color: "#60a5fa" },
  { name: "Disaster Relief", slug: "disaster-relief", color: "#f87171" },
  { name: "Education", slug: "education", color: "#facc15" },
  { name: "Emergency Response", slug: "emergency-response", color: "#fb923c" },
  { name: "Entrepreneurship", slug: "entrepreneurship", color: "#a78bfa" },
  { name: "Environment", slug: "environment", color: "#34d399" },
  { name: "Ethnic/Immigrant Services", slug: "ethnic-immigrant-services", color: "#e879f9" },
  { name: "Family Violence Shelters, Services", slug: "family-violence", color: "#fb7185" },
  { name: "Health and Wellness", slug: "health-and-wellness", color: "#2dd4bf" },
  { name: "Homelessness & Housing", slug: "homelessness-housing", color: "#fbbf24" },
  { name: "International", slug: "international", color: "#818cf8" },
  { name: "International Migration, Refugee Issues", slug: "migration-refugee", color: "#93c5fd" },
  { name: "LGBTQ+", slug: "lgbtq", color: "#f0abfc" },
  { name: "Politics", slug: "politics", color: "#94a3b8" },
  { name: "Poverty and Hunger", slug: "poverty-and-hunger", color: "#fdba74" },
  { name: "Racial Equity", slug: "racial-equity", color: "#fda4af" },
  { name: "Religion", slug: "religion", color: "#d8b4fe" },
  { name: "Seniors", slug: "seniors", color: "#67e8f9" },
  { name: "Social Justice", slug: "social-justice", color: "#f9a8d4" },
  { name: "Substance Abuse Prevention", slug: "substance-abuse-prevention", color: "#86efac" },
  { name: "Veterans", slug: "veterans", color: "#bef264" },
  { name: "Women's Issues", slug: "womens-issues", color: "#fca5a5" },
  { name: "Youth", slug: "youth", color: "#7dd3fc" },
];

// Lookup cause by name (case-insensitive partial match)
export function findCause(name: string): CauseCategory | undefined {
  const lower = name.toLowerCase().trim();
  return CAUSE_CATEGORIES.find(
    (c) => c.name.toLowerCase() === lower || c.slug === lower
  );
}

// Get color for a cause name
export function getCauseColor(name: string): string {
  return findCause(name)?.color ?? "#22d3ee"; // fallback to signal cyan
}
