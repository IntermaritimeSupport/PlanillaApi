import { Router } from 'express';
import { LeaveController } from '../controllers/LeaveController.js';
import { verifyJWT } from '../middlewares/AuthMiddleware.js';

const leaveRouter = Router();
const controller = new LeaveController();

leaveRouter.use(verifyJWT);

leaveRouter.get('/leaves', (req, res) => controller.getLeaveRequests(req, res));
leaveRouter.post('/leaves', (req, res) => controller.requestLeave(req, res));
leaveRouter.patch('/leaves/:id/approve', (req, res) => controller.approveLeave(req, res));
leaveRouter.patch('/leaves/:id/reject', (req, res) => controller.rejectLeave(req, res));
leaveRouter.patch('/leaves/:id/cancel', (req, res) => controller.cancelLeave(req, res));

export default leaveRouter;
