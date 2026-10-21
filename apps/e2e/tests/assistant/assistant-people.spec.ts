import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import {
	actStep,
	cancelButton,
	cardButton,
	confirmationCard,
	lastRow,
	loadTools,
	toolParts,
} from "../../fixtures/assistant/approval";
import {
	openConversation,
	quoted,
	setUpAssistantModel,
	startTitledConversation,
} from "../../fixtures/assistant/assistant";
import { messageText, turnFinished } from "../../fixtures/chat/chat";
import { baseURL } from "../../fixtures/env";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import { groupsName } from "../../fixtures/groups/groups";
import type { ApiClient } from "../../fixtures/index";
import {
	expect,
	type ScriptedToolCall,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import {
	INVITED_NOTIFICATION,
	invitationEmail,
} from "../../fixtures/orgs/invitations";
import { memberRole } from "../../fixtures/orgs/members";
import { addMember, createThrowawayUser } from "../../fixtures/users/users";

const DONE = "That is done.";

/**
 * Ask for the scripted call on the page, answer its card with the verb and
 * wait for the closing reply.
 */
const confirmThroughCard = async (params: {
	page: Page;
	client: ApiClient;
	chatId: ChatId;
	call: ScriptedToolCall;
	title: string;
	verb: string;
}): Promise<void> => {
	const { page, client, chatId, call, title, verb } = params;

	await openConversation(page, chatId);
	await ask(page, "Please take care of it");
	const card = confirmationCard(page, title);
	await expect(card).toBeVisible();
	await expect(cancelButton(card)).toBeVisible();
	await cardButton(card, verb).click();
	await expect(messageText(page, DONE)).toBeVisible();
	await turnFinished(page);

	const [part] = toolParts(await lastRow(client, chatId), call.name);
	expect(part?.errorText).toBeUndefined();
	expect(part?.state).toBe("output-available");
};

test("assistant: a manager invites people through the card and the outbox holds the invitation", async ({
	api,
	inference,
	org,
	outbox,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const manager = api.as("manager");
	const email = invitationEmail("assistant");
	const chatId = await startTitledConversation(manager, inference);
	const call = {
		name: "inviteMembers",
		input: {
			emails: [
				email,
			],
			role: "member",
		},
	};
	inference.script(
		loadTools("people"),
		actStep("I will send the invitation.", call),
		{
			text: DONE,
		},
	);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await confirmThroughCard({
		page,
		client: manager,
		chatId,
		call,
		title: message("assistant_tool_invite_members_summary", {
			names: quoted(email),
			role: message("orgs_role_member_label"),
		}),
		verb: message("assistant_confirmation_invite"),
	});

	await expect
		.poll(
			async () => (await outbox.latestFor(email, INVITED_NOTIFICATION))?.type,
		)
		.toBe(INVITED_NOTIFICATION);
});

test("assistant: a manager changes a member's role through the card", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const manager = api.as("manager");
	const user = await createThrowawayUser(baseURL(), "assistant-role");
	await addMember(api, org, user, "member", zedTokens);
	const chatId = await startTitledConversation(manager, inference);
	const call = {
		name: "changeMemberRole",
		input: {
			userId: user.id,
			role: "viewer",
		},
	};
	inference.script(
		loadTools("people"),
		actStep("I will change the role.", call),
		{
			text: DONE,
		},
	);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await confirmThroughCard({
		page,
		client: manager,
		chatId,
		call,
		title: message("assistant_tool_change_member_role_summary", {
			name: quoted(user.name),
			role: message("orgs_role_viewer_label"),
		}),
		verb: message("assistant_confirmation_change"),
	});

	await expect
		.poll(() =>
			memberRole(api.as("admin"), {
				userId: user.id,
			}),
		)
		.toBe("viewer");
});

test("assistant: a manager adds a member to a group through the card", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const manager = api.as("manager");
	const user = await createThrowawayUser(baseURL(), "assistant-group");
	await addMember(api, org, user, "member", zedTokens);
	const groupName = groupsName("Assistant");
	const group = await manager.group.create({
		name: groupName,
	});
	const chatId = await startTitledConversation(manager, inference);
	const call = {
		name: "addGroupMembers",
		input: {
			groupId: group.data.id,
			userIds: [
				user.id,
			],
		},
	};
	inference.script(
		loadTools("people"),
		actStep("I will add them to the group.", call),
		{
			text: DONE,
		},
	);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await confirmThroughCard({
		page,
		client: manager,
		chatId,
		call,
		title: message("assistant_tool_add_group_members_summary", {
			names: quoted(user.name),
			group: quoted(groupName),
		}),
		verb: message("common_add_button"),
	});

	await expect
		.poll(async () =>
			(
				await manager.group.listMembers({
					groupId: group.data.id,
					pageIndex: 0,
					pageSize: 100,
				})
			).data.map((member) => member.user.id),
		)
		.toContain(user.id);
});
