

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();
import { fetchProductsSince, fetchCustomersSince, fetchOrdersSince } from '../services/shopifyService.js';

function decryptAccessToken(accessTokenEnc) {
  if (!accessTokenEnc) return null;
  if (!process.env.ENCRYPTION_KEY) return accessTokenEnc;
  if (!accessTokenEnc.includes(':')) return accessTokenEnc;

  try {
    const [ivB64, cipherB64, tagB64] = accessTokenEnc.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const cipher = Buffer.from(cipherB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('Failed to decrypt access token, treating as raw token:', err.message);
    return accessTokenEnc;
  }
}

export async function backfill(req, res) {
  // enqueue a backfill job and return a job id immediately.
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const jobsDir = path.resolve(process.cwd(), 'jobs');
    await fs.mkdir(jobsDir, { recursive: true });
    const jobId = crypto.randomUUID();
    const jobPath = path.join(jobsDir, `${jobId}.json`);
    const job = { id: jobId, tenantId, status: 'queued', createdAt: new Date().toISOString() };
    await fs.writeFile(jobPath, JSON.stringify(job, null, 2), 'utf8');
    return res.json({ ok: true, jobId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getJobStatus(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'job id required' });
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const jobPath = path.resolve(process.cwd(), 'jobs', `${id}.json`);
    const raw = await fs.readFile(jobPath, 'utf8');
    const job = JSON.parse(raw);
    return res.json(job);
  } catch (err) {
    return res.status(404).json({ error: 'job not found' });
  }
}

export async function getBackfillState(req, res) {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  try {
    const rows = await prisma.backfillState.findMany({ where: { tenantId } });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function resetBackfillState(req, res) {
  const { tenantId, resource } = req.body;
  if (!tenantId || !resource) return res.status(400).json({ error: 'tenantId and resource required' });
  try {
    await prisma.backfillState.upsert({ where: { tenantId_resource: { tenantId, resource } }, update: { cursor: null, lastBackfillAt: null, lastSuccessAt: null, status: 'idle', notes: null }, create: { tenantId, resource, status: 'idle' } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
