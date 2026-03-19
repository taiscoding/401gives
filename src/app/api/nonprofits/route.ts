import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nonprofits, causes, nonprofitCauses } from "@/lib/schema";
import { eq, sql, and, ne } from "drizzle-orm";

// Normalize city name variants to canonical form
const CITY_ALIASES: Record<string, string> = {
  "North Kingston": "North Kingstown",
  "N Kingstown": "North Kingstown",
  "N. Kingstown": "North Kingstown",
  "Smithifeld": "Smithfield",
  "E Providence": "East Providence",
  "E. Providence": "East Providence",
  "N Providence": "North Providence",
  "N. Providence": "North Providence",
  "W Warwick": "West Warwick",
  "W. Warwick": "West Warwick",
  "E Greenwich": "East Greenwich",
  "E. Greenwich": "East Greenwich",
  "W Greenwich": "West Greenwich",
  "W. Greenwich": "West Greenwich",
  "N Smithfield": "North Smithfield",
  "N. Smithfield": "North Smithfield",
};

function normalizeCity(city: string): string {
  const trimmed = city.trim();
  return CITY_ALIASES[trimmed] || trimmed;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawCity = searchParams.get("city");
  const cause = searchParams.get("cause");

  // Find all DB variants that map to this canonical city name
  function getCityVariants(canonical: string): string[] {
    const variants = [canonical];
    for (const [alias, target] of Object.entries(CITY_ALIASES)) {
      if (target === canonical) variants.push(alias);
    }
    return variants;
  }

  const city = rawCity ? normalizeCity(rawCity) : null;
  const cityVariants = city ? getCityVariants(city) : [];

  try {
    // Level 3: city + cause specified, return individual nonprofits
    if (city && cause) {
      const rows = await db
        .select({
          id: nonprofits.id,
          name: nonprofits.name,
          slug: nonprofits.slug,
          city: nonprofits.city,
          county: nonprofits.county,
          lat: nonprofits.lat,
          lng: nonprofits.lng,
          logoUrl: nonprofits.logoUrl,
          mission: nonprofits.mission,
          donateUrl: nonprofits.donateUrl,
        })
        .from(nonprofits)
        .innerJoin(nonprofitCauses, eq(nonprofitCauses.nonprofitId, nonprofits.id))
        .innerJoin(causes, eq(causes.id, nonprofitCauses.causeId))
        .where(and(
          sql`${nonprofits.city} IN (${sql.join(cityVariants.map(v => sql`${v}`), sql`, `)})`,
          eq(causes.name, cause)
        ));

      // Also fetch all causes for each nonprofit for the chips
      const nonprofitIds = rows.map((r) => r.id);
      let nonprofitCausesMap: Record<string, string[]> = {};

      if (nonprofitIds.length > 0) {
        const allCauses = await db
          .select({
            nonprofitId: nonprofitCauses.nonprofitId,
            causeName: causes.name,
            causeColor: causes.color,
          })
          .from(nonprofitCauses)
          .innerJoin(causes, eq(causes.id, nonprofitCauses.causeId))
          .where(
            sql`${nonprofitCauses.nonprofitId} IN (${sql.join(
              nonprofitIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          );

        for (const row of allCauses) {
          if (!nonprofitCausesMap[row.nonprofitId]) {
            nonprofitCausesMap[row.nonprofitId] = [];
          }
          nonprofitCausesMap[row.nonprofitId].push(row.causeName);
        }
      }

      // Fetch related nonprofits for each nonprofit in this result set.
      // Related = same city, shares at least one cause, different nonprofit. Limit 4 per nonprofit.
      let relatedMap: Record<
        string,
        { name: string; slug: string; city: string; logoUrl: string | null }[]
      > = {};

      if (nonprofitIds.length > 0) {
        for (const np of rows) {
          const npCauses = nonprofitCausesMap[np.id] || [];
          if (npCauses.length === 0) continue;

          const relatedRows = await db
            .selectDistinctOn([nonprofits.id], {
              id: nonprofits.id,
              name: nonprofits.name,
              slug: nonprofits.slug,
              city: nonprofits.city,
              logoUrl: nonprofits.logoUrl,
            })
            .from(nonprofits)
            .innerJoin(
              nonprofitCauses,
              eq(nonprofitCauses.nonprofitId, nonprofits.id)
            )
            .innerJoin(causes, eq(causes.id, nonprofitCauses.causeId))
            .where(
              and(
                eq(nonprofits.city, np.city),
                ne(nonprofits.id, np.id),
                sql`${causes.name} IN (${sql.join(
                  npCauses.map((c) => sql`${c}`),
                  sql`, `
                )})`
              )
            )
            .limit(4);

          relatedMap[np.id] = relatedRows.map((r) => ({
            name: r.name,
            slug: r.slug,
            city: r.city,
            logoUrl: r.logoUrl,
          }));
        }
      }

      return NextResponse.json({
        nonprofits: rows.map((r) => ({
          ...r,
          causes: nonprofitCausesMap[r.id] || [],
          related: relatedMap[r.id] || [],
        })),
      });
    }

    // Level 2: city specified, return cause breakdown for that city
    if (city) {
      const rows = await db
        .select({
          name: causes.name,
          color: causes.color,
          count: sql<number>`count(*)::int`,
        })
        .from(nonprofitCauses)
        .innerJoin(causes, eq(causes.id, nonprofitCauses.causeId))
        .innerJoin(nonprofits, eq(nonprofits.id, nonprofitCauses.nonprofitId))
        .where(sql`${nonprofits.city} IN (${sql.join(cityVariants.map(v => sql`${v}`), sql`, `)})`)
        .groupBy(causes.name, causes.color)
        .orderBy(sql`count(*) desc`);

      return NextResponse.json({ causes: rows });
    }

    // Level 1: no params, return city summaries
    const rawCities = await db
      .select({
        name: nonprofits.city,
        county: nonprofits.county,
        count: sql<number>`count(*)::int`,
        lat: sql<number>`avg(${nonprofits.lat})`,
        lng: sql<number>`avg(${nonprofits.lng})`,
      })
      .from(nonprofits)
      .groupBy(nonprofits.city, nonprofits.county)
      .orderBy(sql`count(*) desc`);

    // Merge duplicate city names (e.g. "North Kingston" + "N Kingstown" → "North Kingstown")
    const cityMap = new Map<string, typeof rawCities[0]>();
    for (const c of rawCities) {
      const canonical = normalizeCity(c.name);
      const existing = cityMap.get(canonical);
      if (existing) {
        existing.count += c.count;
        // Weighted average of coords
        const totalCount = existing.count;
        existing.lat = (existing.lat * (totalCount - c.count) + c.lat * c.count) / totalCount;
        existing.lng = (existing.lng * (totalCount - c.count) + c.lng * c.count) / totalCount;
      } else {
        cityMap.set(canonical, { ...c, name: canonical });
      }
    }
    const cities = Array.from(cityMap.values()).sort((a, b) => b.count - a.count);

    // Also return all cause names for reference
    const allCauses = await db
      .select({ name: causes.name, color: causes.color })
      .from(causes)
      .orderBy(causes.name);

    return NextResponse.json({
      cities,
      causes: allCauses.map((c) => c.name),
    });
  } catch (error) {
    console.error("Nonprofits API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch nonprofits" },
      { status: 500 }
    );
  }
}
