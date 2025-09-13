

import dotenv from 'dotenv';
// Load .env and override any existing env vars so local .env wins
dotenv.config({ override: true });
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


import authRoutes from './src/routes/auth.js';
import tenantsRoutes from './src/routes/tenants.js';
import metricsRoutes from './src/routes/metrics.js';
import backfillRoutes from './src/routes/backfill.js';
import webhooksRoutes from './src/routes/webhooks.js';


const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(helmet());
// capture raw body for HMAC verification (req.rawBody)
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());
// Normalize FRONTEND_ORIGIN: allow comma-separated list of origins
const rawFrontendOrigin = process.env.FRONTEND_ORIGIN || '';
const FRONTEND_ORIGIN = rawFrontendOrigin
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// Always allow localhost/dev origins for developer convenience (ports used by Vite)
const devOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
];

const allowedOrigins = Array.from(new Set([...FRONTEND_ORIGIN, ...devOrigins]));

console.log('Configured allowed CORS origins =', allowedOrigins);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        } else {
            return callback(new Error('CORS policy: origin not allowed - ' + origin));
        }
    },
    credentials: true,
}));


// Routes
app.get('/', (req, res) => {
    res.send('Welcome to the XenoShop Analytics Server!');
});



app.use('/auth', authRoutes);
app.use('/tenants', tenantsRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/metrics', metricsRoutes);
app.use('/ingest/backfill', backfillRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Try a simple query (fetch first tenant)
        await prisma.tenant.findFirst();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT} (process.env.PORT=${process.env.PORT})`);
    // Start in-process backfill worker unless explicitly disabled. This keeps
    // everything in a single free Web Service (no background worker required).
    if (process.env.DISABLE_IN_PROCESS_BACKFILL !== 'true') {
        (async () => {
            try {
                const startInProcessBackfill = (await import('./src/services/backfillWorker.js')).default;
                startInProcessBackfill({ prisma });
                console.log('Started in-process backfill worker');
            } catch (e) {
                console.error('Failed to start in-process backfill worker', e && e.message ? e.message : e);
            }
        })();
    } else {
        console.log('In-process backfill worker disabled by DISABLE_IN_PROCESS_BACKFILL=true');
    }
});