import { z } from "zod/v4";
import { blockIdSchema } from "../../block/ref";
import { groupIdSchema } from "../../group/ref";
import { createResourceScopedSchema } from "../../resource/schema";

/**
 * A procedure call that wrote for an Assistant turn, with only the fields of
 * its input and output that the queries it makes stale depend on.
 */
export const turnWriteSchema = z.discriminatedUnion("path", [
	z.object({
		path: z.enum([
			"asset.delete",
			"asset.generateMissingMetadata",
			"asset.prepareAgain",
			"asset.save",
			"block.create",
			"block.delete",
			"block.prepareAssetAgain",
			"block.update",
			"bot.delete",
			"bot.publish",
			"botSetup.save",
			"catalogue.add",
			"catalogue.remove",
			"group.create",
			"group.delete",
			"group.update",
			"organizationInvitation.create",
			"organizationInvitation.delete",
		]),
	}),
	z.object({
		path: z.literal("bot.save"),
		listBlockIds: z.array(blockIdSchema).default([]),
	}),
	z.object({
		path: z.enum([
			"group.addMembers",
			"group.removeMembers",
		]),
		groupId: groupIdSchema,
	}),
	createResourceScopedSchema({
		path: z.enum([
			"resource.grant",
			"resource.revoke",
		]),
	}),
	z.object({
		path: z.enum([
			"organizationMember.update",
			"organizationMember.delete",
		]),
		handedOver: z.boolean(),
	}),
]);

export type TurnWrite = z.infer<typeof turnWriteSchema>;

/** The writes a stored reply lists; an entry that fails the schema is dropped. */
export const turnWritesSchema = z.array(z.unknown()).transform((entries) =>
	entries.flatMap((entry) => {
		const parsed = turnWriteSchema.safeParse(entry);

		return parsed.success
			? [
					parsed.data,
				]
			: [];
	}),
);
