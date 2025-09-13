import fs from 'fs/promises';
import path from 'path';
import { processBackfillJob } from './backfillJob.js';

export async function startInProcessBackfill({ prisma, pollInterval = 3000 } = {}) {
  const jobsDir = path.resolve(process.cwd(), 'jobs');
  await fs.mkdir(jobsDir, { recursive: true });
  async function pollOnce() {
    try {
      const files = await fs.readdir(jobsDir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const p = path.join(jobsDir, f);
        try {
          const raw = await fs.readFile(p, 'utf8');
          const job = JSON.parse(raw);
          if (job.status === 'queued') {
            job.status = 'claimed';
            job.claimedAt = new Date().toISOString();
            await fs.writeFile(p, JSON.stringify(job, null, 2), 'utf8');
            console.log(new Date().toISOString(), 'in-process worker: claimed job', job.id, 'tenant:', job.tenantId);
            try {
              await processBackfillJob(job.id, prisma);
              console.log(new Date().toISOString(), 'in-process worker: finished job', job.id);
            } catch (procErr) {
              console.error(new Date().toISOString(), 'in-process worker: error processing job', job.id, procErr && procErr.message ? procErr.message : procErr);
            }
          }
        } catch (e) {
          console.error('in-process worker job read/process error', e && e.message ? e.message : e);
        }
      }
    } catch (e) { console.error('in-process poll error', e && e.message ? e.message : e); }
  }

  console.log('In-process backfill worker starting; watching jobs directory:', jobsDir);
  (async () => {
    while (true) {
      await pollOnce();
      await new Promise(r => setTimeout(r, pollInterval));
    }
  })().catch(e => { console.error(e); });
}

export default startInProcessBackfill;
