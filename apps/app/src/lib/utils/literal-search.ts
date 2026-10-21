/** PostgreSQL LIKE pattern for a literal, case-insensitive substring. */
export const literalSearch = (value: string): string =>
	`%${value.replace(/[\\%_]/g, "\\$&")}%`;
