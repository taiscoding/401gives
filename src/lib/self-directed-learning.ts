/**
 * Self-Directed Learning
 *
 * The connectome examines its own graph, finds blind spots,
 * and decides what to learn next. No human tells it what to research.
 * It looks at where it's weak and goes to fill the gaps.
 *
 * Questions the connectome asks itself:
 * - Which nonprofits am I missing mission statements for?
 * - Which orgs only have keyword-matched causes (not real data)?
 * - Which cities have thin nonprofit coverage?
 * - Which nonprofits share causes and might be connected?
 * - Which causes are underrepresented in certain counties?
 * - Which entities are stale (not seen in 30+ days)?
 * - Which orgs have low confidence scores?
 * - Where are donate URLs missing?
 *
 * Each question generates a learning task. Tasks are prioritized
 * by impact (how much would learning this improve the connectome).
 */

export type LearningTask = {
  type:
    | "scrape_mission"
    | "research_causes"
    | "explore_city"
    | "find_connections"
    | "research_cause_landscape"
    | "update_stale_entity"
    | "deepen_research"
    | "find_donate_url"
    | "discover_nonprofits";
  description: string;
  query: string; // what to search/scrape for
  nonprofitSlug?: string;
  county?: string;
  priority: number; // 0-1
  reason: string;
  url?: string; // direct URL to scrape if known
};

/**
 * The connectome examines itself and generates learning tasks.
 */
