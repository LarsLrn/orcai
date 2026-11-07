import { dbSchema } from "@orcai/db";
import { getColumns } from "drizzle-orm";

const {
	preferences: _preferences,
	locale: _locale,
	...columns
} = getColumns(dbSchema.user);
export const instanceUserColumns = columns;
