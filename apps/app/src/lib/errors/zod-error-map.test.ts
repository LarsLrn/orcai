import { describe, expect, test } from "bun:test";
import { z } from "zod/v4";
import { m } from "@/paraglide/messages";
import { installZodErrorMap } from "./zod-error-map";

installZodErrorMap();

const firstMessage = (schema: z.ZodType, input: unknown) => {
	const result = schema.safeParse(input);
	return result.success ? undefined : result.error.issues[0]?.message;
};

describe("zodErrorMap", () => {
	test("translates built-in issues from their structured data", () => {
		expect(firstMessage(z.string().min(1), "")).toBe(
			m.error_validation_required(),
		);
		expect(firstMessage(z.string().min(8), "short")).toBe(
			m.error_validation_string_too_small({
				minimum: 8,
			}),
		);
		expect(firstMessage(z.string().max(3), "long")).toBe(
			m.error_validation_string_too_big({
				maximum: 3,
			}),
		);
		expect(firstMessage(z.email(), "not-an-email")).toBe(
			m.error_validation_invalid_email(),
		);
		expect(firstMessage(z.url(), "nope")).toBe(
			m.error_validation_invalid_url(),
		);
		expect(firstMessage(z.array(z.string()).min(1), [])).toBe(
			m.error_validation_array_too_small({
				minimum: 1,
			}),
		);
		expect(firstMessage(z.number().min(2), 1)).toBe(
			m.error_validation_number_too_small({
				minimum: 2,
			}),
		);
		expect(firstMessage(z.string(), undefined)).toBe(
			m.error_validation_required(),
		);
		expect(firstMessage(z.string(), 4)).toBe(
			m.error_validation_invalid_value(),
		);
	});

	test("renders a custom check through its reason", () => {
		const schema = z
			.object({
				password: z.string(),
				confirmPassword: z.string(),
			})
			.refine((value) => value.password === value.confirmPassword, {
				params: {
					reason: "PASSWORDS_MISMATCH",
				},
				path: [
					"confirmPassword",
				],
			});

		expect(
			firstMessage(schema, {
				password: "a",
				confirmPassword: "b",
			}),
		).toBe(m.error_passwords_mismatch());
	});

	test("falls back for a custom check without a reason", () => {
		expect(
			firstMessage(
				z.string().refine(() => false),
				"x",
			),
		).toBe(m.error_validation_invalid_value());
	});
});
