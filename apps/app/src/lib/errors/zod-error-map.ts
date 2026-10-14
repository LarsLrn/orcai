import { z } from "zod/v4";
import { isErrorReason } from "@/lib/errors/is-error-reason";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { m } from "@/paraglide/messages";

const numberLike = new Set([
	"number",
	"int",
	"bigint",
]);

const collectionLike = new Set([
	"array",
	"set",
]);

const customParams = (issue: z.core.$ZodRawIssue): unknown =>
	"params" in issue && issue.params && typeof issue.params === "object"
		? issue.params
		: undefined;

// Built-in issues get a sentence per kind; custom checks pass `params.reason`.
export const zodErrorMap: z.core.$ZodErrorMap = (issue) => {
	switch (issue.code) {
		case "invalid_type":
			return issue.input === undefined
				? m.error_validation_required()
				: m.error_validation_invalid_value();
		case "too_small": {
			const minimum = Number(issue.minimum);
			if (issue.origin === "string") {
				return minimum <= 1
					? m.error_validation_required()
					: m.error_validation_string_too_small({
							minimum,
						});
			}
			if (collectionLike.has(issue.origin)) {
				return m.error_validation_array_too_small({
					minimum,
				});
			}
			if (numberLike.has(issue.origin)) {
				return m.error_validation_number_too_small({
					minimum,
				});
			}
			return m.error_validation_invalid_value();
		}
		case "too_big": {
			const maximum = Number(issue.maximum);
			if (issue.origin === "string") {
				return m.error_validation_string_too_big({
					maximum,
				});
			}
			if (collectionLike.has(issue.origin)) {
				return m.error_validation_array_too_big({
					maximum,
				});
			}
			if (numberLike.has(issue.origin)) {
				return m.error_validation_number_too_big({
					maximum,
				});
			}
			return m.error_validation_invalid_value();
		}
		case "invalid_format":
			switch (issue.format) {
				case "email":
					return m.error_validation_invalid_email();
				case "url":
					return m.error_validation_invalid_url();
				default:
					return m.error_validation_invalid_format();
			}
		case "not_multiple_of":
			return m.error_validation_not_multiple_of({
				divisor: Number(issue.divisor),
			});
		case "custom": {
			const params = customParams(issue) as
				| {
						reason?: unknown;
				  }
				| undefined;
			return isErrorReason(params?.reason)
				? reasonMessage(params.reason, params)
				: m.error_validation_invalid_value();
		}
		default:
			return m.error_validation_invalid_value();
	}
};

export const installZodErrorMap = () => {
	z.config({
		customError: zodErrorMap,
	});
};
