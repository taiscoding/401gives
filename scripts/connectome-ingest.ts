/**
 * Connectome Ingestion Script
 *
 * Processes scraped firecrawl data and feeds it into the database,
 * making the connectome "alive" with real cause mappings, mission
 * statements, and enriched entity cache inferences.
 *
 * Phase 1: Parse cause-filtered pages for real cause mappings
 * Phase 2: Parse org detail pages for missions/descriptions
 * Phase 3: Update database with real data
 * Phase 4: Enrich entity cache with new inferences
 * Phase 5: Report what was learned
 *
 * Usage: npx tsx scripts/connectome-ingest.ts
 */

import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql as rawSql, and, inArray } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { CAUSE_CATEGORIES } from "../src/data/cause-categories";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── Paths ───────────────────────────────────────────────────────
const CAUSES_DIR =
  "/Users/theodoreaddo/24hrfreeradio.com/.firecrawl/401gives-causes";
const ORGS_DIR =
  "/Users/theodoreaddo/24hrfreeradio.com/.firecrawl/401gives-orgs";

// ─── Filename slug -> canonical cause name mapping ───────────────
// The cause files use URL slugs from 401gives.org which differ
// slightly from our CAUSE_CATEGORIES slugs.
const FILE_SLUG_TO_CAUSE: Record<string, string> = {};
for (const cat of CAUSE_CATEGORIES) {
  // Direct slug match
  FILE_SLUG_TO_CAUSE[cat.slug] = cat.name;
}
// Handle mismatches between 401gives URL slugs and our slugs
FILE_SLUG_TO_CAUSE["ethnic---immigrant-services"] =
  "Ethnic/Immigrant Services";
FILE_SLUG_TO_CAUSE["ethnic-immigrant-services"] = "Ethnic/Immigrant Services";
FILE_SLUG_TO_CAUSE["family-violence-shelters-services"] =
  "Family Violence Shelters, Services";
FILE_SLUG_TO_CAUSE["family-violence"] =
  "Family Violence Shelters, Services";
FILE_SLUG_TO_CAUSE["homelessness-and-housing"] = "Homelessness & Housing";
FILE_SLUG_TO_CAUSE["homelessness-housing"] = "Homelessness & Housing";
FILE_SLUG_TO_CAUSE["international-migration-refugee-issues"] =
  "International Migration, Refugee Issues";
FILE_SLUG_TO_CAUSE["migration-refugee"] =
  "International Migration, Refugee Issues";
FILE_SLUG_TO_CAUSE["lgbtq"] = "LGBTQ+";
FILE_SLUG_TO_CAUSE["womens-issues"] = "Women's Issues";

// ─── Types ───────────────────────────────────────────────────────

interface CauseMapping {
  slug: string; // org slug
  causeName: string;
}

interface OrgDetail {
  slug: string;
  name: string | null;
  mission: string | null;
  logoUrl: string | null;
  campaigns: string[];
  donationLevels: string[];
}

// ─── Phase 1: Parse cause-filtered pages ─────────────────────────

