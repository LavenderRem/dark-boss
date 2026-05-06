import { Router } from 'express';
import agentRoutes from './agents.js';
import departmentRoutes from './departments.js';
import templateRoutes from './templates.js';
import workflowRoutes from './workflows.js';
import taskRoutes from './tasks.js';
import chatRoutes from './chat.js';
import performanceRoutes from './performance.js';
import fileRoutes from './files.js';
import providerRoutes from './providers.js';
import modelTierRoutes from './model-tiers.js';
import notificationsRouter from './notifications.js';

const router = Router();

router.use('/agents', agentRoutes);
router.use('/departments', departmentRoutes);
router.use('/templates', templateRoutes);
router.use('/workflows', workflowRoutes);
router.use('/tasks', taskRoutes);
router.use('/chat', chatRoutes);
router.use('/performance', performanceRoutes);
router.use('/files', fileRoutes);
router.use('/providers', providerRoutes);
router.use('/model-tiers', modelTierRoutes);
router.use('/notifications', notificationsRouter);

export default router;
