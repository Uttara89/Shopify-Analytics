
import express from 'express';
import * as metricsController from '../controllers/metricsController.js';
const router = express.Router();

router.get('/overview', metricsController.getOverview);
router.get('/orders-by-date', metricsController.getOrdersByDate);
router.get('/aov-by-date', metricsController.getAovByDate);
router.get('/top-customers', metricsController.getTopCustomers);
router.get('/product-counts', metricsController.getProductCounts);

export default router;
