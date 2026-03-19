/**
 * Neuroplasticity
 *
 * The connectome rewires itself based on what it learns.
 * Not just accumulation. Restructuring. When patterns emerge,
 * connections strengthen. When patterns break, connections weaken.
 * When new bridges form between previously unrelated entities,
 * the graph topology changes.
 *
 * This is how the connectome gets smarter, not just bigger.
 *
 * Three mechanisms:
 * 1. Hebbian learning: "nodes that fire together wire together"
 *    Co-viewed nonprofits, co-bookmarked causes, co-donated orgs strengthen their edge
 * 2. Synaptic pruning: unused connections decay and eventually die
 * 3. Long-term potentiation: repeated patterns consolidate into
 *    higher-confidence knowledge
 */

import { neon } from "@neondatabase/serverless";

/**
 * Hebbian Learning: strengthen connections between co-occurring entities.
 *
 * When two nonprofits appear in the same browsing session, those nonprofits
 * are connected. When a user donates to two orgs in the same cause area,
 * the connection strengthens.
 *
 * When a nonprofit appears in multiple cause categories, those cause
 * associations solidify.
 */
export async function hebbianUpdate(
  sql: ReturnType<typeof neon>,
  entityA: string,
  entityB: string,
  signal: "co_view" | "co_bookmark" | "co_cause" | "co_donate",
  weight: number = 1.0
): Promise<void> {
  // Ensure both entities exist
  const entities = await sql`
    SELECT entity_name, id FROM entity_cache
    WHERE entity_name IN (${entityA}, ${entityB})
  `;
  if (entities.length < 2) return;

  // Check if connection already exists in inferred_from
  const inference = {
    source: `hebbian_${signal}`,
    claim: `connected_to:${entityB}`,
    confidence: Math.min(0.4, 0.15 * weight),
    timestamp: new Date().toISOString(),
  };

  // Update entity A with connection to B
  await sql`
    UPDATE entity_cache SET
      inferred_from = inferred_from || ${JSON.stringify(inference)}::jsonb,
      confidence = LEAST(0.95, confidence + ${0.01 * weight}),
      updated_at = NOW()
    WHERE entity_name = ${entityA}
  `.catch(() => {});

  // Bidirectional: update B with connection to A
  const reverseInference = {
    ...inference,
    claim: `connected_to:${entityA}`,
  };
  await sql`
    UPDATE entity_cache SET
      inferred_from = inferred_from || ${JSON.stringify(reverseInference)}::jsonb,
      confidence = LEAST(0.95, confidence + ${0.01 * weight}),
      updated_at = NOW()
    WHERE entity_name = ${entityB}
  `.catch(() => {});
}

/**
 * Synaptic Pruning: decay unused connections.
 *
 * Entities that haven't been seen in a long time lose confidence.
 * Connections that never get reinforced fade.
 * The connectome forgets what doesn't matter anymore.
 *
 * 60-day window (giving is less frequent than music listening).
 */
export async function synapticPruning(sql: ReturnType<typeof neon>): Promise<number> {
  // Decay confidence for entities not seen in 60+ days
  const decayed = await sql`
    UPDATE entity_cache SET
      confidence = GREATEST(0.1, confidence - 0.02),
      updated_at = NOW()
    WHERE last_seen < NOW() - INTERVAL '60 days'
      AND confidence > 0.15
    RETURNING id
  `;

  // Remove entities with very low confidence and no recent activity
  const pruned = await sql`
    DELETE FROM entity_cache
    WHERE confidence <= 0.1
      AND mention_count <= 1
      AND last_seen < NOW() - INTERVAL '180 days'
    RETURNING id
  `;

  return decayed.length + pruned.length;
}

/**
 * Long-Term Potentiation: consolidate repeated patterns.
 *
 * When the same inference appears many times from different sources,
 * it's not just a hypothesis anymore. It's approaching knowledge.
 * Boost confidence for claims that have been independently verified.
 *
 * 3+ unique sources -> 0.7 confidence ceiling.
 */
