// Entry point. Lives inside `src/` on purpose: tsconfig.json sets
// `rootDir: ./src` and `include: ["src/**/*.ts"]`, so a file outside src/ is
// never compiled and `npm run build` would emit no `dist/server.js` — which is
// exactly what `npm run start` (and Render's start command) launches.
import { gracefulShutdown } from "./utils/shutdown.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import app from "./app.js";
import { testPgConnection } from "./db/postgres.init.js";
import { verifyMailTransporter } from "./services/mail.service.js";
import { attachSocketServer } from "./websocket/socket.server.js";
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
