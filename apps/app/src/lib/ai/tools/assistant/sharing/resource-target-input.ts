import { principalTypeSchema, resourceTypeSchema } from "@orcai/schema";
import { z } from "zod/v4";

/**
 * The target as flat fields: the contract's discriminated unions convert to
 * a top-level `oneOf`, which providers reject as a tool schema.
 */
export const targetShape = {
	targetType: resourceTypeSchema.describe(
		"bot, block (a behaviour or repository) or asset.",
	),
	targetId: z
		.uuidv4()
		.describe("Id of the bot, block or asset, from the find tools."),
};

export const granteeShape = {
	granteeType: principalTypeSchema,
	granteeId: z
		.uuidv4()
		.describe("Id of the user or group, from findPeople or listAccess."),
};
