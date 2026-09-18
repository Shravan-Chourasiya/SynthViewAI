import { Router } from "express";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import { 
  listUsersController, 
  getUserController, 
  updateUserRoleController, 
  suspendUserController, 
  reinstateUserController, 
  listInterviewsController, 
  getInterviewDetailController,
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

// Admin Overview Routes
router.get(
  "/overview", 
  requireRole("admin", "moderator", "owner"), 
  validateQuery(adminOverviewQuerySchema),
  getOverviewController
);

// User Management Routes
router.get(
  "/users", 
  requireRole("admin", "moderator", "owner"), 
  validateQuery(userListQuerySchema),
  listUsersController
);

router.get(
  "/users/:id", 
  requireRole("admin", "moderator", "owner"), 
  getUserController
);

router.patch(
  "/users/:id/role", 
  requireRole("admin", "owner"), 
  updateUserRoleController
);

router.post(
  "/users/:id/suspend", 
  requireRole("admin", "moderator", "owner"), 
  suspendUserController
);

router.post(
  "/users/:id/reinstate", 
  requireRole("admin", "moderator", "owner"), 
  reinstateUserController
);

// Interview Management Routes
router.get(
  "/interviews", 
  requireRole("admin", "moderator", "owner"), 
  validateQuery(interviewListQuerySchema),
  listInterviewsController
);

router.get(
  "/interviews/:id", 
  requireRole("admin", "moderator", "owner"), 
  getInterviewDetailController
);

export default router;