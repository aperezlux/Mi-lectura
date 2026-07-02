import { Router, type IRouter } from "express";
import healthRouter from "./health";
import readersRouter from "./readers";
import unavailabilityRouter from "./unavailability";
import calendarRouter from "./calendar";
import schedulesRouter from "./schedules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(readersRouter);
router.use(unavailabilityRouter);
router.use(schedulesRouter);
router.use(calendarRouter);

export default router;
