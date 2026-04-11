import { Router } from 'express';
import agentRoutes from './agents.js';
import departmentRoutes from './departments.js';
import templateRoutes from './templates.js';
import workflowRoutes from './workflows.js';
import taskRoutes from './tasks.js';
import chatRoutes from './chat.js';
import performanceRoutes from './performance.js';

const router = Router();

router.use('/agents', agentRoutes);
router.use('/departments', departmentRoutes);
router.use('/templates', templateRoutes);
router.use('/workflows', workflowRoutes);
router.use('/tasks', taskRoutes);
router.use('/chat', chatRoutes);
router.use('/performance', performanceRoutes);

export default router;
