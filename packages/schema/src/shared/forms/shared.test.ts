import { describe, expect, test } from "bun:test";
import { changePasswordSchema } from "./change-password";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	sharedSchemas,
} from "./shared";
import { signinSchema } from "./signin";

const accepts = (value: string) =>
	sharedSchemas.password.safeParse(value).success;

describe("new password limits", () => {
	test("accepts the minimum and the maximum length", () => {
		expect(accepts("a".repeat(PASSWORD_MIN_LENGTH))).toBe(true);
		expect(accepts("a".repeat(PASSWORD_MAX_LENGTH))).toBe(true);
	});

	test("refuses one below the minimum and one above the maximum", () => {
		expect(accepts("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
		expect(accepts("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
	});

	test("counts UTF-16 code units like the server", () => {
		expect(accepts("😀".repeat(PASSWORD_MAX_LENGTH / 2))).toBe(true);
		expect(accepts("😀".repeat(PASSWORD_MAX_LENGTH / 2 + 1))).toBe(false);
		expect(accepts("😀".repeat(PASSWORD_MIN_LENGTH / 2 - 1))).toBe(false);
	});
});

describe("existing password", () => {
	const long = "a".repeat(PASSWORD_MAX_LENGTH + 50);

	test("change password accepts a long current password", () => {
		const result = changePasswordSchema.safeParse({
			currentPassword: long,
			password: "a-new-password",
			confirmPassword: "a-new-password",
		});
		expect(result.success).toBe(true);
	});

	test("sign-in accepts a long or short password", () => {
		for (const password of [
			long,
			"x",
		]) {
			expect(
				signinSchema.safeParse({
					email: "a@example.com",
					password,
				}).success,
			).toBe(true);
		}
	});

	test("an empty current password is refused", () => {
		expect(sharedSchemas.currentPassword.safeParse("").success).toBe(false);
	});
});