export async function longTermPotentiation(sql: ReturnType<typeof neon>): Promise<number> {
  // Find entities with many inferences about the same claim
  const entities = await sql`
    SELECT id, entity_name, inferred_from, confidence
    FROM entity_cache
    WHERE jsonb_array_length(inferred_from) >= 3
      AND confidence < 0.7
  `;

  let potentiated = 0;

  for (const entity of entities) {
    const inferences = entity.inferred_from || [];

    // Count unique sources per claim type
    const claimSources: Record<string, Set<string>> = {};
    for (const inf of inferences) {
      const claimType = inf.claim?.split(":")[0];
      if (!claimType) continue;
      if (!claimSources[claimType]) claimSources[claimType] = new Set();
      claimSources[claimType].add(inf.source);
    }

    // If any claim has 3+ different sources, boost confidence
    let shouldBoost = false;
    for (const [, sources] of Object.entries(claimSources)) {
      if (sources.size >= 3) {
        shouldBoost = true;
        break;
      }
    }

    if (shouldBoost && entity.confidence < 0.7) {
      await sql`
        UPDATE entity_cache SET
          confidence = LEAST(0.7, confidence + 0.05),
          updated_at = NOW()
        WHERE id = ${entity.id}
      `;
      potentiated++;
    }
  }

  return potentiated;
}

/**
 * Bridge Detection: find nonprofits spanning multiple causes.
 *
 * When a nonprofit operates across education AND healthcare, that's a bridge.
 * When an organization active in housing also does food assistance, that's a bridge.
 * Bridges are the most valuable connections because they reveal
 * relationships the connectome didn't expect.
 */
export async function detectBridges(sql: ReturnType<typeof neon>): Promise<Array<{
  entityA: string;
  entityB: string;
  bridgeType: string;
}>> {
  const bridges: Array<{ entityA: string; entityB: string; bridgeType: string }> = [];

  // Find nonprofits that span multiple cause areas (genres column stores causes)
  const crossCause = await sql`
    SELECT entity_name, genres, location_country
    FROM entity_cache
    WHERE entity_type = 'nonprofit'
      AND array_length(genres, 1) >= 2
      AND confidence > 0.3
    LIMIT 50
  `;

  for (const row of crossCause) {
    const causes = row.genres || [];
    if (causes.length >= 2) {
      bridges.push({
        entityA: row.entity_name,
        entityB: causes.join(" + "),
        bridgeType: "cross_cause_bridge",
      });

      // Strengthen this nonprofit's confidence (it bridges causes)
      await sql`
        UPDATE entity_cache SET
          confidence = LEAST(0.8, confidence + 0.03),
          updated_at = NOW()
        WHERE entity_name = ${row.entity_name}
      `.catch(() => {});
    }
  }

  // Find entities that appear across multiple countries
  const crossRegion = await sql`
    SELECT entity_name, array_agg(DISTINCT location_country) as countries
    FROM entity_cache
    WHERE entity_type = 'nonprofit'
      AND location_country IS NOT NULL
      AND confidence > 0.3
    GROUP BY entity_name
    HAVING COUNT(DISTINCT location_country) >= 2
    LIMIT 20
  `;

  for (const row of crossRegion) {
    if (row.countries.length >= 2) {
      bridges.push({
        entityA: row.entity_name,
        entityB: row.countries.join(" + "),
        bridgeType: "cross_region_bridge",
      });

      await sql`
        UPDATE entity_cache SET
          confidence = LEAST(0.8, confidence + 0.03),
          updated_at = NOW()
        WHERE entity_name = ${row.entity_name}
      `.catch(() => {});
    }
  }

  return bridges;
}

/**
 * Run all neuroplasticity mechanisms.
 * Called during the scheduled intelligence run.
 */
export async function runNeuroplasticity(sql: ReturnType<typeof neon>): Promise<{
  pruned: number;
  potentiated: number;
  bridges: number;
}> {
  const pruned = await synapticPruning(sql);
  const potentiated = await longTermPotentiation(sql);
  const bridgeList = await detectBridges(sql);

  // Apply Hebbian learning for detected bridges
  for (const bridge of bridgeList) {
    await hebbianUpdate(sql, bridge.entityA, bridge.entityB, "co_cause", 1.5);
  }

  return {
    pruned,
    potentiated,
    bridges: bridgeList.length,
  };
}
