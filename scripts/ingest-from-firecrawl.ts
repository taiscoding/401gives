/**
 * Ingest nonprofits from firecrawl scraped markdown files.
 * Parses org names, slugs, and cities from the 401gives.org search page markdown.
 *
 * Usage: npx tsx scripts/ingest-from-firecrawl.ts
 */

import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";
import { CITY_TO_COUNTY, CITY_COORDS, normalizeCity } from "../src/data/ri-counties";
import { CAUSE_CATEGORIES } from "../src/data/cause-categories";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

interface ParsedOrg {
  name: string;
  slug: string;
  city: string;
  logoUrl: string | null;
}

function parseMarkdown(markdown: string): ParsedOrg[] {
  const orgs: ParsedOrg[] = [];
  const seen = new Set<string>();

  // Pattern 1: **Name**](url/organizations/slug) followed by City, Rhode Island
  const pattern1 = /\*\*([^*]+)\*\*\]\(https?:\/\/www\.401gives\.org\/organizations\/([^)]+)\)[\s\S]*?(?:\n\n|\n)([A-Za-z\s.]+),\s*(?:Rhode Island|RI)/g;
  let match;
  while ((match = pattern1.exec(markdown)) !== null) {
    const slug = match[2];
    if (!seen.has(slug)) {
      seen.add(slug);
      orgs.push({ name: match[1].trim(), slug, city: match[3].trim(), logoUrl: null });
    }
  }

  // Pattern 2: [Name](url/organizations/slug) without bold
  const pattern2 = /\[([^\]]+)\]\(https?:\/\/www\.401gives\.org\/organizations\/([^)]+)\)/g;
  while ((match = pattern2.exec(markdown)) !== null) {
    const slug = match[2];
    const name = match[1].trim();
    if (!seen.has(slug) && name.length > 2 && !name.startsWith("View") && !name.startsWith("Checkout")) {
      seen.add(slug);
      // Try to find city after this match
      const afterMatch = markdown.substring(match.index, match.index + 300);
      const cityMatch = afterMatch.match(/([A-Za-z][A-Za-z\s.]+),\s*(?:Rhode Island|RI)\b/);
      const city = cityMatch ? cityMatch[1].trim() : "";
      if (city) {
        orgs.push({ name, slug, city, logoUrl: null });
      }
    }
  }

  // Extract logo URLs
  const logoPattern = /!\[.*?\]\((https:\/\/user-content\.givegab\.com\/[^)]+)\)[\s\S]*?\*\*([^*]+)\*\*/g;
  while ((match = logoPattern.exec(markdown)) !== null) {
    const logoUrl = match[1];
    const name = match[2].trim();
    const org = orgs.find(o => o.name === name);
    if (org) org.logoUrl = logoUrl;
  }

  return orgs;
}

async function main() {
  console.log("=== Ingest from Firecrawl Markdown ===\n");

  // Read all markdown files from firecrawl output
  const pagesDir = "/Users/theodoreaddo/24hrfreeradio.com/.firecrawl/401gives-pages";
  const jsonFile = "/Users/theodoreaddo/24hrfreeradio.com/.firecrawl/401gives-search.json";

  const allOrgs: ParsedOrg[] = [];

  // Parse JSON file (has markdown field)
  try {
    const json = JSON.parse(readFileSync(jsonFile, "utf-8"));
    if (json.markdown) {
      const orgs = parseMarkdown(json.markdown);
      console.log(`JSON file: found ${orgs.length} orgs`);
      allOrgs.push(...orgs);
    }
  } catch {}

  // Parse any .md files in pages dir
  try {
    const files = readdirSync(pagesDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const md = readFileSync(`${pagesDir}/${file}`, "utf-8");
      const orgs = parseMarkdown(md);
      console.log(`${file}: found ${orgs.length} orgs`);
      allOrgs.push(...orgs);
    }
  } catch {}

  // Deduplicate by slug
  const uniqueMap = new Map<string, ParsedOrg>();
  for (const org of allOrgs) {
    if (!uniqueMap.has(org.slug)) {
      uniqueMap.set(org.slug, org);
    }
  }
  const unique = Array.from(uniqueMap.values());
  console.log(`\nTotal unique nonprofits: ${unique.length}\n`);

  // Insert causes
  console.log("Inserting causes...");
  for (const cause of CAUSE_CATEGORIES) {
    await db.insert(schema.causes).values({
      name: cause.name,
      slug: cause.slug,
      color: cause.color,
    }).onConflictDoNothing();
  }

  // Insert nonprofits
  console.log("Inserting nonprofits...");
  let inserted = 0;
  let skipped = 0;

  for (const org of unique) {
    const city = normalizeCity(org.city);
    const county = CITY_TO_COUNTY[city];
    const coords = CITY_COORDS[city];

    if (!county || !coords) {
      // Fuzzy match
      const fuzzy = Object.keys(CITY_TO_COUNTY).find(
        c => city.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(city.toLowerCase())
      );
      if (fuzzy) {
        const fCounty = CITY_TO_COUNTY[fuzzy];
        const fCoords = CITY_COORDS[fuzzy];
        if (fCounty && fCoords) {
          await db.insert(schema.nonprofits).values({
            name: org.name,
            slug: org.slug,
            city: fuzzy,
            county: fCounty,
            lat: fCoords.lat,
            lng: fCoords.lng,
            logoUrl: org.logoUrl,
            donateUrl: `https://www.401gives.org/organizations/${org.slug}`,
            confidence: 0.5,
          }).onConflictDoNothing();
          inserted++;
          continue;
        }
      }
      skipped++;
      console.warn(`  Skipped: "${org.name}" (city: "${org.city}")`);
      continue;
    }

    await db.insert(schema.nonprofits).values({
      name: org.name,
      slug: org.slug,
      city,
      county,
      lat: coords.lat,
      lng: coords.lng,
      logoUrl: org.logoUrl,
      donateUrl: `https://www.401gives.org/organizations/${org.slug}`,
      confidence: 0.5,
    }).onConflictDoNothing();
    inserted++;
  }

  console.log(`\nInserted: ${inserted}, Skipped: ${skipped}`);

  // Seed entity cache
  console.log("\nSeeding entity cache...");
  const allNps = await sql`SELECT name, city FROM nonprofits`;
  for (const np of allNps) {
    await db.insert(schema.entityCache).values({
      entityName: np.name as string,
      entityType: "nonprofit",
      confidence: 0.5,
      locationCity: np.city as string,
      locationCountry: "US",
      inferredFrom: [{ source: "401gives.org", claim: "listed_nonprofit", confidence: 0.8, timestamp: new Date().toISOString() }],
    }).onConflictDoNothing();
  }

  const counts = await sql`SELECT COUNT(*) as c FROM nonprofits`;
  const entities = await sql`SELECT COUNT(*) as c FROM entity_cache`;
  console.log(`\n=== Done ===`);
  console.log(`Nonprofits in DB: ${counts[0].c}`);
  console.log(`Entities in cache: ${entities[0].c}`);
}

main().catch(console.error);
