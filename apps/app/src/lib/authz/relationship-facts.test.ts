import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type {
	AssetId,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import type { TupleMutation } from "@orcai/spice-db";
import {
	projectRelationshipFacts,
	RelationshipFact,
	type ResourceRef,
} from "./relationship-facts";

const id = (n: number) =>
	`00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const botId = id(1) as BotId;
const blockId = id(2) as BlockId;
const otherBlockId = id(3) as BlockId;
const thirdBlockId = id(4) as BlockId;
const assetId = id(5) as AssetId;
const otherAssetId = id(6) as AssetId;
const chatId = id(7) as ChatId;
const organizationId = id(8) as OrganizationId;
const ownerId = id(10) as UserId;
const userId = id(11) as UserId;
const groupId = id(12) as GroupId;

const bot: ResourceRef = {
	resourceType: "bot",
	resourceId: botId,
};

const render = (mutation: TupleMutation) =>
	`${mutation.operation} ${mutation.resourceType}:${mutation.resourceId}#${mutation.relation}@${mutation.subjectType}:${mutation.subjectId}${mutation.subjectRelation ? `#${mutation.subjectRelation}` : ""}`;

const project = (...facts: RelationshipFact[]) =>
	projectRelationshipFacts(facts).map(render);

describe("projectRelationshipFacts", () => {
	test("a private resource gets only its owner", () => {
		expect(
			project(
				RelationshipFact.ResourceCreated({
					resource: bot,
					ownerId,
					visibility: "private",
				}),
			),
		).toEqual([
			`touch bot:${botId}#owner@user:${ownerId}`,
		]);
	});

	test("a public resource also gets the public wildcard", () => {
		expect(
			project(
				RelationshipFact.ResourceCreated({
					resource: bot,
					ownerId,
					visibility: "public",
				}),
			),
		).toEqual([
			`touch bot:${botId}#owner@user:${ownerId}`,
			`touch bot:${botId}#public@user:*`,
		]);
	});

	test("a deleted resource loses its owner and the public wildcard", () => {
		expect(
			project(
				RelationshipFact.ResourceDeleted({
					resource: bot,
					ownerId,
				}),
			),
		).toEqual([
			`delete bot:${botId}#owner@user:${ownerId}`,
			`delete bot:${botId}#public@user:*`,
		]);
	});

	test("visibility touches or deletes the public wildcard", () => {
		expect(
			project(
				RelationshipFact.ResourceVisibilitySet({
					resource: bot,
					visibility: "public",
				}),
			),
		).toEqual([
			`touch bot:${botId}#public@user:*`,
		]);
		expect(
			project(
				RelationshipFact.ResourceVisibilitySet({
					resource: bot,
					visibility: "private",
				}),
			),
		).toEqual([
			`delete bot:${botId}#public@user:*`,
		]);
	});

	describe("grant changes", () => {
		const grant = (
			ended: readonly ("viewer" | "editor" | "manager")[],
			held: readonly ("viewer" | "editor" | "manager")[],
			principal:
				| {
						principalType: "user";
						principalId: UserId;
				  }
				| {
						principalType: "group";
						principalId: GroupId;
				  } = {
				principalType: "user",
				principalId: userId,
			},
		) =>
			RelationshipFact.ResourceGrantChanged({
				resource: bot,
				principal,
				ended,
				held,
			});

		test("a new grant touches the role", () => {
			expect(
				project(
					grant(
						[],
						[
							"viewer",
						],
					),
				),
			).toEqual([
				`touch bot:${botId}#viewer@user:${userId}`,
			]);
		});

		test("a revoked grant deletes the role", () => {
			expect(
				project(
					grant(
						[
							"editor",
						],
						[],
					),
				),
			).toEqual([
				`delete bot:${botId}#editor@user:${userId}`,
			]);
		});

		test("a role change deletes the old role and touches the new one", () => {
			expect(
				project(
					grant(
						[
							"viewer",
						],
						[
							"manager",
						],
					),
				),
			).toEqual([
				`delete bot:${botId}#viewer@user:${userId}`,
				`touch bot:${botId}#manager@user:${userId}`,
			]);
		});

		test("an unchanged role only touches it", () => {
			expect(
				project(
					grant(
						[
							"editor",
						],
						[
							"editor",
						],
					),
				),
			).toEqual([
				`touch bot:${botId}#editor@user:${userId}`,
			]);
		});

		test("no role before or after emits nothing", () => {
			expect(project(grant([], []))).toEqual([]);
		});

		test("an ended grant keeps a role another organisation's grant still backs", () => {
			expect(
				project(
					grant(
						[
							"viewer",
						],
						[
							"viewer",
							"editor",
						],
					),
				),
			).toEqual([
				`touch bot:${botId}#viewer@user:${userId}`,
				`touch bot:${botId}#editor@user:${userId}`,
			]);
		});

		test("a group principal is its member set", () => {
			expect(
				project(
					grant(
						[
							"viewer",
						],
						[
							"editor",
						],
						{
							principalType: "group",
							principalId: groupId,
						},
					),
				),
			).toEqual([
				`delete bot:${botId}#viewer@group:${groupId}#member`,
				`touch bot:${botId}#editor@group:${groupId}#member`,
			]);
		});
	});

	describe("organization role changes", () => {
		const role = (
			from: "admin" | "member" | null,
			to: "admin" | "member" | null,
		) =>
			RelationshipFact.OrganizationRoleChanged({
				organizationId,
				userId,
				from,
				to,
			});

		test("follow the same from/to rule as grants", () => {
			expect(project(role(null, "member"))).toEqual([
				`touch organization:${organizationId}#member@user:${userId}`,
			]);
			expect(project(role("member", "admin"))).toEqual([
				`delete organization:${organizationId}#member@user:${userId}`,
				`touch organization:${organizationId}#admin@user:${userId}`,
			]);
			expect(project(role("admin", "admin"))).toEqual([
				`touch organization:${organizationId}#admin@user:${userId}`,
			]);
			expect(project(role("admin", null))).toEqual([
				`delete organization:${organizationId}#admin@user:${userId}`,
			]);
		});
	});

	test("a group joins and leaves its organization", () => {
		const group = {
			groupId,
			organizationId,
			allMembers: false,
		};
		expect(project(RelationshipFact.GroupCreated(group))).toEqual([
			`touch group:${groupId}#organization@organization:${organizationId}`,
		]);
		expect(project(RelationshipFact.GroupDeleted(group))).toEqual([
			`delete group:${groupId}#organization@organization:${organizationId}`,
		]);
	});

	test("the All Members group's members are every organization role", () => {
		const group = {
			groupId,
			organizationId,
			allMembers: true,
		};
		const tuples = [
			`group:${groupId}#organization@organization:${organizationId}`,
			`group:${groupId}#member@organization:${organizationId}#admin`,
			`group:${groupId}#member@organization:${organizationId}#manager`,
			`group:${groupId}#member@organization:${organizationId}#member`,
			`group:${groupId}#member@organization:${organizationId}#viewer`,
		];
		expect(project(RelationshipFact.GroupCreated(group))).toEqual(
			tuples.map((tuple) => `touch ${tuple}`),
		);
		expect(project(RelationshipFact.GroupDeleted(group))).toEqual(
			tuples.map((tuple) => `delete ${tuple}`),
		);
	});

	test("group membership touches or deletes the member tuple", () => {
		expect(
			project(
				RelationshipFact.GroupMembershipChanged({
					groupId,
					userId,
					member: true,
				}),
				RelationshipFact.GroupMembershipChanged({
					groupId,
					userId: ownerId,
					member: false,
				}),
			),
		).toEqual([
			`touch group:${groupId}#member@user:${userId}`,
			`delete group:${groupId}#member@user:${ownerId}`,
		]);
	});

	test("bot blocks project the set delta, ignoring duplicates", () => {
		expect(
			project(
				RelationshipFact.BotBlocksChanged({
					botId,
					before: [
						blockId,
						otherBlockId,
						blockId,
					],
					after: [
						otherBlockId,
						thirdBlockId,
						thirdBlockId,
					],
				}),
			),
		).toEqual([
			`delete block:${blockId}#bot@bot:${botId}`,
			`touch block:${thirdBlockId}#bot@bot:${botId}`,
		]);
	});

	test("block assets project the set delta, ignoring duplicates", () => {
		expect(
			project(
				RelationshipFact.BlockAssetsChanged({
					blockId,
					before: [
						assetId,
						assetId,
					],
					after: [
						otherAssetId,
						otherAssetId,
					],
				}),
			),
		).toEqual([
			`delete asset:${assetId}#block@block:${blockId}`,
			`touch asset:${otherAssetId}#block@block:${blockId}`,
		]);
	});

	test("unchanged links emit nothing", () => {
		expect(
			project(
				RelationshipFact.BotBlocksChanged({
					botId,
					before: [
						blockId,
					],
					after: [
						blockId,
						blockId,
					],
				}),
			),
		).toEqual([]);
	});

	test("a chat gets its owner and, when it has one, its bot", () => {
		expect(
			project(
				RelationshipFact.ChatCreated({
					chatId,
					ownerId,
					botId: null,
				}),
			),
		).toEqual([
			`touch chat:${chatId}#owner@user:${ownerId}`,
		]);
		expect(
			project(
				RelationshipFact.ChatCreated({
					chatId,
					ownerId,
					botId,
				}),
			),
		).toEqual([
			`touch chat:${chatId}#owner@user:${ownerId}`,
			`touch chat:${chatId}#bot@bot:${botId}`,
		]);
	});

	test("an unlinked chat bot is deleted", () => {
		expect(
			project(
				RelationshipFact.ChatBotUnlinked({
					chatId,
					botId,
				}),
			),
		).toEqual([
			`delete chat:${chatId}#bot@bot:${botId}`,
		]);
	});

	describe("the last operation on a tuple wins", () => {
		test("a grant changed and then revoked leaves only deletions", () => {
			expect(
				project(
					RelationshipFact.ResourceGrantChanged({
						resource: bot,
						principal: {
							principalType: "user",
							principalId: userId,
						},
						ended: [
							"viewer",
						],
						held: [
							"editor",
						],
					}),
					RelationshipFact.ResourceGrantChanged({
						resource: bot,
						principal: {
							principalType: "user",
							principalId: userId,
						},
						ended: [
							"editor",
						],
						held: [],
					}),
				),
			).toEqual([
				`delete bot:${botId}#viewer@user:${userId}`,
				`delete bot:${botId}#editor@user:${userId}`,
			]);
		});

		test("a membership removed and re-added is touched", () => {
			expect(
				project(
					RelationshipFact.GroupMembershipChanged({
						groupId,
						userId,
						member: false,
					}),
					RelationshipFact.GroupMembershipChanged({
						groupId,
						userId,
						member: true,
					}),
				),
			).toEqual([
				`touch group:${groupId}#member@user:${userId}`,
			]);
		});

		test("a resource created public and then made private keeps the owner", () => {
			expect(
				project(
					RelationshipFact.ResourceCreated({
						resource: bot,
						ownerId,
						visibility: "public",
					}),
					RelationshipFact.ResourceVisibilitySet({
						resource: bot,
						visibility: "private",
					}),
				),
			).toEqual([
				`touch bot:${botId}#owner@user:${ownerId}`,
				`delete bot:${botId}#public@user:*`,
			]);
		});

		test("the same user and group as subjects stay distinct tuples", () => {
			const sameId = id(20);
			expect(
				project(
					RelationshipFact.ResourceGrantChanged({
						resource: bot,
						principal: {
							principalType: "user",
							principalId: sameId as UserId,
						},
						ended: [],
						held: [
							"viewer",
						],
					}),
					RelationshipFact.ResourceGrantChanged({
						resource: bot,
						principal: {
							principalType: "group",
							principalId: sameId as GroupId,
						},
						ended: [
							"viewer",
						],
						held: [],
					}),
				),
			).toEqual([
				`touch bot:${botId}#viewer@user:${sameId}`,
				`delete bot:${botId}#viewer@group:${sameId}#member`,
			]);
		});
	});
});

const readSchema = () => {
	const source = readFileSync(
		new URL(
			"../../../../../packages/spice-db/src/schema/schema.zed",
			import.meta.url,
		),
		"utf8",
	);
	const definitions = new Map<string, Map<string, Set<string>>>();
	for (const [, name, body] of source.matchAll(
		/definition (\w+) \{([^}]*)\}/g,
	)) {
		const relations = new Map<string, Set<string>>();
		for (const [, relation, types] of (body ?? "").matchAll(
			/relation (\w+): (.+)/g,
		)) {
			relations.set(
				relation ?? "",
				new Set((types ?? "").split("|").map((type) => type.trim())),
			);
		}
		definitions.set(name ?? "", relations);
	}
	return definitions;
};

