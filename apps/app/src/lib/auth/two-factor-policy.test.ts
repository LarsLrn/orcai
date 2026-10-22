import { describe, expect, test } from "bun:test";
import { INSTANCE_ADMIN_ROLE, INSTANCE_DEFAULT_ROLE } from "@orcai/core";
import { requiresTwoFactor, TWO_FACTOR_POLICIES } from "./two-factor-policy";

describe("requiresTwoFactor", () => {
	const expected = {
		none: {
			[INSTANCE_ADMIN_ROLE]: false,
			[INSTANCE_DEFAULT_ROLE]: false,
		},
		admins: {
			[INSTANCE_ADMIN_ROLE]: true,
			[INSTANCE_DEFAULT_ROLE]: false,
		},
		all: {
			[INSTANCE_ADMIN_ROLE]: true,
			[INSTANCE_DEFAULT_ROLE]: true,
		},
	};

	for (const policy of TWO_FACTOR_POLICIES)
		for (const role of [
			INSTANCE_ADMIN_ROLE,
			INSTANCE_DEFAULT_ROLE,
		] as const) {
			test(`${policy} policy, ${role} without two-factor`, () => {
				expect(
					requiresTwoFactor(policy, {
						role,
						twoFactorEnabled: false,
					}),
				).toBe(expected[policy][role]);
			});

			test(`${policy} policy, ${role} with two-factor`, () => {
				expect(
					requiresTwoFactor(policy, {
						role,
						twoFactorEnabled: true,
					}),
				).toBe(false);
			});
		}

	test("an unset flag counts as not enrolled", () => {
		expect(
			requiresTwoFactor("all", {
				role: INSTANCE_DEFAULT_ROLE,
			}),
		).toBe(true);
	});
});
