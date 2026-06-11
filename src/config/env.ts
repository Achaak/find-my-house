import { config as loadDotenv } from "dotenv";

loadDotenv();
loadDotenv({ path: ".env.local", override: true });
