import { Router } from "express";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { 
  listUsersController, 
  getUserController, 
  updateUserRoleController, 
  suspendUserController, 
  reinstateUserController, 
  listInterviewsController, 
  getInterviewDetailController,
  getInterviewMetricsController,
  getOverviewController
} from "../modules/admin/controllers/admin.controller.js";
import { validateQuery } from "../middlewares/zodValidator.middleware.js";
import { 
  userListQuerySchema, 
  updateUserRoleSchema, 
  suspendUserSchema, 
  interviewListQuerySchema,
  adminOverviewQuerySchema
} from "../modules/admin/zodschemas/admin.zschema.js";

const router = Router();

// Every admin route must authenticate first (`requireAuth` attaches `req.auth`
// from the session), then pass the hierarchy-aware role check. Ordering matters:
// `requireRole` refuses to run without an authenticated request.
const adminArea = [requireAuth, requireRole("moderator")];
// Changing roles is reserved for the admin tier and above (admin, owner).
const roleManagement = [requireAuth, requireRole("admin")];
// Candidate performance data is admin-and-above only. A moderator can triage
// sessions through `adminArea`, but "how well did this person score" is a
// narrower grant than "keep the queue moving". Second gate in this file, and
// the reason is different from `roleManagement`'s — hence its own name.
const performanceInsights = [requireAuth, requireRole("admin")];

// Admin Overview Routes
router.get(
  "/overview", 
  ...adminArea, 
  validateQuery(adminOverviewQuerySchema),
  getOverviewController
);

// User Management Routes
router.get(
  "/users", 
  ...adminArea, 
  validateQuery(userListQuerySchema),
  listUsersController
);

router.get(
  "/users/:id", 
  ...adminArea, 
  getUserController
);

router.patch(
  "/users/:id/role", 
  ...roleManagement, 
  updateUserRoleController
);

router.post(
  "/users/:id/suspend", 
  ...adminArea, 
  suspendUserController
);

router.post(
  "/users/:id/reinstate", 
  ...adminArea, 
  reinstateUserController
);

// Interview Management Routes
router.get(
  "/interviews", 
  ...adminArea, 
  validateQuery(interviewListQuerySchema),
  listInterviewsController
);

router.get(
  "/interviews/:id", 
  ...adminArea, 
  getInterviewDetailController
);

// Scores and metrics only — no answer text, no transcripts, no candidate PII.
// Stricter than the surrounding area: see `performanceInsights` above.
router.get(
  "/interviews/:id/metrics",
  ...performanceInsights,
  getInterviewMetricsController
);

export default router;