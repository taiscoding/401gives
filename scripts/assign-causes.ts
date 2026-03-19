/**
 * Assign causes to nonprofits via keyword matching on nonprofit names.
 *
 * This is a bootstrap heuristic. The connectome can refine mappings later
 * with real engagement data.
 *
 * Usage: npx tsx scripts/assign-causes.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";
import { sql as rawSql } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── Keyword map: cause name -> keywords to match in nonprofit name ───

const CAUSE_KEYWORDS: Record<string, string[]> = {
  Animals: [
    "animal",
    "pet",
    "wildlife",
    "humane",
    "spca",
    "dog",
    "cat",
    "horse",
    "bird",
    "fish",
    "zoo",
    "aquarium",
  ],
  "Arts and Culture": [
    "art",
    "arts",
    "music",
    "theater",
    "theatre",
    "museum",
    "cultural",
    "dance",
    "film",
    "orchestra",
    "choir",
    "gallery",
    "creative",
    "literary",
    "opera",
    "symphony",
    "players",
    "philharmonic",
    "ballet",
    "stage",
    "performing",
  ],
  "Community Advocacy": [
    "community",
    "civic",
    "advocacy",
    "alliance",
    "coalition",
    "neighborhood",
    "leadership",
    "volunteer",
    "rotary",
    "kiwanis",
    "lions club",
    "jaycees",
    "league of",
    "chamber",
    "united way",
  ],
  "Disability Services": [
    "disability",
    "disabilities",
    "disabled",
    "blind",
    "deaf",
    "autism",
    "special needs",
    "adaptive",
    "accessibility",
    "cerebral palsy",
    "down syndrome",
    "epilepsy",
    "arc ",
    "arc of",
  ],
  Education: [
    "education",
    "school",
    "academy",
    "learning",
    "literacy",
    "tutor",
    "mentor",
    "scholarship",
    "student",
    "university",
    "college",
    "library",
    "read",
    "teach",
    "stem",
    "charter",
    "alumni",
    "prep",
  ],
  Environment: [
    "environment",
    "conservation",
    "nature",
    "ecology",
    "river",
    "bay",
    "ocean",
    "water",
    "tree",
    "garden",
    "farm",
    "sustainable",
    "climate",
    "audubon",
    "land trust",
    "watershed",
    "trail",
    "park",
    "green",
    "recycle",
    "clean",
    "sierra",
  ],
  "Health and Wellness": [
    "health",
    "medical",
    "hospital",
    "clinic",
    "cancer",
    "heart",
    "mental",
    "alzheimer",
    "aids",
    "hiv",
    "wellness",
    "disease",
    "therapy",
    "rehab",
    "dental",
    "vision",
    "suicide",
    "hospice",
    "palliative",
    "transplant",
    "leukemia",
    "lung",
    "kidney",
    "diabetes",
    "care ocean state",
    "nursing",
    "blood",
    "brain",
    "stroke",
    "prevention",
    "planned parenthood",
  ],
  "Homelessness & Housing": [
    "homeless",
    "housing",
    "shelter",
    "habitat",
    "crossroads",
    "amos house",
    "house of hope",
  ],
  Youth: [
    "youth",
    "kids",
    "children",
    "child",
    "boy",
    "girl",
    "teen",
    "young",
    "camp",
    "scout",
    "after-school",
    "afterschool",
    "big brother",
    "big sister",
    "ymca",
    "ywca",
    "boys & girls",
    "boys and girls",
    "junior achievement",
    "foster",
    "adoption",
    "pediatric",
  ],
  Seniors: [
    "senior",
    "elder",
    "aging",
    "retirement",
    "aged",
    "aarp",
    "meals on wheels",
  ],
  Veterans: [
    "veteran",
    "military",
    "vfw",
    "legion",
    "uso",
    "wounded warrior",
    "purple heart",
    "armed forces",
  ],
  "Poverty and Hunger": [
    "food",
    "hunger",
    "poverty",
    "meal",
    "pantry",
    "feed",
    "bank",
    "glean",
    "thrift",
    "goodwill",
    "salvation army",
  ],
  "LGBTQ+": [
    "lgbtq",
    "pride",
    "queer",
    "transgender",
    "gay",
    "lesbian",
  ],
  "Racial Equity": [
    "racial",
    "race",
    "equity",
    "black",
    "african",
    "latin",
    "indigenous",
    "naacp",
    "urban league",
  ],
  "Women's Issues": [
    "women",
    "woman",
    "maternal",
    "domestic violence",
    "sojourner",
    "sisterhood",
  ],
  Religion: [
    "church",
    "temple",
    "synagogue",
    "mosque",
    "faith",
    "ministry",
    "congregat",
    "parish",
    "diocese",
    "catholic",
    "baptist",
    "methodist",
    "lutheran",
    "episcopal",
    "presbyterian",
    "jewish",
    "christian",
    "gospel",
    "bible",
    "interfaith",
  ],
  "Social Justice": [
    "justice",
    "rights",
    "reform",
    "aclu",
    "legal aid",
    "immigrant",
    "refugee",
    "migration",
    "civil liberties",
    "civil rights",
    "amnesty",
    "restorative",
    "reentry",
  ],
  "Substance Abuse Prevention": [
    "substance",
    "addiction",
    "recovery",
    "sober",
    "alcohol",
    "drug",
    "opioid",
    "narcotics",
    "anonymous",
  ],
  Entrepreneurship: [
    "entrepreneur",
    "business",
    "startup",
    "incubator",
    "economic development",
    "workforce",
    "job",
    "career",
    "employment",
  ],
  "Emergency Response": [
    "emergency",
    "rescue",
    "fire",
    "safety",
    "disaster",
    "red cross",
    "ems",
    "ambulance",
  ],
  "Ethnic/Immigrant Services": [
    "ethnic",
    "immigrant",
    "cape verdean",
    "haitian",
    "hmong",
    "portuguese",
    "hispanic",
    "cambodian",
    "somali",
    "asian",
    "multicultural",
    "tribal",
  ],
  "Disaster Relief": [
    "disaster relief",
    "hurricane",
    "flood relief",
    "fema",
  ],
  "Family Violence Shelters, Services": [
    "family violence",
    "domestic abuse",
    "battered",
    "safe house",
    "crisis center",
    "violence prevention",
  ],
  International: [
    "international",
    "global",
    "world",
    "peace corps",
    "overseas",
    "developing countries",
  ],
  "International Migration, Refugee Issues": [
    "refugee",
    "asylum",
    "resettlement",
    "displaced",
    "daca",
  ],
  Politics: [
    "political",
    "campaign",
    "voter",
    "election",
    "democrat",
    "republican",
    "ballot",
    "pac",
    "lobby",
  ],
};

const DEFAULT_CAUSE = "Community Advocacy";

async function main() {
  console.log("Fetching nonprofits and causes...");

  const allNonprofits = await db.select().from(schema.nonprofits);
  const allCauses = await db.select().from(schema.causes);

  console.log(`Found ${allNonprofits.length} nonprofits, ${allCauses.length} causes`);

  // Build cause name -> id lookup
  const causeIdByName: Record<string, string> = {};
  for (const c of allCauses) {
    causeIdByName[c.name] = c.id;
  }

  // Verify default cause exists
  if (!causeIdByName[DEFAULT_CAUSE]) {
    throw new Error(`Default cause "${DEFAULT_CAUSE}" not found in DB. Available: ${Object.keys(causeIdByName).join(", ")}`);
  }

  let totalMappings = 0;
  let defaultFallbacks = 0;
  const batchSize = 50;
  const allValues: { nonprofitId: string; causeId: string }[] = [];

  for (const np of allNonprofits) {
    const nameLower = np.name.toLowerCase();
    const matchedCauses = new Set<string>();

    for (const [causeName, keywords] of Object.entries(CAUSE_KEYWORDS)) {
      if (!causeIdByName[causeName]) continue; // skip if cause not in DB

      for (const kw of keywords) {
        if (nameLower.includes(kw.toLowerCase())) {
          matchedCauses.add(causeName);
          break;
        }
      }
    }

    // Default to Community Advocacy if no match
    if (matchedCauses.size === 0) {
      matchedCauses.add(DEFAULT_CAUSE);
      defaultFallbacks++;
    }

    for (const causeName of matchedCauses) {
      allValues.push({
        nonprofitId: np.id,
        causeId: causeIdByName[causeName],
      });
    }

    totalMappings += matchedCauses.size;
  }

  // Insert in batches
  console.log(`Inserting ${allValues.length} mappings in batches of ${batchSize}...`);

  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    await db
      .insert(schema.nonprofitCauses)
      .values(batch)
      .onConflictDoNothing();
  }

  console.log(`Done! Inserted ${totalMappings} cause mappings.`);
  console.log(`  - ${defaultFallbacks} nonprofits defaulted to "${DEFAULT_CAUSE}"`);
  console.log(`  - ${allNonprofits.length - defaultFallbacks} nonprofits matched by keyword`);

  // Update nonprofit_count on causes table
  console.log("Updating cause counts...");
  await db.execute(rawSql`
    UPDATE causes SET nonprofit_count = sub.cnt
    FROM (
      SELECT cause_id, COUNT(*) as cnt
      FROM nonprofit_causes
      GROUP BY cause_id
    ) sub
    WHERE causes.id = sub.cause_id
  `);

  // Verify
  const countResult = await db.execute(
    rawSql`SELECT COUNT(*) as total FROM nonprofit_causes`
  );
  console.log(`Verification: ${JSON.stringify(countResult.rows?.[0] ?? countResult)}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
