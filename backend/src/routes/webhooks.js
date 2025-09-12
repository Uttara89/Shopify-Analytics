import express from 'express';
import { handleProductWebhook, handleOrderWebhook, handleCustomerWebhook } from '../controllers/webhooksController.js';
import { verifyShopifyHmac } from '../middleware/shopifyHmac.js';

const router = express.Router();

router.post('/products', verifyShopifyHmac, handleProductWebhook);
router.post('/orders', verifyShopifyHmac, handleOrderWebhook);
router.post('/customers', verifyShopifyHmac, handleCustomerWebhook);

export default router;
