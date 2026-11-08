import { z } from "zod/v4";
import type { PublicationStatus } from "../shared/primitives/publication-status";

/** A block a bot links, as far as the bot's readiness depends on it. */
export type BotReadinessBlock = {
	type: "behaviour" | "repository";
	name: string;
	status: PublicationStatus;
	assetCount: number;
};

/** Why a bot cannot be ready. */
export const botReadinessIssueSchema = z.discriminatedUnion("reason", [
	z.object({
		reason: z.enum([
			"BOT_BEHAVIOUR_BLOCK_REQUIRED",
			"BOT_BEHAVIOUR_BLOCK_NOT_READY",
		]),
	}),
	z.object({
		reason: z.enum([
			"BOT_REPOSITORY_NOT_READY",
			"BOT_REPOSITORY_EMPTY",
		]),
		params: z.object({
			blockName: z.string(),
		}),
	}),
]);

export type BotReadinessIssue = z.infer<typeof botReadinessIssueSchema>;

/**
 * Every reason the bot cannot be ready, empty when it can: it needs a ready
 * behaviour, and every repository it links ready and holding an asset.
 */
export const botReadinessIssues = (
	blocks: readonly BotReadinessBlock[],
): BotReadinessIssue[] => {
	const behaviour = blocks.find((block) => block.type === "behaviour");
	const issues: BotReadinessIssue[] = [];
	if (!behaviour) {
		issues.push({
			reason: "BOT_BEHAVIOUR_BLOCK_REQUIRED",
		});
	} else if (behaviour.status !== "ready") {
		issues.push({
			reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
		});
	}
	for (const block of blocks) {
		if (block.type !== "repository") continue;
		const params = {
			blockName: block.name,
		};
		if (block.status !== "ready") {
			issues.push({
				reason: "BOT_REPOSITORY_NOT_READY",
				params,
			});
		}
		if (block.assetCount === 0) {
			issues.push({
				reason: "BOT_REPOSITORY_EMPTY",
				params,
			});
		}
	}
	return issues;
};
