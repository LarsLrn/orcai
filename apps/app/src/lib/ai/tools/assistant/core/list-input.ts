import { z } from "zod/v4";

export const listLimitSchema = z
	.number()
	.int()
	.min(1)
	.max(50)
	.default(20)
	.describe(
		"Most items to return; the output's total tells whether there are more.",
	);

export const listQuerySchema = z
	.string()
	.trim()
	.max(100)
	.optional()
	.describe("Part of the name to search for, case-insensitive.");
