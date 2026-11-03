import {
	createAssistantConversationInputSchema,
	createAssistantConversationResponseSchema,
	listAssistantConversationsInputSchema,
	listAssistantConversationsResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Assistant",
		],
	}),
);

export const assistantContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/assistant/conversations",
				summary:
					"List the caller's conversations with the OrcAI Assistant in the active organisation",
			}),
		)
		.input(listAssistantConversationsInputSchema)
		.output(listAssistantConversationsResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assistant/conversations",
				summary:
					"Start a conversation with the OrcAI Assistant in the active organisation",
			}),
		)
		.input(createAssistantConversationInputSchema)
		.output(createAssistantConversationResponseSchema),
};
