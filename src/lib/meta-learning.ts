// @ts-nocheck
/**
 * Meta-Learning
 *
 * The connectome learns how to learn.
 *
 * It tracks which of its predictions were correct (user donated, explored,
 * bookmarked) vs wrong (user bounced). Over time it learns which signals
 * are most predictive of what people engage with.
 *
 * Signals that correctly predict engagement get amplified.
 * Signals that fail get dampened. The prediction weights evolve.
 *
 * This is the final loop: the connectome doesn't just learn about
 * nonprofits. It learns about its own learning process.
 */

import { neon } from "@neondatabase/serverless";

export type Prediction = {
  nonprofitId: string;
  causeSlug: string;
  predictedScore: number;
  signals: Record<string, number>; // which signals contributed and how much
  timestamp: string;
};

export type PredictionOutcome = {
  nonprofitId: string;
  exploredSeconds: number;
  donated: boolean;
  bookmarked: boolean;
};

/**
 * Signal weights that the meta-learner adjusts over time.
 * Start equal, diverge based on what actually predicts engagement.
 */
const DEFAULT_SIGNAL_WEIGHTS: Record<string, number> = {
  nonprofit_confidence: 1.0,
  view_count: 1.0,
  location_affinity: 1.0,
  cause_intelligence: 1.0,
  rich_profile: 1.0,
  campaign_freshness: 1.0,
  cause_match: 1.0,
  cross_cause_bridge: 1.0,
  engagement_diversity: 1.0,
};

/**
 * Load current signal weights from the database.
 * Falls back to defaults if none stored.
 */
export async function getSignalWeights(sql: ReturnType<typeof neon>): Promise<Record<string, number>> {
  try {
    const rows: any[] = await sql`
      SELECT metadata FROM entity_cache
      WHERE entity_name = '__meta_signal_weights' AND entity_type = 'system'
      LIMIT 1
    `;
    if (rows[0]?.metadata?.weights) {
      return { ...DEFAULT_SIGNAL_WEIGHTS, ...rows[0].metadata.weights };
    }
  } catch {}
  return { ...DEFAULT_SIGNAL_WEIGHTS };
}

/**
 * Save updated signal weights.
 */
async function saveSignalWeights(sql: ReturnType<typeof neon>, weights: Record<string, number>): Promise<void> {
  const now = new Date().toISOString();
  await sql`
    INSERT INTO entity_cache (entity_name, entity_type, metadata, confidence)
    VALUES ('__meta_signal_weights', 'system', ${JSON.stringify({ weights, updated: now })}::jsonb, 0.5)
    ON CONFLICT (entity_name, entity_type) DO UPDATE SET
      metadata = ${JSON.stringify({ weights, updated: now })}::jsonb,
      updated_at = NOW()
  `.catch(() => {});
}

/**
 * Record a prediction for later evaluation.
 * Called when the system recommends a nonprofit to a user.
 */
export async function recordPrediction(
  sql: ReturnType<typeof neon>,
  prediction: Prediction
): Promise<void> {
  const inference = {
    source: "meta_prediction",
    claim: `predicted:${prediction.nonprofitId}:${prediction.predictedScore.toFixed(3)}`,
    confidence: prediction.predictedScore,
    timestamp: prediction.timestamp,
  };

  // Store in the cause's tracking entity
  await sql`
    UPDATE entity_cache SET
      inferred_from = inferred_from || ${JSON.stringify(inference)}::jsonb,
      updated_at = NOW()
    WHERE entity_name = ${'__cause_' + prediction.causeSlug} AND entity_type = 'system'
  `.catch(async () => {
    // Create cause tracking entity if it doesn't exist
    await sql`
      INSERT INTO entity_cache (entity_name, entity_type, inferred_from, confidence)
      VALUES (${'__cause_' + prediction.causeSlug}, 'system', ${JSON.stringify([inference])}::jsonb, 0.5)
      ON CONFLICT (entity_name, entity_type) DO UPDATE SET
        inferred_from = entity_cache.inferred_from || ${JSON.stringify(inference)}::jsonb
    `.catch(() => {});
  });
}

/**
 * Evaluate a prediction outcome and adjust signal weights.
 *
 * If the prediction was good (user donated, explored deeply, bookmarked),
 * amplify the signals that contributed most.
 * If the prediction was bad (user bounced quickly),
 * dampen those signals.
 */
export async function evaluatePrediction(
  sql: ReturnType<typeof neon>,
  prediction: Prediction,
  outcome: PredictionOutcome
): Promise<void> {
  const weights = await getSignalWeights(sql);

  // Success: donated, explored for 30+ seconds, or bookmarked
  const success = outcome.donated || outcome.exploredSeconds > 30 || outcome.bookmarked;

  // Magnitude: how strongly to adjust
  // Donation is the strongest signal, bookmark is medium, exploration is baseline
  let magnitude: number;
  if (outcome.donated) {
    magnitude = 1.0;
  } else if (outcome.bookmarked) {
    magnitude = 0.7;
  } else if (outcome.exploredSeconds > 30) {
    magnitude = 0.4;
  } else {
    magnitude = Math.min(1.0, (30 - outcome.exploredSeconds) / 30); // faster bounce = stronger negative
  }

  // Learning rate: small adjustments prevent oscillation
  const lr = 0.02;

  // Adjust each signal weight based on its contribution
  for (const [signal, contribution] of Object.entries(prediction.signals)) {
    if (contribution === 0) continue;
    if (weights[signal] === undefined) weights[signal] = 1.0;

    if (success) {
      // This signal contributed to a correct prediction. Amplify.
      weights[signal] += lr * magnitude * Math.abs(contribution);
    } else {
      // This signal contributed to a wrong prediction. Dampen.
      weights[signal] -= lr * magnitude * Math.abs(contribution);
    }

    // Clamp: no signal goes below 0.1 or above 3.0
    weights[signal] = Math.max(0.1, Math.min(3.0, weights[signal]));
  }

  await saveSignalWeights(sql, weights);
}

/**
 * Get a summary of how the meta-learner has evolved.
 * Shows which signals the connectome has learned to trust most.
 */
export async function getMetaLearningSummary(sql: ReturnType<typeof neon>): Promise<{
  weights: Record<string, number>;
  strongestSignal: string;
  weakestSignal: string;
  totalAdjustments: number;
}> {
  const weights = await getSignalWeights(sql);

  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const strongest = entries[0]?.[0] || "unknown";
  const weakest = entries[entries.length - 1]?.[0] || "unknown";

  // Count how many adjustments have been made (deviation from 1.0)
  const totalAdjustments = entries.reduce((sum, [, w]) => sum + Math.abs(w - 1.0), 0);

  return { weights, strongestSignal: strongest, weakestSignal: weakest, totalAdjustments };
}
