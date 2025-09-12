
import express from 'express';
import * as tenantsController from '../controllers/tenantsController.js';
const router = express.Router();

router.get('/', tenantsController.getTenants);
router.post('/', tenantsController.createTenant);
router.delete('/:id', tenantsController.deleteTenant);

export default router;
