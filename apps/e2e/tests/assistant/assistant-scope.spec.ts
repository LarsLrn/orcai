import { randomUUID } from "node:crypto";
import type { BlockId, ChatMessageId } from "@orcai/core";
import { createApiClient } from "../../fixtures/api";
import {
	reasonOf,
	setUpAssistantModel,
	startConversation,
	turnRefusal,
} from "../../fixtures/assistant/assistant";
import { rejection, untilAllowed } from "../../fixtures/authorization";
import { sendTurn } from "../../fixtures/chat/chat";
import { signIn } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { addMember, createOrgsUser } from "../../fixtures/orgs/members";

test("assistant: a user in two organisations sees each one's conversations only there", async ({
	api,
	appBaseURL,
	browser,
	org,
	orgs,
	zedTokens,
}) => {
	test.slow();

	const other = await orgs.create("E2E Assistant Second");
	const user = await createOrgsUser(appBaseURL, "assistant-two-orgs");
	await addMember(api.as("admin"), {
		user,
		role: "member",
		zedTokens,
	});
	await untilAllowed(() =>
		addMember(api.as("admin", other), {
			user,
			role: "viewer",
			zedTokens,
		}),
	);

	// One session per organisation, since a session has one active organisation.
	const sessionIn = async (organizationId: typeof org.id) => {
		const session = await signIn(appBaseURL, user);
		const client = createApiClient(appBaseURL, session.cookieHeader, zedTokens);
		await client.user.setActiveOrganization({
			organizationId,
		});
		return {
			session,
			client,
		};
	};
	const first = await sessionIn(org.id);
	const second = await sessionIn(other.id);

	const firstChatId = await startConversation(first.client);
	const secondChatId = await startConversation(second.client);

	const listed = async (client: typeof first.client) =>
		(
			await client.assistant.list({
				pageIndex: 0,
				pageSize: 100,
			})
		).data.map((chat) => chat.id);
	expect(await listed(first.client)).toEqual([
		firstChatId,
	]);
	expect(await listed(second.client)).toEqual([
		secondChatId,
	]);

	expect(reasonOf(await turnRefusal(second.client, firstChatId))).toBe(
		"ASSISTANT_ORGANIZATION_MISMATCH",
	);

	// The API reads it by ownership from anywhere; only the route hides it.
	expect(
		(
			await second.client.chat.find({
				id: firstChatId,
			})
		).data.kind,
	).toBe("assistant");

	const context = await browser.newContext({
		storageState: second.session.storageState,
		locale: "en",
	});
	try {
		const page = await context.newPage();
		await enterApp(page, other.slug);
		await open(page, `/app/assistant/${firstChatId}`);
		await expect(
			page.getByText(message("boundaries_not_found_title")),
		).toBeVisible();
	} finally {
		await context.close();
	}
});

test("assistant: a conversation can only be renamed or deleted", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startConversation(member);
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Hello?",
			reply: "Hello.",
		},
	});
	const messages = await member.chatMessage.list({
		chatId,
		limit: 10,
	});
	const firstMessageId = messages.data[0]?.id;
	if (!firstMessageId) throw new Error("Missing stored message");

	const refused = async (call: Promise<unknown>) =>
		reasonOf(await rejection(call));

	expect(
		await refused(
			member.chat.update({
				id: chatId,
				config: {
					temperature: 0.2,
				},
			}),
		),
	).toBe("ASSISTANT_CONVERSATION_IMMUTABLE");
	expect(
		await refused(
			member.chat.branch({
				chatId,
				messageId: firstMessageId,
			}),
		),
	).toBe("ASSISTANT_CONVERSATION_IMMUTABLE");
	const blockId = randomUUID() as BlockId;
	expect(
		await refused(
			member.chatBlock.attach({
				chatId,
				blockId,
			}),
		),
	).toBe("ASSISTANT_CONVERSATION_IMMUTABLE");
	expect(
		await refused(
			member.chatBlock.detach({
				chatId,
				blockId,
			}),
		),
	).toBe("ASSISTANT_CONVERSATION_IMMUTABLE");
	expect(
		await refused(
			member.chatMessage.create({
				chatId,
				id: randomUUID() as ChatMessageId,
				role: "assistant",
				parts: [
					{
						type: "text",
						text: "A fabricated reply.",
					},
				],
				metadata: {},
			}),
		),
	).toBe("ASSISTANT_CONVERSATION_IMMUTABLE");

	const renamed = await member.chat.update({
		id: chatId,
		title: "Renamed conversation",
	});
	expect(renamed.data.title).toBe("Renamed conversation");
});
