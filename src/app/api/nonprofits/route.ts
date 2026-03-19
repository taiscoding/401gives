import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nonprofits, causes, nonprofitCauses } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const cause = searchParams.get("cause");

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
        .where(and(eq(nonprofits.city, city), eq(causes.name, cause)));

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

      return NextResponse.json({
        nonprofits: rows.map((r) => ({
          ...r,
          causes: nonprofitCausesMap[r.id] || [],
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
        .where(eq(nonprofits.city, city))
        .groupBy(causes.name, causes.color)
        .orderBy(sql`count(*) desc`);

      return NextResponse.json({ causes: rows });
    }

    // Level 1: no params, return city summaries
    const cities = await db
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
