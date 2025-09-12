
import express from 'express';
import * as backfillController from '../controllers/backfillController.js';
const router = express.Router();

router.post('/', backfillController.backfill);
router.get('/job/:id', backfillController.getJobStatus);
router.get('/state', backfillController.getBackfillState);
router.post('/state/reset', backfillController.resetBackfillState);

export default router;
