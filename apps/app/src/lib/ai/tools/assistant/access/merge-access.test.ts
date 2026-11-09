import { describe, expect, test } from "bun:test";
import {
	type InheritedAccess,
	RESOURCE_GRANT_ORIGIN,
	type ResourceGrant,
	type ResourceGrantRole,
} from "@orcai/schema";
import { mergeAccess } from "./merge-access";

const BOT_ID = "6a1f1c1e-2a3f-4c1d-9e8f-0a1b2c3d4e50";

const noInheritance: InheritedAccess = {
	ancestors: [],
	botCount: 0,
	blockCount: 0,
	hiddenAncestorCount: 0,
	groupCount: 0,
	userCount: 0,
	throughPublic: false,
};

const grant = (
	principal:
		| {
				type: "user";
				name: string;
				email?: string;
		  }
		| {
				type: "group";
				name: string;
				allMembers?: boolean;
		  },
	role: ResourceGrantRole,
	index: number,
) => {
	const principalId = `6a1f1c1e-2a3f-4c1d-9e8f-0a1b2c3d4e${String(index).padStart(2, "0")}`;

	return {
		id: principalId,
		resourceType: "bot",
		resourceId: BOT_ID,
		principalType: principal.type,
		principalId,
		role,
		grantedBy: principalId,
		createdAt: new Date(0),
		revokedAt: null,
		principal:
			principal.type === "user"
				? {
						type: "user",
						id: principalId,
						name: principal.name,
						email: principal.email,
						image: null,
					}
				: {
						type: "group",
						id: principalId,
						name: principal.name,
						description: null,
						kind: principal.allMembers ? "system" : "custom",
						systemKey: principal.allMembers ? "all_members" : null,
						organizationId: principalId,
					},
		origin:
			principal.type === "user"
				? RESOURCE_GRANT_ORIGIN.DIRECT_USER
				: principal.allMembers
					? RESOURCE_GRANT_ORIGIN.DIRECT_GROUP_ALL_MEMBERS
					: RESOURCE_GRANT_ORIGIN.DIRECT_GROUP,
	} as ResourceGrant;
};

describe("mergeAccess", () => {
	test("lists direct grants strongest role first, then by name", () => {
		const merged = mergeAccess(
			[
				grant(
					{
						type: "user",
						name: "Zoe",
					},
					"viewer",
					1,
				),
				grant(
					{
						type: "group",
						name: "All Members",
						allMembers: true,
					},
					"viewer",
					2,
				),
				grant(
					{
						type: "user",
						name: "Anna",
						email: "anna@example.org",
					},
					"manager",
					3,
				),
				grant(
					{
						type: "group",
						name: "Teaching",
					},
					"editor",
					4,
				),
			],
			noInheritance,
		);

		expect(
			merged.grants.map((entry) => [
				entry.name,
				entry.role,
			]),
		).toEqual([
			[
				"Anna",
				"manager",
			],
			[
				"Teaching",
				"editor",
			],
			[
				"All Members",
				"viewer",
			],
			[
				"Zoe",
				"viewer",
			],
		]);
		expect(merged.grants[0]).toMatchObject({
			granteeType: "user",
			email: "anna@example.org",
		});
		expect(merged.grants[2]).toMatchObject({
			granteeType: "group",
			allMembers: true,
		});
		expect(merged.grants[1]).not.toHaveProperty("allMembers");
		expect(merged.grants[3]).not.toHaveProperty("email");
		expect(merged.total).toBe(4);
		expect(merged.inherited).toBeNull();
	});

	test("summarises access through the bots and blocks above", () => {
		const merged = mergeAccess([], {
			ancestors: [
				{
					resourceType: "bot",
					resourceId: BOT_ID,
					name: "Citation check",
				},
			] as InheritedAccess["ancestors"],
			botCount: 2,
			blockCount: 1,
			hiddenAncestorCount: 2,
			groupCount: 3,
			userCount: 1,
			throughPublic: true,
		});

		expect<unknown>(merged).toEqual({
			grants: [],
			total: 0,
			inherited: {
				through: [
					{
						targetType: "bot",
						targetId: BOT_ID,
						name: "Citation check",
					},
				],
				hiddenCount: 2,
				groupCount: 3,
				userCount: 1,
				public: true,
			},
		});
	});
});
