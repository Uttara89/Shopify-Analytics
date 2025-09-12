
import * as authService from '../services/authService.js';

export async function requestCode(req, res) {
    const { email } = req.body;
    try {
        await authService.sendMagicCode(email);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

export async function verifyCode(req, res) {
    const { email, code } = req.body;
    try {
        const sessionToken = await authService.verifyMagicCode(email, code);
        // Set session cookie
        res.cookie('sess', sessionToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.COOKIE_SECURE === 'true',
        });
        res.json({ ok: true });
    } catch (error) {
        res.status(401).json({ ok: false, error: error.message });
    }
}

export async function getMe(req, res) {
    try {
        const user = await authService.getUserFromSession(req.cookies.sess);
        res.json(user);
    } catch (error) {
        res.status(401).json({ ok: false, error: error.message });
    }
}
