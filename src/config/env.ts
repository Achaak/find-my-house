import { config as loadDotenv } from "dotenv";

/** Defaults (versionnés), puis overrides locaux dans .env.local */
loadDotenv();
loadDotenv({ path: ".env.local", override: true });
