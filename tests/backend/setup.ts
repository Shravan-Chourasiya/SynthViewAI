// Lean root-level suite — backend environment pins.
//
// Loaded *after* `backend/tests/setup.ts` (array order in the vitest config),
// so these values win over both that file's stubs and any local `backend/.env`
// — `vi.stubEnv` writes real `process.env` entries, and `dotenv` never
// overwrites keys that are already present. That is what keeps the lean suite
// deterministic on a machine with a populated `.env`: the app is imported with
// `API_VERSION=v1` regardless of what the developer has locally.
import { vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("API_VERSION", "v1");
// `error` (not `silent`): the env schema only accepts fatal/error/warn/info/
// debug/trace, and pino-http request logs at info level would drown the output.
vi.stubEnv("LOG_LEVEL", "error");
