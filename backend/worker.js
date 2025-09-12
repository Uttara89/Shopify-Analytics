#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processBackfillJob } from './src/services/backfillJob.js';

const jobsDir = path.resolve(process.cwd(), 'jobs');

async function poll() {
  try {
    await fs.mkdir(jobsDir, { recursive: true });
    const files = await fs.readdir(jobsDir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(jobsDir, f);
      try {
        const raw = await fs.readFile(p, 'utf8');
        const job = JSON.parse(raw);
        if (job.status === 'queued') {
          // mark as claimed
          job.status = 'claimed';
          job.claimedAt = new Date().toISOString();
          await fs.writeFile(p, JSON.stringify(job, null, 2), 'utf8');
          console.log(new Date().toISOString(), 'worker: claimed job', job.id, 'tenant:', job.tenantId);
          try {
            await processBackfillJob(job.id);
            console.log(new Date().toISOString(), 'worker: finished job', job.id);
          } catch (procErr) {
            console.error(new Date().toISOString(), 'worker: error processing job', job.id, procErr && procErr.message ? procErr.message : procErr);
          }
        }
      } catch (e) { console.error('job read/process error', e.message); }
    }
  } catch (e) { console.error('poll error', e.message); }
}

async function main() {
  console.log('Backfill worker starting; watching jobs directory:', jobsDir);
  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, 3000));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
