import { describe, expect, test } from "bun:test";
import { DEFAULT_INVITATION_TTL_DAYS } from "@orcai/schema";
import { cookieName } from "@/paraglide/runtime";
import { invitationInput, requestLocale } from "./invitation-input";

describe("invitationInput", () => {
	test("expires the form's default number of days out and drops repeated addresses", () => {
		const now = new Date("2026-10-20T12:00:00.000Z");
		const input = invitationInput(
			{
				emails: [
					"anna@example.org",
					" Anna@Example.org",
					"ben@example.org",
				],
				role: "member",
			},
			{
				now,
				locale: "de",
			},
		);

		expect(DEFAULT_INVITATION_TTL_DAYS).toBe(7);
		expect(input).toEqual({
			role: "member",
			expiresAt: new Date("2026-10-27T12:00:00.000Z"),
			locale: "de",
			items: [
				{
					email: "Anna@Example.org",
				},
				{
					email: "ben@example.org",
				},
			],
		});
	});
});

describe("requestLocale", () => {
	test("reads the locale cookie first", () => {
		expect(
			requestLocale(
				new Headers({
					cookie: `other=1; ${cookieName}=de`,
					"accept-language": "en-GB,en;q=0.9",
				}),
			),
		).toBe("de");
	});

	test("falls back to Accept-Language", () => {
		expect(
			requestLocale(
				new Headers({
					"accept-language": "de-DE,de;q=0.9,en;q=0.8",
				}),
			),
		).toBe("de");
	});

	test("leaves the stored locale to the procedure when the request names none", () => {
		expect(requestLocale(new Headers())).toBeUndefined();
		expect(
			requestLocale(
				new Headers({
					"accept-language": "fr-FR",
				}),
			),
		).toBeUndefined();
		expect(requestLocale(undefined)).toBeUndefined();
	});
});
