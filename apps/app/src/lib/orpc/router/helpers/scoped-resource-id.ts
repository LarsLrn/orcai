import { assetIdSchema, blockIdSchema, botIdSchema } from "@orcai/schema";

/** Recovers the branded resource id from a plain `(resourceType, resourceId)` row. */
export const parseScopedResourceId = (resource: {
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
}) => {
	switch (resource.resourceType) {
		case "asset":
			return assetIdSchema.parse(resource.resourceId);
		case "block":
			return blockIdSchema.parse(resource.resourceId);
		case "bot":
			return botIdSchema.parse(resource.resourceId);
	}
};
