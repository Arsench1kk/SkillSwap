import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

export type ApplicationDatabase = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<
  Parameters<ApplicationDatabase["transaction"]>[0]
>[0];
export type DatabaseExecutor = ApplicationDatabase | DatabaseTransaction;