const block: ResourceRef = {
	resourceType: "block",
	resourceId: blockId,
};
const asset: ResourceRef = {
	resourceType: "asset",
	resourceId: assetId,
};
const resources = [
	bot,
	block,
	asset,
];
const principals = [
	{
		principalType: "user",
		principalId: userId,
	},
	{
		principalType: "group",
		principalId: groupId,
	},
] as const;

const samples: Record<RelationshipFact["_tag"], RelationshipFact[]> = {
	ResourceCreated: resources.map((resource) =>
		RelationshipFact.ResourceCreated({
			resource,
			ownerId,
			visibility: "public",
		}),
	),
	ResourceDeleted: resources.map((resource) =>
		RelationshipFact.ResourceDeleted({
			resource,
			ownerId,
		}),
	),
	ResourceVisibilitySet: resources.map((resource) =>
		RelationshipFact.ResourceVisibilitySet({
			resource,
			visibility: "public",
		}),
	),
	ResourceGrantChanged: resources.flatMap((resource) =>
		principals.flatMap((principal) =>
			(
				[
					[
						"viewer",
						"editor",
					],
					[
						"editor",
						"manager",
					],
				] as const
			).map(([ended, held]) =>
				RelationshipFact.ResourceGrantChanged({
					resource,
					principal,
					ended: ended
						? [
								ended,
							]
						: [],
					held: held
						? [
								held,
							]
						: [],
				}),
			),
		),
	),
	OrganizationRoleChanged: (
		[
			[
				"admin",
				"manager",
			],
			[
				"member",
				"viewer",
			],
		] as const
	).map(([from, to]) =>
		RelationshipFact.OrganizationRoleChanged({
			organizationId,
			userId,
			from,
			to,
		}),
	),
	GroupCreated: [
		RelationshipFact.GroupCreated({
			groupId,
			organizationId,
			allMembers: true,
		}),
	],
	GroupDeleted: [
		RelationshipFact.GroupDeleted({
			groupId,
			organizationId,
			allMembers: true,
		}),
	],
	GroupMembershipChanged: [
		RelationshipFact.GroupMembershipChanged({
			groupId,
			userId,
			member: true,
		}),
	],
	BotBlocksChanged: [
		RelationshipFact.BotBlocksChanged({
			botId,
			before: [],
			after: [
				blockId,
			],
		}),
	],
	BlockAssetsChanged: [
		RelationshipFact.BlockAssetsChanged({
			blockId,
			before: [],
			after: [
				assetId,
			],
		}),
	],
	ChatCreated: [
		RelationshipFact.ChatCreated({
			chatId,
			ownerId,
			botId,
		}),
	],
	ChatBotUnlinked: [
		RelationshipFact.ChatBotUnlinked({
			chatId,
			botId,
		}),
	],
};

describe("projected tuples", () => {
	test.each(Object.entries(samples))(
		"%s fits the SpiceDB schema",
		(_tag, facts) => {
			const schema = readSchema();
			const mutations = projectRelationshipFacts(facts);
			expect(mutations.length).toBeGreaterThan(0);
			for (const mutation of mutations) {
				const subject =
					mutation.subjectId === "*"
						? `${mutation.subjectType}:*`
						: mutation.subjectRelation
							? `${mutation.subjectType}#${mutation.subjectRelation}`
							: mutation.subjectType;
				expect({
					tuple: render(mutation),
					allowed: schema
						.get(mutation.resourceType)
						?.get(mutation.relation)
						?.has(subject),
				}).toEqual({
					tuple: render(mutation),
					allowed: true,
				});
			}
		},
	);
});
