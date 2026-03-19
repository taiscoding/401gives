/**
 * 401gives.org Nonprofit Ingestion Script
 *
 * Scrapes all nonprofits from 401gives.org and inserts them into the database.
 *
 * Usage: npx tsx scripts/ingest-nonprofits.ts
 *
 * Requires DATABASE_URL in .env.local
 */

import "dotenv/config";
import * as cheerio from "cheerio";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";
import { CITY_TO_COUNTY, CITY_COORDS, normalizeCity } from "../src/data/ri-counties";
import { CAUSE_CATEGORIES, findCause } from "../src/data/cause-categories";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const BASE_URL = "https://www.401gives.org";
const DELAY_MS = 300; // be respectful

interface ScrapedNonprofit {
  name: string;
  slug: string;
  city: string;
  logoUrl: string | null;
  type: "organization" | "campaign";
}

interface NonprofitDetail {
  mission: string | null;
  causes: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "401gives-connectome/1.0 (nonprofit research)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

// Phase 1: Scrape search results pages for all nonprofit slugs
async function scrapeSearchPage(page: number): Promise<ScrapedNonprofit[]> {
  const url = `${BASE_URL}/search?show_all=true&page=${page}`;
  console.log(`  Fetching page ${page}...`);

  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const nonprofits: ScrapedNonprofit[] = [];

  // Each nonprofit card is an anchor linking to /organizations/{slug} or /campaigns/{slug}
  $("a[href*='/organizations/'], a[href*='/campaigns/']").each((_, el) => {
    const href = $(el).attr("href") || "";

    // Skip if it's just a navigation link (not a card)
    // Cards typically have the org name as bold text
    const nameEl = $(el).find("strong, b, h2, h3").first();
    if (!nameEl.length) return;

    const name = nameEl.text().trim();
    if (!name) return;

    // Extract slug and type
    const orgMatch = href.match(/\/organizations\/([^/?#]+)/);
    const campMatch = href.match(/\/campaigns\/([^/?#]+)/);
    const slug = orgMatch?.[1] || campMatch?.[1];
    const type = orgMatch ? "organization" : "campaign";
    if (!slug) return;

    // Extract city from the text content near the name
    // Pattern: "City, Rhode Island" or "City, RI"
    const cardText = $(el).text();
    const cityMatch = cardText.match(/([A-Za-z\s]+),\s*(?:Rhode Island|RI)\b/i);
    const city = cityMatch ? cityMatch[1].trim() : "";

    // Logo URL
    const img = $(el).find("img").first();
    const logoUrl = img.attr("src") || null;
    const isDefaultLogo = logoUrl?.includes("fallback") || logoUrl?.includes("default");

    nonprofits.push({
      name,
      slug,
      city,
      logoUrl: isDefaultLogo ? null : logoUrl,
      type: type as "organization" | "campaign",
    });
  });

  return nonprofits;
}

// Phase 2: Scrape individual nonprofit detail page for mission and causes
async function scrapeNonprofitDetail(slug: string): Promise<NonprofitDetail> {
  try {
    const url = `${BASE_URL}/organizations/${slug}`;
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Mission text - usually in a description or about section
    let mission: string | null = null;

    // Try common selectors for mission/description
    const descEl = $(".story-text, .organization-description, .nonprofit-description, [class*='description'], [class*='mission'], [class*='about']").first();
    if (descEl.length) {
      mission = descEl.text().trim().slice(0, 1000); // cap at 1000 chars
    }

    // If no dedicated section, try the main content area
    if (!mission) {
      const mainContent = $("main p, .content p, article p").first();
      if (mainContent.length) {
        mission = mainContent.text().trim().slice(0, 1000);
      }
    }

    // Causes - look for category tags/labels
    const causes: string[] = [];
    $("a[href*='cause='], .cause-tag, .category-tag, [class*='cause'], [class*='category']").each((_, el) => {
      const text = $(el).text().trim();
      if (text && findCause(text)) {
        causes.push(text);
      }
    });

    return { mission, causes };
  } catch (error) {
    console.warn(`  Warning: Could not fetch detail for ${slug}: ${error}`);
    return { mission: null, causes: [] };
  }
}

// Deduplicate nonprofits (prefer organizations over campaigns)
function deduplicateNonprofits(all: ScrapedNonprofit[]): ScrapedNonprofit[] {
  const seen = new Map<string, ScrapedNonprofit>();

  for (const np of all) {
    const key = np.slug;
    const existing = seen.get(key);

    // Prefer organizations over campaigns
    if (!existing || (existing.type === "campaign" && np.type === "organization")) {
      seen.set(key, np);
    }
  }

  // Also deduplicate by name (some appear with both /organizations/ and /campaigns/ URLs)
  const byName = new Map<string, ScrapedNonprofit>();
  for (const np of seen.values()) {
    const existing = byName.get(np.name.toLowerCase());
    if (!existing || (existing.type === "campaign" && np.type === "organization")) {
      byName.set(np.name.toLowerCase(), np);
    }
  }

  return Array.from(byName.values());
}

async function main() {
  console.log("=== 401gives.org Nonprofit Ingestion ===\n");

  // Phase 1: Scrape all search pages
  console.log("Phase 1: Scraping search results...");
  const allNonprofits: ScrapedNonprofit[] = [];

  for (let page = 1; page <= 30; page++) { // 29 pages + 1 buffer
    try {
      const pageResults = await scrapeSearchPage(page);
      if (pageResults.length === 0) {
        console.log(`  Page ${page}: empty, stopping pagination.`);
        break;
      }
      allNonprofits.push(...pageResults);
      console.log(`  Page ${page}: found ${pageResults.length} entries`);
      await sleep(DELAY_MS);
    } catch (error) {
      console.log(`  Page ${page}: error (${error}), stopping pagination.`);
      break;
    }
  }

  console.log(`\nTotal scraped: ${allNonprofits.length} entries`);

  // Deduplicate
  const unique = deduplicateNonprofits(allNonprofits);
  console.log(`After dedup: ${unique.length} unique nonprofits\n`);

  // Phase 2: Insert causes first
  console.log("Phase 2: Inserting cause categories...");
  for (const cause of CAUSE_CATEGORIES) {
    await db.insert(schema.causes).values({
      name: cause.name,
      slug: cause.slug,
      color: cause.color,
    }).onConflictDoNothing();
  }
  console.log(`  Inserted ${CAUSE_CATEGORIES.length} causes\n`);

  // Phase 3: Insert nonprofits
  console.log("Phase 3: Inserting nonprofits and fetching details...");
  let inserted = 0;
  let skippedNoCity = 0;
  let detailsFetched = 0;

  for (const np of unique) {
    const city = normalizeCity(np.city);
    const county = CITY_TO_COUNTY[city];
    const coords = CITY_COORDS[city];

    if (!county || !coords) {
      // Try fuzzy match - some cities have "North Scituate" vs "Scituate"
      const fuzzyCity = Object.keys(CITY_TO_COUNTY).find(
        (c) => city.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(city.toLowerCase())
      );

      if (fuzzyCity) {
        const fuzzyCounty = CITY_TO_COUNTY[fuzzyCity];
        const fuzzyCoords = CITY_COORDS[fuzzyCity];
        if (fuzzyCounty && fuzzyCoords) {
          // Use fuzzy match
          const donateUrl = `${BASE_URL}/organizations/${np.slug}`;

          await db.insert(schema.nonprofits).values({
            name: np.name,
            slug: np.slug,
            city: fuzzyCity,
            county: fuzzyCounty,
            lat: fuzzyCoords.lat,
            lng: fuzzyCoords.lng,
            logoUrl: np.logoUrl,
            donateUrl,
            confidence: 0.5,
          }).onConflictDoNothing();

          inserted++;
          continue;
        }
      }

      skippedNoCity++;
      if (np.city) {
        console.warn(`  Skipped "${np.name}" - unknown city "${np.city}"`);
      }
      continue;
    }

    const donateUrl = `${BASE_URL}/organizations/${np.slug}`;

    // Insert nonprofit
    await db.insert(schema.nonprofits).values({
      name: np.name,
      slug: np.slug,
      city,
      county,
      lat: coords.lat,
      lng: coords.lng,
      logoUrl: np.logoUrl,
      donateUrl,
      confidence: 0.5,
    }).onConflictDoNothing();

    inserted++;

    // Fetch detail page every 5th nonprofit to save time (we can backfill later)
    if (inserted % 5 === 0) {
      const detail = await scrapeNonprofitDetail(np.slug);
      if (detail.mission) {
        // Update mission
        // Note: Drizzle update would need eq import, using raw sql for simplicity
        await sql`UPDATE nonprofits SET mission = ${detail.mission} WHERE slug = ${np.slug}`;
        detailsFetched++;
      }
      await sleep(DELAY_MS);
    }

    if (inserted % 50 === 0) {
      console.log(`  Inserted ${inserted}/${unique.length}...`);
    }
  }

  console.log(`\n  Inserted: ${inserted}`);
  console.log(`  Details fetched: ${detailsFetched}`);
  console.log(`  Skipped (no city match): ${skippedNoCity}`);

  // Phase 4: Seed entity cache
  console.log("\nPhase 4: Seeding entity cache...");

  // Insert nonprofit entities
  const allNps = await sql`SELECT id, name, city, county FROM nonprofits`;
  for (const np of allNps) {
    await db.insert(schema.entityCache).values({
      entityName: np.name as string,
      entityType: "nonprofit",
      confidence: 0.5,
      mentionCount: 1,
      locationCity: np.city as string,
      locationCountry: "US",
      inferredFrom: [{ source: "401gives.org", claim: `listed_as_nonprofit`, confidence: 0.8, timestamp: new Date().toISOString() }],
    }).onConflictDoNothing();
  }

  // Insert city entities
  for (const [city, county] of Object.entries(CITY_TO_COUNTY)) {
    await db.insert(schema.entityCache).values({
      entityName: city,
      entityType: "city",
      confidence: 0.8,
      mentionCount: 1,
      locationCity: city,
      locationCountry: "US",
      metadata: { county },
      inferredFrom: [{ source: "rigis", claim: `ri_municipality`, confidence: 1.0, timestamp: new Date().toISOString() }],
    }).onConflictDoNothing();
  }

  // Insert county entities
  for (const county of ["Providence", "Kent", "Washington", "Newport", "Bristol"]) {
    await db.insert(schema.entityCache).values({
      entityName: `${county} County`,
      entityType: "county",
      confidence: 0.9,
      mentionCount: 1,
      locationCountry: "US",
      metadata: { state: "Rhode Island" },
      inferredFrom: [{ source: "rigis", claim: `ri_county`, confidence: 1.0, timestamp: new Date().toISOString() }],
    }).onConflictDoNothing();
  }

  // Insert cause entities
  for (const cause of CAUSE_CATEGORIES) {
    await db.insert(schema.entityCache).values({
      entityName: cause.name,
      entityType: "cause",
      confidence: 0.7,
      mentionCount: 1,
      metadata: { slug: cause.slug, color: cause.color },
      inferredFrom: [{ source: "401gives.org", claim: `cause_category`, confidence: 0.9, timestamp: new Date().toISOString() }],
    }).onConflictDoNothing();
  }

  const entityCount = await sql`SELECT COUNT(*) as count FROM entity_cache`;
  console.log(`  Entity cache seeded with ${entityCount[0].count} entities`);

  // Summary
  const nonprofitCount = await sql`SELECT COUNT(*) as count FROM nonprofits`;
  const causeCount = await sql`SELECT COUNT(*) as count FROM causes`;

  console.log("\n=== Ingestion Complete ===");
  console.log(`  Nonprofits: ${nonprofitCount[0].count}`);
  console.log(`  Causes: ${causeCount[0].count}`);
  console.log(`  Entities: ${entityCount[0].count}`);
  console.log(`\nDone!`);
}

main().catch(console.error);
