import { Pool } from "pg";
import { pgConnectionString } from "@/settings/db";

export const pgPool = new Pool({ connectionString: pgConnectionString });
