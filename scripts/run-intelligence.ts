/**
 * Intelligence Runner
 *
 * Runs neuroplasticity (Hebbian, pruning, LTP) and reports what changed.
 * Shows current signal weights from meta-learning.
 * Generates an intelligence report summary.
 *
 * Usage: npx tsx scripts/run-intelligence.ts
 */

import { neon } from "@neondatabase/serverless";
import { runNeuroplasticity } from "../src/lib/neuroplasticity";
import { getMetaLearningSummary } from "../src/lib/meta-learning";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("=== 401.gives Intelligence Run ===\n");
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // --- Neuroplasticity ---
  console.log("--- Neuroplasticity ---\n");

  const neuroResult = await runNeuroplasticity(sql);

  console.log(`  Entities pruned/decayed: ${neuroResult.pruned}`);
  console.log(`  Connections potentiated (LTP): ${neuroResult.potentiated}`);
  console.log(`  Cross-cause bridges found: ${neuroResult.bridges}`);

  // --- Entity stats ---
  console.log("\n--- Entity Stats ---\n");

  const stats = await sql`
    SELECT
      entity_type,
      COUNT(*) as count,
      ROUND(AVG(confidence)::numeric, 3) as avg_confidence,
      MAX(last_seen) as most_recent
    FROM entity_cache
    WHERE entity_type != 'system'
    GROUP BY entity_type
    ORDER BY count DESC
  `;

  for (const row of stats) {
    console.log(`  ${row.entity_type}: ${row.count} entities, avg confidence ${row.avg_confidence}, last seen ${row.most_recent || "never"}`);
  }

  // --- Meta-Learning ---
  console.log("\n--- Meta-Learning Signal Weights ---\n");

  const meta = await getMetaLearningSummary(sql);

  const sortedWeights = Object.entries(meta.weights).sort((a, b) => b[1] - a[1]);
  for (const [signal, weight] of sortedWeights) {
    const bar = "=".repeat(Math.round(weight * 20));
    const deviation = weight - 1.0;
    const arrow = deviation > 0.05 ? " ^" : deviation < -0.05 ? " v" : "";
    console.log(`  ${signal.padEnd(24)} ${weight.toFixed(3)} ${bar}${arrow}`);
  }

  console.log(`\n  Strongest signal: ${meta.strongestSignal}`);
  console.log(`  Weakest signal:   ${meta.weakestSignal}`);
  console.log(`  Total drift:      ${meta.totalAdjustments.toFixed(3)} (sum of |weight - 1.0|)`);

  // --- Intelligence Report ---
  console.log("\n--- Intelligence Report ---\n");

  const highConfidence = await sql`
    SELECT COUNT(*) as count FROM entity_cache
    WHERE confidence >= 0.7 AND entity_type != 'system'
  `;

  const lowConfidence = await sql`
    SELECT COUNT(*) as count FROM entity_cache
    WHERE confidence <= 0.2 AND entity_type != 'system'
  `;

  const staleEntities = await sql`
    SELECT COUNT(*) as count FROM entity_cache
    WHERE last_seen < NOW() - INTERVAL '60 days'
      AND entity_type != 'system'
  `;

  const totalEntities = await sql`
    SELECT COUNT(*) as count FROM entity_cache
    WHERE entity_type != 'system'
  `;

  const total = Number(totalEntities[0]?.count || 0);
  const high = Number(highConfidence[0]?.count || 0);
  const low = Number(lowConfidence[0]?.count || 0);
  const stale = Number(staleEntities[0]?.count || 0);

  console.log(`  Total entities:     ${total}`);
  console.log(`  High confidence:    ${high} (${total > 0 ? ((high / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Low confidence:     ${low} (${total > 0 ? ((low / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Stale (60+ days):   ${stale}`);
  console.log(`  Pruned this run:    ${neuroResult.pruned}`);
  console.log(`  Strengthened (LTP): ${neuroResult.potentiated}`);
  console.log(`  Bridges detected:   ${neuroResult.bridges}`);

  if (neuroResult.bridges > 0) {
    console.log("\n  Cross-cause bridges indicate nonprofits that span multiple");
    console.log("  cause areas. These are high-value discovery targets.");
  }

  if (meta.totalAdjustments > 0.5) {
    console.log(`\n  Signal weights have drifted significantly (${meta.totalAdjustments.toFixed(3)}).`);
    console.log(`  The connectome is learning: ${meta.strongestSignal} is the most trusted signal.`);
  } else {
    console.log("\n  Signal weights are still near baseline. More engagement data needed.");
  }

  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  console.error("Intelligence run failed:", err);
  process.exit(1);
});
