import { gracefulShutdown } from "./src/utils/shutdown.js";
import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";
import app from "./src/app.js";
import { testPgConnection } from "./src/db/postgres.init.js";
import { verifyMailTransporter } from "./src/services/nodemailer.service.js";
import { attachSocketServer } from "./src/websocket/socket.server.js";
import { createServer } from "http";

const httpServer = createServer(app);
attachSocketServer(httpServer);

const server = httpServer.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    `HTTP server started on ${env.PORT} in ${env.NODE_ENV} mode`,
  );

  void testPgConnection().catch((err: unknown) => {
    logger.error({ err }, "PostgreSQL connection failed on startup");
  });

  // Mail is load-bearing for registration (OTP) and most other sends are
  // fire-and-forget, so a broken credential would otherwise fail silently in the
  // background. Probe it once at boot and leave a loud log line when it is wrong.
  void verifyMailTransporter();
});

process.once("SIGTERM", () => {
  void gracefulShutdown(server, "SIGTERM");
});

process.once("SIGINT", () => {
  void gracefulShutdown(server, "SIGINT");
});
