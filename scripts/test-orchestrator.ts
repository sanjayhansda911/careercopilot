import fs from 'fs';
import path from 'path';

// Load .env.local
const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { runOrchestrator } from '../lib/agents/orchestrator';

async function main() {
  console.log('=== CareerPilot Milestone 5 Test: Central Orchestrator Pipeline ===\n');

  console.log('[1/1] Triggering Orchestrator Workflow Pipeline...');
  const summary = await runOrchestrator({
    triggerSource: 'test',
    maxJobsToAnalyze: 2
  });

  console.log('  - Run ID:', summary.runId);
  console.log('  - Overall Status:', summary.status);
  console.log('  - Execution Duration:', `${summary.durationMs}ms`);
  console.log('  - Discovery Step:');
  console.log(`    Scanned: ${summary.discovery.jobsScanned}, Added: ${summary.discovery.jobsAdded}, Deduplicated: ${summary.discovery.jobsDuplicates}`);
  console.log('  - Intelligence Step:');
  console.log(`    Analyzed: ${summary.intelligence.jobsAnalyzed}, Strong Matches: ${summary.intelligence.strongMatches}, Review Matches: ${summary.intelligence.reviewMatches}`);
  console.log('  - Notification Step:');
  console.log(`    Notifications Created: ${summary.notification.notificationsCreated}, Email Sent: ${summary.notification.emailSent}`);

  if (summary.status === 'failed') {
    throw new Error(`Orchestrator run failed: ${summary.errors.join('; ')}`);
  }

  console.log('\n======================================================');
  console.log('🎉 CENTRAL ORCHESTRATOR PIPELINE VERIFIED SUCCESSFULLY!');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
