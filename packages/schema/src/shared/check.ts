import { z } from "zod/v4";

export const checkStatusSchema = z.enum([
	"ok",
	"warning",
	"failing",
]);

export const checkSeveritySchema = z.enum([
	"required",
	"recommended",
]);

/** Stable codes the client translates; `detail` carries untranslated technical text. */
export const CHECK_REASONS = [
	"DEPENDENCY_REACHABLE",
	"DEPENDENCY_UNREACHABLE",
	"DEPENDENCY_TIMEOUT",
	"DEPENDENCY_DEGRADED",
	"WORKERS_RUNNING",
	"WORKERS_NOT_RUNNING",
	"MAIL_SMTP",
	"MAIL_LOG_ONLY",
	"MAIL_NOT_SENT_YET",
	"MAIL_DEAD",
	"CONFIG_OK",
	"CONFIG_WARNINGS",
] as const;

export const checkReasonSchema = z.enum(CHECK_REASONS);

/** One line of a check list: what was checked, how it stands, and why. */
export const checkSchema = z.object({
	id: z.string(),
	status: checkStatusSchema,
	severity: checkSeveritySchema,
	reason: checkReasonSchema,
	params: z
		.record(
			z.string(),
			z.union([
				z.string(),
				z.number(),
			]),
		)
		.optional(),
	detail: z.string().optional(),
});

export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type CheckSeverity = z.infer<typeof checkSeveritySchema>;
export type CheckReason = z.infer<typeof checkReasonSchema>;
export type Check = z.infer<typeof checkSchema>;
