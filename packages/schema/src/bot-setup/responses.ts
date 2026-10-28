import { z } from "zod/v4";
import { createDataResponseSchema } from "../shared";
import { botSetupCoverageSchema, botSetupSchema } from "./schema";

export const findBotSetupResponseSchema = createDataResponseSchema(
	z.object({
		setup: botSetupSchema.nullable(),
		/** Whether the caller edits the setup, and so sees its coverage. */
		canEdit: z.boolean(),
	}),
);

export const saveBotSetupResponseSchema = createDataResponseSchema(
	botSetupSchema.nullable(),
);

export const botSetupCoverageResponseSchema = createDataResponseSchema(
	botSetupCoverageSchema,
);
