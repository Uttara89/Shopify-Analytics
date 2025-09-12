
import express from 'express';
import * as authController from '../controllers/authController.js';
const router = express.Router();

router.post('/request-code', authController.requestCode);
router.post('/verify', authController.verifyCode);
router.get('/me', authController.getMe);

export default router;
