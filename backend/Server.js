

import dotenv from 'dotenv';
dotenv.config();
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
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN,
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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});