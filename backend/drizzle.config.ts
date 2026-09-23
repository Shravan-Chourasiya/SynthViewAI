import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config();

export default defineConfig({
  schema: [
    "./src/modules/auth/schemas/*.ts",
    "./src/modules/interview/schemas/*.ts",
    "./src/modules/notification/schemas/*.ts",
  ],
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URI!,
  },
  verbose: true,
  strict: true,
});
