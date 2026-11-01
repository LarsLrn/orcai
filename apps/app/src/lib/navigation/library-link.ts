import { assetIdSchema, blockIdSchema, botIdSchema } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import type { ResourceKind } from "@/lib/presentation/resource-kind";

/** The resource's page in the active organisation's library. */
export const libraryLink = (resource: {
	kind: ResourceKind;
	id: string;
}): LinkProps => {
	switch (resource.kind) {
		case "bot":
			return {
				to: "/app/library/bots/$botId",
				params: {
					botId: botIdSchema.parse(resource.id),
				},
			};
		case "behaviour":
			return {
				to: "/app/library/behaviours/$blockId",
				params: {
					blockId: blockIdSchema.parse(resource.id),
				},
			};
		case "repository":
			return {
				to: "/app/library/repositories/$blockId",
				params: {
					blockId: blockIdSchema.parse(resource.id),
				},
			};
		case "asset":
			return {
				to: "/app/library/assets/$assetId",
				params: {
					assetId: assetIdSchema.parse(resource.id),
				},
			};
	}
};
