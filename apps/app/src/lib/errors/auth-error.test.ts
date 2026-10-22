import { describe, expect, test } from "bun:test";
import { toAuthError } from "./auth-error";

describe("toAuthError", () => {
	test("keeps a Better Auth code that is a reason of ours", () => {
		expect(
			toAuthError({
				code: "SESSION_NOT_FRESH",
				message: "Session is not fresh",
			}),
		).toMatchObject({
			reason: "SESSION_NOT_FRESH",
		});
	});

	test("maps a Better Auth code to its reason", () => {
		expect(
			toAuthError({
				code: "ERROR_CEREMONY_ABORTED",
			}),
		).toMatchObject({
			reason: "PASSKEY_CANCELLED",
		});
	});
});
