import {
	createAssistantConversationInputSchema,
	createAssistantConversationResponseSchema,
	listAssistantConversationsInputSchema,
	listAssistantConversationsResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const assistantContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/assistant/conversations",
				summary:
					"List the caller's assistant conversations in the active organisation",
				tags: [
					"Assistant",
				],
			}),
		)
		.input(listAssistantConversationsInputSchema)
		.output(listAssistantConversationsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/assistant/conversations",
				summary: "Start an assistant conversation in the active organisation",
				tags: [
					"Assistant",
				],
			}),
		)
		.input(createAssistantConversationInputSchema)
		.output(createAssistantConversationResponseSchema),
};
