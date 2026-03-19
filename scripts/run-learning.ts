#!/usr/bin/env npx tsx
/**
 * Self-Directed Learning Runner
 *
 * The connectome looks at itself, finds gaps, and either reports
 * what it needs to learn or goes and learns it.
 *
 * Usage:
 *   npx tsx scripts/run-learning.ts              # Print top 20 tasks
 *   npx tsx scripts/run-learning.ts --execute     # Execute top tasks via firecrawl
 *   npx tsx scripts/run-learning.ts --health      # Print connectome health report
 *   npx tsx scripts/run-learning.ts --execute=10  # Execute top 10 tasks
 *
 * Requires: DATABASE_URL in .env
 * Optional: FIRECRAWL_API_KEY in .env (for --execute)
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import {
  generateLearningTasks,
  executeLearningTasks,
  getConnectomeHealth,
  type LearningTask,
} from "../src/lib/self-directed-learning";

const sql = neon(process.env.DATABASE_URL!);

// ─── Formatting helpers ─────────────────────────────────────────

const TASK_TYPE_LABELS: Record<string, string> = {
  scrape_mission: "SCRAPE",
  research_causes: "RESEARCH",
  explore_city: "EXPLORE",
  find_connections: "CONNECT",
  research_cause_landscape: "LANDSCAPE",
  update_stale_entity: "STALE",
  deepen_research: "DEEPEN",
  find_donate_url: "DONATE",
  discover_nonprofits: "DISCOVER",
};

function formatTask(task: LearningTask, index: number): string {
  const label = TASK_TYPE_LABELS[task.type] || task.type.toUpperCase();
  const prio = (task.priority * 100).toFixed(0).padStart(3);
  const tag = `[${label}]`.padEnd(12);
  return [
    `  ${String(index + 1).padStart(2)}. ${tag} P${prio}  ${task.description}`,
    `      Reason: ${task.reason}`,
    task.url ? `      URL: ${task.url}` : null,
    `      Query: ${task.query}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Parse CLI args ─────────────────────────────────────────────

const args = process.argv.slice(2);
const showHealth = args.includes("--health");
const executeFlag = args.find((a) => a.startsWith("--execute"));
const shouldExecute = !!executeFlag;
const maxExecute = executeFlag?.includes("=")
  ? parseInt(executeFlag.split("=")[1], 10)
  : 5;

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("\n  401.GIVES CONNECTOME -- SELF-DIRECTED LEARNING\n");
  console.log("  ================================================\n");

  // Health report
  if (showHealth) {
    console.log("  CONNECTOME HEALTH REPORT\n");
    try {
      const health = await getConnectomeHealth(sql);
      console.log(`  Total nonprofits:     ${health.totalNonprofits}`);
      console.log(
        `  With mission:         ${health.withMission} (${((health.withMission / health.totalNonprofits) * 100).toFixed(1)}%)`
      );
      console.log(
        `  With donate URL:      ${health.withDonateUrl} (${((health.withDonateUrl / health.totalNonprofits) * 100).toFixed(1)}%)`
      );
      console.log(
        `  With causes:          ${health.withCauses} (${((health.withCauses / health.totalNonprofits) * 100).toFixed(1)}%)`
      );
      console.log(
        `  Avg confidence:       ${health.avgConfidence.toFixed(3)}`
      );
      console.log(`  Entity cache size:    ${health.totalEntities}`);
      console.log(`  Stale entities:       ${health.staleEntities}`);

      console.log("\n  COUNTY COVERAGE:");
      for (const c of health.countyCoverage) {
        const bar = "\u2588".repeat(Math.min(c.count, 40));
        console.log(`    ${c.county.padEnd(14)} ${String(c.count).padStart(4)} ${bar}`);
      }

      console.log("\n  CITY COVERAGE (top 15):");
      for (const c of health.cityCoverage.slice(0, 15)) {
        const bar = "\u2588".repeat(Math.min(c.count, 40));
        console.log(`    ${c.city.padEnd(20)} ${String(c.count).padStart(4)} ${bar}`);
      }
    } catch (err) {
      console.error("  Failed to get health report:", err);
    }
    console.log("");
    if (!shouldExecute && !args.some((a) => !a.startsWith("--health"))) {
      return;
    }
  }

  // Generate tasks
  console.log("  Generating learning tasks...\n");
  let tasks: LearningTask[];
  try {
    tasks = await generateLearningTasks(sql);
  } catch (err) {
    console.error("  Failed to generate tasks:", err);
    process.exit(1);
  }

  if (tasks.length === 0) {
    console.log("  The connectome found no gaps. Nothing to learn.\n");
    return;
  }

  // Print top 20
  const displayCount = Math.min(tasks.length, 20);
  console.log(`  TOP ${displayCount} LEARNING TASKS (of ${tasks.length} total)\n`);
  for (let i = 0; i < displayCount; i++) {
    console.log(formatTask(tasks[i], i));
    console.log("");
  }

  // Task type breakdown
  const typeCounts: Record<string, number> = {};
  for (const t of tasks) {
    typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
  }
  console.log("  TASK TYPE BREAKDOWN:");
  for (const [type, count] of Object.entries(typeCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    const label = TASK_TYPE_LABELS[type] || type;
    console.log(`    ${label.padEnd(12)} ${count}`);
  }
  console.log("");

  // Execute if flag passed
  if (shouldExecute) {
    if (!process.env.FIRECRAWL_API_KEY) {
      console.log(
        "  WARNING: FIRECRAWL_API_KEY not set. Scrape tasks will be skipped.\n"
      );
    }

    console.log(`  EXECUTING top ${maxExecute} tasks...\n`);
    const result = await executeLearningTasks(sql, tasks, maxExecute);

    console.log(`  Executed: ${result.executed}/${maxExecute}\n`);
    console.log("  RESULTS:");
    for (const item of result.learned) {
      console.log(`    ${item}`);
    }
    console.log("");
  } else {
    console.log("  Pass --execute to run scrape tasks via firecrawl.");
    console.log("  Pass --health for connectome health report.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