function parseCauseFile(filePath: string, causeName: string): string[] {
  const md = readFileSync(filePath, "utf-8");
  const slugs: string[] = [];
  const seen = new Set<string>();

  // Extract org slugs from /organizations/slug links
  const orgPattern =
    /https?:\/\/www\.401gives\.org\/organizations\/([a-z0-9][a-z0-9-]*[a-z0-9])/g;
  let match;
  while ((match = orgPattern.exec(md)) !== null) {
    const slug = match[1];
    if (!seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }

  return slugs;
}

function parseCausePages(): CauseMapping[] {
  const mappings: CauseMapping[] = [];

  if (!existsSync(CAUSES_DIR)) {
    console.warn(`  Causes directory not found: ${CAUSES_DIR}`);
    return mappings;
  }

  const files = readdirSync(CAUSES_DIR).filter((f) => f.endsWith(".md"));
  console.log(`  Found ${files.length} cause files`);

  for (const file of files) {
    const fileSlug = file.replace(".md", "");
    const causeName = FILE_SLUG_TO_CAUSE[fileSlug];

    if (!causeName) {
      console.warn(`  Unknown cause file slug: "${fileSlug}" (${file})`);
      continue;
    }

    const slugs = parseCauseFile(`${CAUSES_DIR}/${file}`, causeName);
    console.log(`  ${causeName}: ${slugs.length} orgs`);

    for (const slug of slugs) {
      mappings.push({ slug, causeName });
    }
  }

  return mappings;
}

// ─── Phase 2: Parse org detail pages ─────────────────────────────

function extractMission(md: string): string | null {
  // Strategy: find "Our Story" section, then grab paragraph content after it
  const storyMatch = md.match(/## Our Story\s*\n([\s\S]*?)(?=\n##|\n\[Donate\]|\n\*\*\*|\n---|\n#### Your gift basket)/);
  if (storyMatch) {
    let story = storyMatch[1].trim();
    // Clean up the story text
    story = cleanMarkdownText(story);
    if (story.length > 30) return story;
  }

  // Look for ### blocks that contain mission-like descriptions
  // (some orgs put their description in h3 blocks after donation levels)
  const h3Blocks = md.match(/### ([^\n]+(?:\n(?!#|\[|\$|!\[)[^\n]+)*)/g);
  if (h3Blocks) {
    for (const block of h3Blocks) {
      const text = block.replace(/^### /, "").trim();
      // Skip navigation, campaigns, donation levels, and short labels
      if (
        text.length > 80 &&
        !text.includes("Your Gift Basket") &&
        !text.includes("gift basket is full") &&
        !text.includes("Share URL") &&
        !text.startsWith("What our") &&
        !text.startsWith("[")
      ) {
        return cleanMarkdownText(text);
      }
    }
  }

  // Last resort: look for long paragraphs between the org heading and donation section
  const headingMatch = md.match(/^# (.+)$/m);
  if (headingMatch) {
    const headingIdx = md.indexOf(headingMatch[0]);
    const donateIdx = md.indexOf("[Donate]", headingIdx + headingMatch[0].length);
    if (donateIdx > headingIdx) {
      const between = md.substring(headingIdx + headingMatch[0].length, donateIdx);
      // Find the longest paragraph-like text
      const paragraphs = between.split(/\n{2,}/).map((p) => p.trim());
      for (const p of paragraphs) {
        const cleaned = cleanMarkdownText(p);
        if (
          cleaned.length > 80 &&
          !cleaned.startsWith("[") &&
          !cleaned.startsWith("!") &&
          !cleaned.includes("$") &&
          !cleaned.includes("Donate") &&
          !cleaned.includes("Checkout")
        ) {
          return cleaned;
        }
      }
    }
  }

  return null;
}

function cleanMarkdownText(text: string): string {
  let cleaned = text
    // Remove image markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Remove link markdown but keep text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    // Remove heading markers
    .replace(/^#{1,4}\s*/gm, "")
    // Remove horizontal rules
    .replace(/^\* \* \*$/gm, "")
    .replace(/^---$/gm, "")
    // Remove YouTube embed artifacts
    .replace(/.*YouTube\s*$/gm, "")
    .replace(/.*- YouTube$/gm, "")
    .replace(/Photo image of.*$/gm, "")
    .replace(/\d+ subscribers?/g, "")
    .replace(/.*from .+ on Vimeo$/gm, "")
    .replace(/Link to video owner's profile/g, "")
    // Remove video/embed artifacts
    .replace(/Playing in picture-in-picture/g, "")
    .replace(/More options/g, "")
    .replace(/SettingsPicture-in-PictureFullscreen/g, "")
    .replace(/Show controls.*$/gm, "")
    .replace(/QualityAuto/g, "")
    .replace(/SpeedNormal/g, "")
    .replace(/\d{2}:\d{2}/g, "")
    .replace(/^Like$/gm, "")
    .replace(/^Add to Watch Later$/gm, "")
    .replace(/^Share$/gm, "")
    .replace(/^Play$/gm, "")
    .replace(/^Watch on Vimeo$/gm, "")
    .replace(/^# More options$/gm, "")
    .replace(/^# Settings$/gm, "")
    // Remove Fundraising/campaign artifacts
    .replace(/^Fundraising \d{4}.*$/gm, "")
    // Collapse whitespace
    .replace(/\n{3,}/g, "\n\n")
    .replace(/  +/g, " ")
    .trim();

  // If the result still looks like embed junk (very short lines, no real sentences), return empty
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  const avgLineLen =
    lines.length > 0
      ? lines.reduce((sum, l) => sum + l.length, 0) / lines.length
      : 0;
  if (lines.length > 3 && avgLineLen < 15) {
    return "";
  }

  return cleaned;
}

function extractLogoUrl(md: string): string | null {
  // Logo is typically the first image after the nav, before the h1
  const h1Match = md.match(/^# (.+)$/m);
  if (!h1Match) return null;

  const h1Idx = md.indexOf(h1Match[0]);
  // Look for givegab logo images before the h1
  const beforeH1 = md.substring(Math.max(0, h1Idx - 500), h1Idx);
  const logoMatch = beforeH1.match(
    /!\[.*?\]\((https:\/\/user-content\.givegab\.com\/uploads\/group\/logo\/[^)]+)\)/
  );
  return logoMatch ? logoMatch[1] : null;
}

function extractCampaigns(md: string): string[] {
  const campaigns: string[] = [];
  const campaignPattern =
    /\[([^\]]+)\]\(https:\/\/www\.401gives\.org\/campaigns\/[^)]+\)/g;
  let match;
  while ((match = campaignPattern.exec(md)) !== null) {
    const name = match[1].trim();
    if (
      name.length > 2 &&
      !name.startsWith("View") &&
      !name.startsWith("Checkout") &&
      !name.startsWith("Donate") &&
      name !== "Stay"
    ) {
      campaigns.push(name);
    }
  }
  // Deduplicate
  return [...new Set(campaigns)];
}

function extractDonationLevels(md: string): string[] {
  const levels: string[] = [];
  // Pattern: $amount\ndescription or $amount - description
  const levelPattern =
    /\$([0-9,]+(?:\.\d{2})?)\s*(?:\\?\n|[-:])\s*([^\n\]$]+)/g;
  let match;
  while ((match = levelPattern.exec(md)) !== null) {
    const amount = match[1].replace(",", "");
    const desc = match[2].trim();
    if (desc.length > 5 && !desc.includes("Amount must be")) {
      levels.push(`$${amount}: ${desc}`);
    }
  }
  return [...new Set(levels)];
}

function parseOrgDetailPages(): OrgDetail[] {
  const details: OrgDetail[] = [];

  if (!existsSync(ORGS_DIR)) {
    console.warn(`  Orgs directory not found: ${ORGS_DIR}`);
    return details;
  }

  const files = readdirSync(ORGS_DIR).filter((f) => f.endsWith(".md"));
  console.log(`  Found ${files.length} org detail files`);

  for (const file of files) {
    const md = readFileSync(`${ORGS_DIR}/${file}`, "utf-8");

    // Slug is filename without .md, but some have UUIDs appended
    let slug = file.replace(".md", "");
    // Strip UUID suffix if present (e.g., "arts-alive-663a1ab3-546d-4f98-afe1-7f8dcf0ea44b")
    const uuidSuffix = slug.match(
      /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    if (uuidSuffix) {
      slug = slug.replace(uuidSuffix[0], "");
    }

    // Extract org name from h1
    const nameMatch = md.match(/^# (.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : null;

    const mission = extractMission(md);
    const logoUrl = extractLogoUrl(md);
    const campaigns = extractCampaigns(md);
    const donationLevels = extractDonationLevels(md);

    details.push({ slug, name, mission, logoUrl, campaigns, donationLevels });
  }

  return details;
}

// ─── Phase 3: Update database ────────────────────────────────────

async function updateCauseMappings(mappings: CauseMapping[]) {
  console.log("\n--- Phase 3a: Updating cause mappings ---");

  // Get all causes from DB
  const allCauses = await db.select().from(schema.causes);
  const causeIdByName: Record<string, string> = {};
  for (const c of allCauses) {
    causeIdByName[c.name] = c.id;
  }

  // Get all nonprofits from DB
  const allNonprofits = await db.select().from(schema.nonprofits);
  const npIdBySlug: Record<string, string> = {};
  for (const np of allNonprofits) {
    npIdBySlug[np.slug] = np.id;
  }

  // Build real cause mapping values
  const realMappingValues: { nonprofitId: string; causeId: string }[] = [];
  const unmatchedSlugs = new Set<string>();
  const unmatchedCauses = new Set<string>();

  for (const mapping of mappings) {
    const npId = npIdBySlug[mapping.slug];
    const causeId = causeIdByName[mapping.causeName];

    if (!npId) {
      unmatchedSlugs.add(mapping.slug);
      continue;
    }
    if (!causeId) {
      unmatchedCauses.add(mapping.causeName);
      continue;
    }

    realMappingValues.push({ nonprofitId: npId, causeId });
  }

  if (unmatchedSlugs.size > 0) {
    console.log(
      `  ${unmatchedSlugs.size} org slugs from cause pages not found in DB (scraped but not yet ingested)`
    );
  }
  if (unmatchedCauses.size > 0) {
    console.log(
      `  Unmatched causes: ${[...unmatchedCauses].join(", ")}`
    );
  }

  // Get the set of nonprofit IDs that have real scraped mappings
  const npIdsWithRealMappings = new Set(
    realMappingValues.map((v) => v.nonprofitId)
  );

  // Delete old keyword-matched cause mappings for orgs that now have real data
  if (npIdsWithRealMappings.size > 0) {
    const npIdArray = [...npIdsWithRealMappings];
    const batchSize = 50;
    for (let i = 0; i < npIdArray.length; i += batchSize) {
      const batch = npIdArray.slice(i, i + batchSize);
      await db
        .delete(schema.nonprofitCauses)
        .where(inArray(schema.nonprofitCauses.nonprofitId, batch));
    }
    console.log(
      `  Cleared old keyword-matched mappings for ${npIdsWithRealMappings.size} orgs`
    );
  }

  // Insert real mappings in batches
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < realMappingValues.length; i += batchSize) {
    const batch = realMappingValues.slice(i, i + batchSize);
    await db
      .insert(schema.nonprofitCauses)
      .values(batch)
      .onConflictDoNothing();
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted} real cause mappings`);

  // Update cause counts
  await db.execute(rawSql`
    UPDATE causes SET nonprofit_count = COALESCE(sub.cnt, 0)
    FROM (
      SELECT cause_id, COUNT(*) as cnt
      FROM nonprofit_causes
      GROUP BY cause_id
    ) sub
    WHERE causes.id = sub.cause_id
  `);
  console.log("  Updated cause counts");

  return { npIdsWithRealMappings };
}

async function updateOrgDetails(details: OrgDetail[]) {
  console.log("\n--- Phase 3b: Updating org missions and details ---");

  let missionsUpdated = 0;
  let logosUpdated = 0;
  let campaignsFound = 0;

  for (const detail of details) {
    if (!detail.mission && !detail.logoUrl) continue;

    // Find the nonprofit by slug
    const results = await db
      .select()
      .from(schema.nonprofits)
      .where(eq(schema.nonprofits.slug, detail.slug));

    if (results.length === 0) continue;

    const np = results[0];
    const updates: Partial<{
      mission: string;
      logoUrl: string;
      updatedAt: Date;
    }> = {};

    if (
      detail.mission &&
      (!np.mission || np.mission.length < detail.mission.length) &&
      !detail.mission.includes("YouTube") &&
      !detail.mission.includes("subscribers") &&
      !detail.mission.includes("Vimeo")
    ) {
      updates.mission = detail.mission;
      missionsUpdated++;
    }

    if (detail.logoUrl && !np.logoUrl) {
      updates.logoUrl = detail.logoUrl;
      logosUpdated++;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db
        .update(schema.nonprofits)
        .set(updates)
        .where(eq(schema.nonprofits.id, np.id));
    }

    if (detail.campaigns.length > 0) {
      campaignsFound += detail.campaigns.length;
      // Insert campaigns
      for (const campaignName of detail.campaigns) {
        const campaignSlug = campaignName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        await db
          .insert(schema.campaigns)
          .values({
            nonprofitId: np.id,
            name: campaignName,
            slug: campaignSlug,
            active: true,
          })
          .onConflictDoNothing();
      }
    }
  }

  console.log(`  Missions updated: ${missionsUpdated}`);
  console.log(`  Logos updated: ${logosUpdated}`);
  console.log(`  Campaigns discovered: ${campaignsFound}`);

  return { missionsUpdated, logosUpdated, campaignsFound };
}

// ─── Phase 4: Enrich entity cache ────────────────────────────────

async function enrichEntityCache(
  causeMappings: CauseMapping[],
  orgDetails: OrgDetail[],
  npIdsWithRealMappings: Set<string>
) {
  console.log("\n--- Phase 4: Enriching entity cache ---");

  const now = new Date().toISOString();
  let updated = 0;
  let inferencesAdded = 0;

  // Get all nonprofits for cross-referencing
  const allNonprofits = await db.select().from(schema.nonprofits);
  const npBySlug: Record<string, (typeof allNonprofits)[0]> = {};
  for (const np of allNonprofits) {
    npBySlug[np.slug] = np;
  }

  // Build slug -> causes lookup from real mappings
  const slugToCauses: Record<string, Set<string>> = {};
  for (const mapping of causeMappings) {
    if (!slugToCauses[mapping.slug]) {
      slugToCauses[mapping.slug] = new Set();
    }
    slugToCauses[mapping.slug].add(mapping.causeName);
  }

  // Build slug -> detail lookup
  const slugToDetail: Record<string, OrgDetail> = {};
  for (const detail of orgDetails) {
    slugToDetail[detail.slug] = detail;
  }

  // Build cause -> slug[] for co-cause relationships
  const causeSlugs: Record<string, string[]> = {};
  for (const mapping of causeMappings) {
    if (!causeSlugs[mapping.causeName]) {
      causeSlugs[mapping.causeName] = [];
    }
    causeSlugs[mapping.causeName].push(mapping.slug);
  }

  // Get all entity cache entries for nonprofits
  const allEntities = await db
    .select()
    .from(schema.entityCache)
    .where(eq(schema.entityCache.entityType, "nonprofit"));

  const entityByName: Record<string, (typeof allEntities)[0]> = {};
  for (const e of allEntities) {
    entityByName[e.entityName] = e;
  }

  // Process each nonprofit that we have data for
  for (const np of allNonprofits) {
    const detail = slugToDetail[np.slug];
    const causes = slugToCauses[np.slug];
    const entity = entityByName[np.name];

    if (!detail && !causes) continue;
    if (!entity) continue;

    const newInferences: Array<{
      source: string;
      claim: string;
      confidence: number;
      timestamp: string;
    }> = [...(entity.inferredFrom || [])];

    let newConfidence = entity.confidence;

    // Add cause inferences
    if (causes) {
      for (const cause of causes) {
        const existing = newInferences.find(
          (inf) => inf.claim === `verified_cause:${cause}`
        );
        if (!existing) {
          newInferences.push({
            source: "401gives.org/cause-filter",
            claim: `verified_cause:${cause}`,
            confidence: 0.95,
            timestamp: now,
          });
          inferencesAdded++;
        }
      }
      // Real cause data bumps confidence
      newConfidence = Math.min(1.0, newConfidence + 0.15);
    }

    // Add mission inference
    if (detail?.mission) {
      const existing = newInferences.find(
        (inf) => inf.claim === "has_mission_statement"
      );
      if (!existing) {
        newInferences.push({
          source: "401gives.org/org-page",
          claim: "has_mission_statement",
          confidence: 0.9,
          timestamp: now,
        });
        inferencesAdded++;
      }
      newConfidence = Math.min(1.0, newConfidence + 0.1);
    }

    // Add campaign inference
    if (detail?.campaigns && detail.campaigns.length > 0) {
      const existing = newInferences.find(
        (inf) => inf.claim === "has_active_campaigns"
      );
      if (!existing) {
        newInferences.push({
          source: "401gives.org/org-page",
          claim: `has_active_campaigns:${detail.campaigns.length}`,
          confidence: 0.9,
          timestamp: now,
        });
        inferencesAdded++;
      }
    }

    // Add donation level inference (indicates engagement depth)
    if (detail?.donationLevels && detail.donationLevels.length > 0) {
      const existing = newInferences.find(
        (inf) => inf.claim.startsWith("has_donation_tiers")
      );
      if (!existing) {
        newInferences.push({
          source: "401gives.org/org-page",
          claim: `has_donation_tiers:${detail.donationLevels.length}`,
          confidence: 0.85,
          timestamp: now,
        });
        inferencesAdded++;
      }
    }

    // Add co-cause relationship inferences
    if (causes) {
      const collaborators = new Set<string>(entity.collaborators || []);
      for (const cause of causes) {
        const peers = causeSlugs[cause] || [];
        for (const peerSlug of peers) {
          if (peerSlug === np.slug) continue;
          const peerNp = npBySlug[peerSlug];
          if (peerNp && !collaborators.has(peerNp.name)) {
            collaborators.add(peerNp.name);
          }
        }
      }
      // Cap collaborators at 20 to avoid bloat
      const collabArray = [...collaborators].slice(0, 20);

      // Build genres from causes
      const genresSet = new Set<string>(entity.genres || []);
      for (const cause of causes) {
        genresSet.add(cause);
      }

      await db
        .update(schema.entityCache)
        .set({
          confidence: newConfidence,
          inferredFrom: newInferences,
          collaborators: collabArray,
          genres: [...genresSet],
          researchDepth: Math.max(entity.researchDepth, 2),
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.entityCache.id, entity.id));
      updated++;
    } else {
      // Just update inferences and confidence
      await db
        .update(schema.entityCache)
        .set({
          confidence: newConfidence,
          inferredFrom: newInferences,
          researchDepth: Math.max(entity.researchDepth, 1),
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.entityCache.id, entity.id));
      updated++;
    }
  }

  // Also update confidence on the nonprofits table for orgs with real data
  for (const npId of npIdsWithRealMappings) {
    await db
      .update(schema.nonprofits)
      .set({
        confidence: 0.8,
        researchDepth: 2,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.nonprofits.id, npId),
          rawSql`confidence < 0.8`
        )
      );
  }

  console.log(`  Entity cache entries updated: ${updated}`);
  console.log(`  New inferences added: ${inferencesAdded}`);
}

// ─── Phase 5: Report ─────────────────────────────────────────────

async function report() {
  console.log("\n=== Connectome Ingestion Report ===\n");

  const npCount = await db.execute(
    rawSql`SELECT COUNT(*) as c FROM nonprofits`
  );
  const causeCount = await db.execute(
    rawSql`SELECT COUNT(*) as c FROM nonprofit_causes`
  );
  const entityCount = await db.execute(
    rawSql`SELECT COUNT(*) as c FROM entity_cache`
  );
  const withMission = await db.execute(
    rawSql`SELECT COUNT(*) as c FROM nonprofits WHERE mission IS NOT NULL AND mission != ''`
  );
  const highConfidence = await db.execute(
    rawSql`SELECT COUNT(*) as c FROM entity_cache WHERE confidence >= 0.7`
  );
  const campaignCount = await db.execute(
    rawSql`SELECT COUNT(*) as c FROM campaigns`
  );

  // Top causes by nonprofit count
  const topCauses = await db.execute(
    rawSql`SELECT c.name, c.nonprofit_count FROM causes c ORDER BY c.nonprofit_count DESC LIMIT 10`
  );

  console.log(`Nonprofits in DB:      ${(npCount.rows?.[0] as any)?.c ?? npCount}`);
  console.log(`Cause mappings:        ${(causeCount.rows?.[0] as any)?.c ?? causeCount}`);
  console.log(`Entity cache entries:  ${(entityCount.rows?.[0] as any)?.c ?? entityCount}`);
  console.log(`With mission text:     ${(withMission.rows?.[0] as any)?.c ?? withMission}`);
  console.log(`High confidence (0.7+): ${(highConfidence.rows?.[0] as any)?.c ?? highConfidence}`);
  console.log(`Active campaigns:      ${(campaignCount.rows?.[0] as any)?.c ?? campaignCount}`);

  console.log("\nTop causes by nonprofit count:");
  const rows = topCauses.rows ?? topCauses;
  if (Array.isArray(rows)) {
    for (const row of rows as any[]) {
      console.log(`  ${row.name}: ${row.nonprofit_count}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("=== Connectome Ingestion ===\n");
  console.log("Making the connectome alive with real scraped signals.\n");

  // Phase 1
  console.log("--- Phase 1: Parsing cause-filtered pages ---");
  const causeMappings = parseCausePages();
  console.log(`  Total cause mappings parsed: ${causeMappings.length}`);

  // Deduplicate (same slug can appear on multiple cause pages)
  const uniqueMappings = new Map<string, CauseMapping>();
  for (const m of causeMappings) {
    const key = `${m.slug}::${m.causeName}`;
    if (!uniqueMappings.has(key)) {
      uniqueMappings.set(key, m);
    }
  }
  const dedupedMappings = [...uniqueMappings.values()];
  console.log(`  Unique slug-cause pairs: ${dedupedMappings.length}`);

  // Phase 2
  console.log("\n--- Phase 2: Parsing org detail pages ---");
  const orgDetails = parseOrgDetailPages();
  const withMission = orgDetails.filter((d) => d.mission);
  const withCampaigns = orgDetails.filter((d) => d.campaigns.length > 0);
  const withLogos = orgDetails.filter((d) => d.logoUrl);
  console.log(`  Orgs with mission text: ${withMission.length}`);
  console.log(`  Orgs with campaigns: ${withCampaigns.length}`);
  console.log(`  Orgs with logos: ${withLogos.length}`);

  // Phase 3
  const { npIdsWithRealMappings } = await updateCauseMappings(dedupedMappings);
  await updateOrgDetails(orgDetails);

  // Phase 4
  await enrichEntityCache(
    dedupedMappings,
    orgDetails,
    npIdsWithRealMappings
  );

  // Phase 5
  await report();

  console.log("\nConnectome ingestion complete.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