export async function generateLearningTasks(
  sql: any
): Promise<LearningTask[]> {
  const tasks: LearningTask[] = [];

  // 1. Nonprofits with null mission statements (highest priority, direct data gap)
  const missingMissions = await sql`
    SELECT name, slug
    FROM nonprofits
    WHERE mission IS NULL
    ORDER BY confidence DESC
    LIMIT 20
  `;

  for (const org of missingMissions) {
    tasks.push({
      type: "scrape_mission",
      description: `Scrape mission for ${org.name} (no mission text)`,
      query: `${org.name} Rhode Island nonprofit mission`,
      nonprofitSlug: org.slug,
      priority: 0.95,
      reason: `Nonprofit has no mission statement. Cannot inform donors.`,
      url: `https://www.401gives.org/organizations/${org.slug}`,
    });
  }

  // 2. Nonprofits whose causes came from keyword matching, not real data
  // These are orgs with low research_depth (0 means only keyword-matched)
  const keywordOnlyCauses = await sql`
    SELECT n.name, n.slug, n.research_depth,
      COUNT(nc.cause_id) as cause_count
    FROM nonprofits n
    JOIN nonprofit_causes nc ON nc.nonprofit_id = n.id
    WHERE n.research_depth = 0
    GROUP BY n.id, n.name, n.slug, n.research_depth
    ORDER BY cause_count ASC
    LIMIT 15
  `;

  for (const org of keywordOnlyCauses) {
    tasks.push({
      type: "research_causes",
      description: `Research causes for ${org.name} (only keyword-matched)`,
      query: `${org.name} Rhode Island nonprofit programs services`,
      nonprofitSlug: org.slug,
      priority: 0.9,
      reason: `Has ${org.cause_count} cause(s) but all from keyword matching, not verified data.`,
      url: `https://www.401gives.org/organizations/${org.slug}`,
    });
  }

  // 3. Cities with few nonprofits (thin coverage)
  const thinCities = await sql`
    SELECT city, county, COUNT(*) as nonprofit_count
    FROM nonprofits
    GROUP BY city, county
    ORDER BY nonprofit_count ASC
    LIMIT 10
  `;

  for (const city of thinCities) {
    if (Number(city.nonprofit_count) < 5) {
      tasks.push({
        type: "explore_city",
        description: `Explore ${city.city} deeper (only ${city.nonprofit_count} nonprofits known)`,
        query: `${city.city} Rhode Island nonprofits charities organizations`,
        county: city.county,
        priority: 0.85,
        reason: `Only ${city.nonprofit_count} nonprofit(s) known in ${city.city}, ${city.county} County.`,
      });
    }
  }

  // 4. Nonprofits that share 3+ causes (potential connections)
  const sharedCauses = await sql`
    SELECT
      n1.name as name_a, n1.slug as slug_a,
      n2.name as name_b, n2.slug as slug_b,
      COUNT(*) as shared_count
    FROM nonprofit_causes nc1
    JOIN nonprofit_causes nc2 ON nc1.cause_id = nc2.cause_id
      AND nc1.nonprofit_id < nc2.nonprofit_id
    JOIN nonprofits n1 ON n1.id = nc1.nonprofit_id
    JOIN nonprofits n2 ON n2.id = nc2.nonprofit_id
    GROUP BY n1.id, n1.name, n1.slug, n2.id, n2.name, n2.slug
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `;

  for (const pair of sharedCauses) {
    tasks.push({
      type: "find_connections",
      description: `Find connections between ${pair.name_a} and ${pair.name_b} (share ${pair.shared_count} causes)`,
      query: `"${pair.name_a}" "${pair.name_b}" Rhode Island partnership collaboration`,
      priority: 0.6,
      reason: `These orgs share ${pair.shared_count} causes. They may collaborate or serve overlapping populations.`,
    });
  }

  // 5. Causes with thin coverage in specific counties
  const causeLandscape = await sql`
    SELECT c.name as cause_name, c.slug as cause_slug,
      n.county,
      COUNT(*) as org_count
    FROM causes c
    JOIN nonprofit_causes nc ON nc.cause_id = c.id
    JOIN nonprofits n ON n.id = nc.nonprofit_id
    GROUP BY c.id, c.name, c.slug, n.county
    HAVING COUNT(*) < 3
    ORDER BY COUNT(*) ASC
    LIMIT 15
  `;

  for (const row of causeLandscape) {
    tasks.push({
      type: "research_cause_landscape",
      description: `Research ${row.cause_name} landscape in ${row.county} County (thin coverage)`,
      query: `${row.cause_name} ${row.county} County Rhode Island nonprofits`,
      county: row.county,
      priority: 0.7,
      reason: `Only ${row.org_count} org(s) for "${row.cause_name}" in ${row.county} County.`,
    });
  }

  // 6. Stale entities (not seen in 30+ days)
  const staleEntities = await sql`
    SELECT entity_name, entity_type, last_seen, confidence
    FROM entity_cache
    WHERE last_seen < NOW() - INTERVAL '30 days'
    ORDER BY confidence DESC
    LIMIT 10
  `.catch(() => []);

  for (const entity of staleEntities) {
    tasks.push({
      type: "update_stale_entity",
      description: `Update stale entity ${entity.entity_name} (not seen in 30+ days)`,
      query: `${entity.entity_name} Rhode Island`,
      priority: 0.65,
      reason: `Last seen ${entity.last_seen}. Confidence ${Number(entity.confidence).toFixed(2)} may be outdated.`,
    });
  }

  // 7. High-visibility entities with low confidence (we mention them but don't understand them)
  const underConfident = await sql`
    SELECT entity_name, entity_type, mention_count, confidence, research_depth
    FROM entity_cache
    WHERE mention_count >= 3 AND confidence < 0.35
    ORDER BY mention_count DESC
    LIMIT 10
  `.catch(() => []);

  for (const entity of underConfident) {
    tasks.push({
      type: "deepen_research",
      description: `Deepen research on ${entity.entity_name} (${entity.mention_count} mentions, confidence ${Number(entity.confidence).toFixed(2)})`,
      query: `${entity.entity_name} Rhode Island nonprofit details programs`,
      priority: 0.8,
      reason: `High visibility (${entity.mention_count} mentions) but low understanding (confidence ${Number(entity.confidence).toFixed(2)}).`,
    });
  }

  // 8. Nonprofits missing donate URLs
  const missingDonateUrls = await sql`
    SELECT name, slug
    FROM nonprofits
    WHERE donate_url IS NULL
    ORDER BY confidence DESC
    LIMIT 15
  `;

  for (const org of missingDonateUrls) {
    tasks.push({
      type: "find_donate_url",
      description: `Find donate URL for ${org.name}`,
      query: `${org.name} Rhode Island donate`,
      nonprofitSlug: org.slug,
      priority: 0.75,
      reason: `Cannot direct donors to give without a donate URL.`,
      url: `https://www.401gives.org/organizations/${org.slug}`,
    });
  }

  // 9. Counties with overall low nonprofit counts
  const thinCounties = await sql`
    SELECT county, COUNT(*) as total
    FROM nonprofits
    GROUP BY county
    ORDER BY total ASC
  `;

  for (const row of thinCounties) {
    if (Number(row.total) < 10) {
      tasks.push({
        type: "discover_nonprofits",
        description: `Discover more nonprofits in ${row.county} County (only ${row.total} known)`,
        query: `${row.county} County Rhode Island nonprofits charities 401gives`,
        county: row.county,
        priority: 0.85,
        reason: `Entire county only has ${row.total} nonprofit(s) in the database.`,
      });
    }
  }

  // 10. Nonprofits with no causes at all
  const noCauses = await sql`
    SELECT n.name, n.slug
    FROM nonprofits n
    LEFT JOIN nonprofit_causes nc ON nc.nonprofit_id = n.id
    WHERE nc.cause_id IS NULL
    LIMIT 10
  `;

  for (const org of noCauses) {
    tasks.push({
      type: "research_causes",
      description: `Research causes for ${org.name} (no causes assigned at all)`,
      query: `${org.name} Rhode Island nonprofit programs mission`,
      nonprofitSlug: org.slug,
      priority: 0.92,
      reason: `Nonprofit has zero causes. Cannot categorize or recommend.`,
      url: `https://www.401gives.org/organizations/${org.slug}`,
    });
  }

  // Sort by priority descending
  tasks.sort((a, b) => b.priority - a.priority);

  return tasks;
}

