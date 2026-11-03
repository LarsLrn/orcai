import {
	aiChatInputSchema,
	aiChatResponseSchema,
	continueChatInputSchema,
	keepUploadsInputSchema,
	keepUploadsResponseSchema,
	recordTurnWritesInputSchema,
	statusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"AI",
		],
	}),
);

export const aiContracts = {
	chat: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/ai",
				summary: "Send a chat message and stream the reply",
			}),
		)
		.input(aiChatInputSchema)
		.output(aiChatResponseSchema),
	continue: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/ai/continue",
				summary: "Continue a reply after tool approvals",
			}),
		)
		.input(continueChatInputSchema)
		.output(aiChatResponseSchema),
	keepUploads: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/ai/uploads",
				summary: "Keep the files a waiting upload request lists",
			}),
		)
		.input(keepUploadsInputSchema)
		.output(keepUploadsResponseSchema),
	recordTurnWrites: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/ai/turn-writes",
				summary: "Make a finished turn's writes visible to later reads",
			}),
		)
		.input(recordTurnWritesInputSchema)
		.output(statusResponseSchema),
};
