import { describe, expect, test } from "bun:test";
import { ORGANIZATION_ROLE_PERMISSIONS } from "@orcai/core";
import {
	assetCapabilitySchema,
	authorizationCheckInputSchema,
	authorizationCheckManyInputSchema,
	botCapabilitySchema,
	organizationCapabilitiesInputSchema,
	organizationCapabilitySchema,
	organizationRoleSchema,
} from "../src";

describe("capability schemas", () => {
	test("accept entity-specific permissions", () => {
		expect(organizationCapabilitySchema.safeParse("create_bot").success).toBe(
			true,
		);
		expect(
			organizationCapabilitySchema.safeParse("manage_organization").success,
		).toBe(true);
		expect(organizationCapabilitySchema.safeParse("invite").success).toBe(
			false,
		);
		expect(botCapabilitySchema.safeParse("manage_access").success).toBe(true);
		expect(assetCapabilitySchema.safeParse("download").success).toBe(true);
	});

	test("accept organization roles", () => {
		expect(organizationRoleSchema.options).toEqual([
			"admin",
			"manager",
			"member",
			"viewer",
		]);
	});

	test("defines organization role presets", () => {
		expect(ORGANIZATION_ROLE_PERMISSIONS.admin).toContain("manage_quotas");
		expect(ORGANIZATION_ROLE_PERMISSIONS.manager).toContain("manage_groups");
		expect(ORGANIZATION_ROLE_PERMISSIONS.manager).not.toContain(
			"manage_models",
		);
		expect(ORGANIZATION_ROLE_PERMISSIONS.member).toContain("create_bot");
		expect(ORGANIZATION_ROLE_PERMISSIONS.member).not.toContain(
			"manage_members",
		);
		expect(ORGANIZATION_ROLE_PERMISSIONS.viewer).toEqual([
			"read",
		]);
	});

	test("validate single checks", () => {
		expect(
			authorizationCheckInputSchema.safeParse({
				entityType: "bot",
				entityId: "bot_1",
				permission: "edit",
			}).success,
		).toBe(true);
	});

	test("validate batched checks", () => {
		expect(
			authorizationCheckManyInputSchema.safeParse({
				entityType: "asset",
				entityIds: [
					"asset_1",
				],
				permissions: [
					"read",
					"download",
				],
			}).success,
		).toBe(true);
	});

	test("validate active organization checks", () => {
		expect(
			organizationCapabilitiesInputSchema.safeParse({
				permissions: [
					"read",
					"manage_organization",
				],
			}).success,
		).toBe(true);
	});
});