/**
 * Execute learning tasks using available tools.
 * Uses firecrawl for scraping when available, falls back to
 * entity cache enrichment otherwise.
 */
export async function executeLearningTasks(
  sql: any,
  tasks: LearningTask[],
  maxTasks: number = 5
): Promise<{ executed: number; learned: string[] }> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  const learned: string[] = [];
  let executed = 0;

  for (const task of tasks.slice(0, maxTasks)) {
    if (
      (task.type === "scrape_mission" ||
        task.type === "research_causes" ||
        task.type === "find_donate_url") &&
      task.url
    ) {
      // Scrape the 401gives.org page directly
      if (!FIRECRAWL_API_KEY) {
        learned.push(`SKIPPED (no FIRECRAWL_API_KEY): ${task.description}`);
        continue;
      }

      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          },
          body: JSON.stringify({
            url: task.url,
            formats: ["markdown"],
          }),
        });

        if (!res.ok) {
          learned.push(`FAILED (${res.status}): ${task.description}`);
          continue;
        }

        const data = await res.json();
        const markdown: string = data.data?.markdown || "";

        if (task.type === "scrape_mission") {
          // Extract mission from the scraped content
          const missionMatch = markdown.match(
            /(?:mission|about|who we are|our purpose)[:\s]*\n+([\s\S]{20,500}?)(?:\n\n|\n#|\n\*\*)/i
          );
          if (missionMatch) {
            const mission = missionMatch[1].trim();
            await sql`
              UPDATE nonprofits
              SET mission = ${mission}, research_depth = research_depth + 1, updated_at = NOW()
              WHERE slug = ${task.nonprofitSlug}
            `;
            learned.push(`LEARNED mission for ${task.nonprofitSlug}: "${mission.slice(0, 80)}..."`);
            executed++;
          } else {
            learned.push(`SCRAPED but no mission found: ${task.description}`);
          }
        } else if (task.type === "find_donate_url") {
          // Look for donate links in the markdown
          const donateMatch = markdown.match(
            /\[.*?donat.*?\]\((https?:\/\/[^\s)]+)\)/i
          ) || markdown.match(
            /(https?:\/\/[^\s)]+(?:donate|give|contribution)[^\s)]*)/i
          );
          if (donateMatch) {
            const donateUrl = donateMatch[1];
            await sql`
              UPDATE nonprofits
              SET donate_url = ${donateUrl}, updated_at = NOW()
              WHERE slug = ${task.nonprofitSlug}
            `;
            learned.push(`FOUND donate URL for ${task.nonprofitSlug}: ${donateUrl}`);
            executed++;
          }
        } else if (task.type === "research_causes") {
          // Log the enrichment for manual review (cause assignment is complex)
          const inference = {
            source: "self_directed_research_causes",
            claim: `scraped_page:${task.url}`,
            confidence: 0.4,
            timestamp: new Date().toISOString(),
          };
          await sql`
            INSERT INTO entity_cache (entity_name, entity_type, inferred_from, location_city, location_country)
            VALUES (${task.query.split(" ")[0]}, 'nonprofit', ${JSON.stringify([inference])}::jsonb, 'Rhode Island', 'US')
            ON CONFLICT (entity_name, entity_type) DO UPDATE SET
              mention_count = entity_cache.mention_count + 1,
              last_seen = NOW(),
              updated_at = NOW()
          `.catch(() => {});

          // Mark research depth increase
          if (task.nonprofitSlug) {
            await sql`
              UPDATE nonprofits
              SET research_depth = research_depth + 1, updated_at = NOW()
              WHERE slug = ${task.nonprofitSlug}
            `;
          }
          learned.push(`RESEARCHED causes page for ${task.nonprofitSlug}`);
          executed++;
        }
      } catch (err) {
        learned.push(`ERROR: ${task.description} - ${err}`);
      }
    } else if (
      task.type === "explore_city" ||
      task.type === "discover_nonprofits" ||
      task.type === "research_cause_landscape"
    ) {
      // These need broader web search or 401gives.org browsing
      if (!FIRECRAWL_API_KEY) {
        learned.push(`SKIPPED (no FIRECRAWL_API_KEY): ${task.description}`);
        continue;
      }

      try {
        // Search 401gives.org for the city/county
        const searchUrl = task.county
          ? `https://www.401gives.org/search?county=${encodeURIComponent(task.county)}`
          : `https://www.401gives.org/search?q=${encodeURIComponent(task.query)}`;

        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          },
          body: JSON.stringify({
            url: searchUrl,
            formats: ["markdown"],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const markdown: string = data.data?.markdown || "";
          // Count org mentions as a signal
          const orgMatches = markdown.match(/\/organizations\//g) || [];
          learned.push(
            `EXPLORED ${task.description}: found ~${orgMatches.length} org references`
          );
          executed++;
        }
      } catch (err) {
        learned.push(`ERROR: ${task.description} - ${err}`);
      }
    } else if (
      task.type === "deepen_research" ||
      task.type === "update_stale_entity"
    ) {
      // Update entity cache timestamps for stale entities
      try {
        await sql`
          UPDATE entity_cache
          SET last_seen = NOW(), updated_at = NOW()
          WHERE entity_name = ${task.query.split(" ")[0]}
        `.catch(() => {});
        learned.push(`TOUCHED entity: ${task.description}`);
        executed++;
      } catch {
        // Entity update failed
      }
    }
  }

  return { executed, learned };
}

