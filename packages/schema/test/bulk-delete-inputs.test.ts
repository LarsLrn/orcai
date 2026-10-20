import { describe, expect, test } from "bun:test";
import {
	deleteAssetPointInputSchema,
	deleteAssetsInputSchema,
	deleteBlocksInputSchema,
	deleteBotsInputSchema,
	deleteChatInputSchema,
	deleteGroupsInputSchema,
	deleteModelsInputSchema,
	deleteOrganizationInvitationsInputSchema,
	deleteOrganizationMembersInputSchema,
	deleteOrganizationsInputSchema,
	deleteProviderInputSchema,
} from "../src";

const ids = [
	"11111111-1111-4111-8111-111111111111",
	"22222222-2222-4222-8222-222222222222",
] as const;

const idRefs = ids.map((id) => ({
	id,
}));

const duplicateIdRefs = [
	{
		id: ids[0],
	},
	{
		id: ids[0],
	},
];

const createIdRefCase = (
	name: string,
	schema: {
		safeParse: (input: unknown) => {
			success: boolean;
		};
	},
	extraInput: Record<string, unknown> = {},
) => ({
	name,
	schema,
	valid: {
		...extraInput,
		refs: idRefs,
	},
	duplicate: {
		...extraInput,
		refs: duplicateIdRefs,
	},
	empty: {
		...extraInput,
		refs: [],
	},
});

const deleteSchemas = [
	createIdRefCase("assets", deleteAssetsInputSchema),
	createIdRefCase("asset points", deleteAssetPointInputSchema, {
		assetId: ids[0],
	}),
	createIdRefCase("blocks", deleteBlocksInputSchema),
	createIdRefCase("bots", deleteBotsInputSchema),
	createIdRefCase("chats", deleteChatInputSchema),
	createIdRefCase("groups", deleteGroupsInputSchema),
	createIdRefCase("models", deleteModelsInputSchema),
	createIdRefCase(
		"organization invitations",
		deleteOrganizationInvitationsInputSchema,
	),
	createIdRefCase("organizations", deleteOrganizationsInputSchema),
	createIdRefCase("providers", deleteProviderInputSchema),
	{
		name: "organization members",
		schema: deleteOrganizationMembersInputSchema,
		valid: {
			refs: ids.map((userId) => ({
				userId,
			})),
		},
		duplicate: {
			refs: [
				{
					userId: ids[1],
				},
				{
					userId: ids[1],
				},
			],
		},
		empty: {
			refs: [],
		},
	},
] as const;

describe("bulk delete input schemas", () => {
	for (const { name, schema, valid, duplicate, empty } of deleteSchemas) {
		test(`${name} require non-empty unique refs`, () => {
			expect(schema.safeParse(valid).success).toBe(true);
			expect(schema.safeParse(duplicate).success).toBe(false);
			expect(schema.safeParse(empty).success).toBe(false);
		});
	}
});
