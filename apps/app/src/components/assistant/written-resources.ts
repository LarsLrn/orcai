import type { AssetId, BlockId, BotId } from "@orcai/core";
import type { ResourceIdentity } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { createContext } from "react";
import type { WrittenResource } from "@/lib/ai/tools/declaration";
import type { AnswerPart } from "@/lib/ai/turn-view/turn-view";
import { orpc } from "@/lib/orpc/orpc";

/** Current names by id of the resources a message's cards show that the user can still read. */
export type FoundResources = ReadonlyMap<string, string>;

/** Undefined until the lookup settles. */
export const WrittenResourcesContext = createContext<
	FoundResources | undefined
>(undefined);

const identityOf = ({ kind, id }: WrittenResource): ResourceIdentity => {
	switch (kind) {
		case "bot":
			return {
				resourceType: "bot",
				resourceId: id as BotId,
			};
		case "asset":
			return {
				resourceType: "asset",
				resourceId: id as AssetId,
			};
		case "behaviour":
		case "repository":
			return {
				resourceType: "block",
				resourceId: id as BlockId,
			};
	}
};

const NONE: FoundResources = new Map();

/**
 * Looks up a message's cards in one read once its turn settled, so a card
 * names a resource only while it exists and the user can read it.
 */
export const useWrittenResources = (
	answer: readonly AnswerPart[],
	zedToken: string | undefined,
): FoundResources | undefined => {
	const cards = answer.flatMap((part) =>
		part.kind === "resource"
			? [
					part,
				]
			: [],
	);
	const { data, isError } = useQuery(
		orpc.resource.findMany.queryOptions({
			input: {
				resources: cards.map((card) => identityOf(card.resource)),
				zedToken,
			},
			enabled: cards.length > 0 && cards.every((card) => card.settled),
			select: ({ data: found }): FoundResources =>
				new Map(
					found.map((resource) => [
						resource.resourceId,
						resource.name,
					]),
				),
		}),
	);

	return isError ? NONE : data;
};
