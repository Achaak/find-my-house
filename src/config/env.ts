import { config as loadDotenv } from "dotenv";

/** Defaults (versioned), then local overrides in .env.local */
loadDotenv();
loadDotenv({ path: ".env.local", override: true });
