import type { AnyColumn } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * When a row last changed, falling back to creation time so a row that has
 * never been edited still sorts by age.
 */
export const changedAt = (table: {
	updatedAt: AnyColumn;
	createdAt: AnyColumn;
}) => sql<Date>`coalesce(${table.updatedAt}, ${table.createdAt})`;