/**
 * Summary stats: how healthy is the connectome?
 */
export async function getConnectomeHealth(sql: any): Promise<{
  totalNonprofits: number;
  withMission: number;
  withDonateUrl: number;
  withCauses: number;
  avgConfidence: number;
  totalEntities: number;
  staleEntities: number;
  cityCoverage: { city: string; count: number }[];
  countyCoverage: { county: string; count: number }[];
}> {
  const [totals] = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(mission) as with_mission,
      COUNT(donate_url) as with_donate_url,
      AVG(confidence) as avg_confidence
    FROM nonprofits
  `;

  const [withCauses] = await sql`
    SELECT COUNT(DISTINCT nonprofit_id) as count
    FROM nonprofit_causes
  `;

  const [entityStats] = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '30 days') as stale
    FROM entity_cache
  `.catch(() => [{ total: 0, stale: 0 }]);

  const cityCoverage = await sql`
    SELECT city, COUNT(*) as count
    FROM nonprofits
    GROUP BY city
    ORDER BY count DESC
  `;

  const countyCoverage = await sql`
    SELECT county, COUNT(*) as count
    FROM nonprofits
    GROUP BY county
    ORDER BY count DESC
  `;

  return {
    totalNonprofits: Number(totals.total),
    withMission: Number(totals.with_mission),
    withDonateUrl: Number(totals.with_donate_url),
    withCauses: Number(withCauses.count),
    avgConfidence: Number(totals.avg_confidence),
    totalEntities: Number(entityStats.total),
    staleEntities: Number(entityStats.stale),
    cityCoverage: cityCoverage.map((r: any) => ({
      city: r.city,
      count: Number(r.count),
    })),
    countyCoverage: countyCoverage.map((r: any) => ({
      county: r.county,
      count: Number(r.count),
    })),
  };
}
