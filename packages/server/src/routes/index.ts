import { Router } from 'express';
import agentRoutes from './agents.js';
import departmentRoutes from './departments.js';
import templateRoutes from './templates.js';

const router = Router();

router.use('/agents', agentRoutes);
router.use('/departments', departmentRoutes);
router.use('/templates', templateRoutes);

export default router;
