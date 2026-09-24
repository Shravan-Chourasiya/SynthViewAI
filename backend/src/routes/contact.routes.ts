import express, { type Router } from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validateBody } from "../middlewares/zodValidator.middleware.js";
import { contactSubmissionSchema } from "../modules/contact/zodschemas/contact.zschema.js";
import { submitContactMessageController } from "../modules/contact/controllers/contact.controller.js";

const contactLimiter = createRateLimiter("CONTACT");

export const createContactRouter = (): Router => {
  const router = express.Router();

  // Public route: deliberately no `requireAuth` and no `csrfTokenMiddleware` —
  // a signed-out visitor has no session cookie or CSRF token to send, which is
  // the same reasoning register/login follow.
  router.post(
    "/contact",
    contactLimiter,
    validateBody(contactSubmissionSchema),
    submitContactMessageController,
  );

  return router;
};
