module.exports = (req, res, next) => {
    if (!req.cookies || !req.cookies.sess) {
        return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    next();
};
