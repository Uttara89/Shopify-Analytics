import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendMagicCode(email) {
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
    await prisma.verificationCode.upsert({
        where: { email },
        update: { codeHash, expiresAt },
        create: { email, codeHash, expiresAt },
    });
    // In non-production, optionally surface the OTP for team testing when
    // SHOW_DEV_OTPS=true. Never enable in production.
    if (process.env.SHOW_DEV_OTPS === 'true' && process.env.NODE_ENV !== 'production') {
        // Log to server console (team should have access to staging logs) so
        // developers/testers can retrieve the OTP without needing SMTP access.
        console.log(`[DEV-OTP] email=${email} code=${code}`);
    }

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your Magic Login Code',
        text: `Your login code is: ${code}`,
    });
}

export async function verifyMagicCode(email, code) {
    const record = await prisma.verificationCode.findUnique({ where: { email } });
    if (!record || record.expiresAt < new Date()) throw new Error('Code expired or not found');
    const valid = await bcrypt.compare(code, record.codeHash);
    if (!valid) throw new Error('Invalid code');
    // Create/find user and session
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) user = await prisma.user.create({ data: { email } });
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await prisma.session.create({
        data: {
            userId: user.id,
            token: sessionToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
    });
    return sessionToken;
}

export async function getUserFromSession(token) {
    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) throw new Error('Session expired');
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    const tenants = await prisma.userTenant.findMany({ where: { userId: user.id } });
    return { user, tenants };
}