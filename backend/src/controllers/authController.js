
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
        // Set session cookie. For cross-site (frontend on different origin) we need
        // SameSite=None and Secure=true so browsers will accept the cookie when
        // fetch(..., { credentials: 'include' }) is used.
        const cookieOptions = {
            httpOnly: true,
            // default to 'none' for deployed cross-site usage; local dev may override
            sameSite: process.env.COOKIE_SAMESITE || 'none',
            secure: (process.env.COOKIE_SECURE === 'true') || (process.env.NODE_ENV === 'production'),
        };
        res.cookie('sess', sessionToken, cookieOptions);
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
