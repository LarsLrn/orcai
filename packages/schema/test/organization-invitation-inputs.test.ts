import { describe, expect, test } from "bun:test";
import { updateOrganizationInvitationInputSchema } from "../src";

const id = "11111111-1111-4111-8111-111111111111";

describe("updateOrganizationInvitationInputSchema", () => {
	test("cannot accept an invitation", () => {
		expect(
			updateOrganizationInvitationInputSchema.safeParse({
				id,
				status: "accepted",
			}).success,
		).toBe(false);
	});

	test("reopens or revokes an invitation", () => {
		for (const status of [
			"pending",
			"rejected",
		]) {
			expect(
				updateOrganizationInvitationInputSchema.safeParse({
					id,
					status,
				}).success,
			).toBe(true);
		}
	});

	test("requires a status or an expiry", () => {
		expect(
			updateOrganizationInvitationInputSchema.safeParse({
				id,
			}).success,
		).toBe(false);
	});
});
