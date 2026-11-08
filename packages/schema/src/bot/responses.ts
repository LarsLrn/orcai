import { z } from "zod/v4";
import { behaviourBlockSchema, repositoryBlockSchema } from "../block/schema";
import {
	homeOrganizationSchema,
	resourceOwnerSchema,
} from "../resource/schema";
import { botIdSchema } from "../shared/ids";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared/responses";
import { botReadinessIssueSchema } from "./readiness";
import {
	botEditorSchema,
	botListItemSchema,
	botWithBlocksSchema,
} from "./schema";

export const listBotsResponseSchema =
	createListResponseSchema(botListItemSchema);

export const findBotResponseSchema = createDataResponseSchema(
	botWithBlocksSchema.extend({
		owner: resourceOwnerSchema,
		/** Set when the active organisation added the bot from the catalogue. */
		homeOrganization: homeOrganizationSchema.nullable(),
		/** Why the bot cannot be ready; empty unless the caller may edit it. */
		readiness: z.array(botReadinessIssueSchema),
	}),
);

/** The bot's published behaviour and repositories, with their settings. */
export const findBotContentsResponseSchema = createDataResponseSchema(
	z.object({
		behaviour: behaviourBlockSchema.nullable(),
		repositories: z.array(repositoryBlockSchema),
	}),
);

export const findBotEditorResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const saveBotResponseSchema = createDataResponseSchema(botEditorSchema);

export const publishBotResponseSchema =
	createDataResponseSchema(botEditorSchema);

export const setBotFavouriteResponseSchema = createDataResponseSchema(
	z.object({
		id: botIdSchema,
		favourite: z.boolean(),
	}),
);

export const deleteBotsResponseSchema = createDeleteResponseSchema();
