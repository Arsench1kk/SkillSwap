import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://skillswap:skillswap@localhost:5433/skillswap";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
