import type { AssetId, ChatId } from "@orcai/core";
import type { ApiClient } from "../../fixtures/api";
import { holdUploads } from "../../fixtures/assets";
import {
	actStep,
	continueRefusal,
	continueTurn,
	countContinuations,
	lastRow,
	loadTools,
	openWorkLogEntry,
	pauseTurn,
	toolParts,
} from "../../fixtures/assistant/approval";
import {
	isRecord,
	offeredToolsOf,
	openConversation,
	pluralMessage,
	reasonOf,
	setUpAssistantModel,
	startTitledConversation,
	toolMessages,
	toolResultsOf,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import {
	continueButton,
	discardPrompt,
	requestUploadCall,
	uploadRow,
	uploadTextFiles,
	uploadWidget,
} from "../../fixtures/assistant/upload";
import { adoptPageZedToken } from "../../fixtures/authz/resources";
import { chatName, messageText, turnFinished } from "../../fixtures/chat/chat";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp } from "../../fixtures/navigation";

const LEAD_IN = "Upload the files here.";
const REASON = "Upload the style guides for the repository 'APA rules'";
const SKIPPED_SENTENCE = "Not run: the user sent a new message instead.";

/** What the conversation's waiting upload lists, as kept with its reply. */
const keptAssets = async (client: ApiClient, chatId: ChatId) => {
	const page = await client.chatMessage.list({
		chatId,
		limit: 100,
	});
	return Object.values(page.data.at(-1)?.metadata.uploads ?? {}).flatMap(
		(kept) => kept.assets,
	);
};

const keptTitles = async (client: ApiClient, chatId: ChatId) =>
	(await keptAssets(client, chatId)).map((asset) => asset.title).sort();

test("assistant: requestUpload lists uploads until Continue, keeps them over a reload and answers with what is left", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "Your style guide is saved.";
	const fileName = `${chatName("Style guide")}.txt`;
	const removedName = `${chatName("Old draft")}.txt`;
	inference.script(
		loadTools("bots"),
		actStep(LEAD_IN, requestUploadCall(REASON)),
		{
			text: done,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	const continuations = countContinuations(page);
	await ask(page, "Add my style guide");

	const widget = uploadWidget(page);
	await expect(widget).toBeVisible();
	await expect(messageText(page, LEAD_IN)).toBeVisible();
	await expect(
		widget.getByText(REASON, {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		widget.getByText(message("chat_work_log_tool_status_awaiting_input"), {
			exact: true,
		}),
	).toBeVisible();

	await uploadTextFiles(widget, [
		fileName,
		removedName,
	]);
	await expect(continueButton(widget)).toBeVisible();
	await expect
		.poll(() => keptTitles(member, chatId))
		.toEqual(
			[
				fileName,
				removedName,
			].sort(),
		);
	const removedId = (await keptAssets(member, chatId)).find(
		(asset) => asset.title === removedName,
	)?.id;

	await uploadRow(widget, removedName, fileName)
		.getByRole("button", {
			name: message("common_remove_button"),
			exact: true,
		})
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", {
			name: pluralMessage("assets_delete_confirm_button", {
				count: 1,
			}),
		})
		.click();
	await expect(
		widget.getByText(removedName, {
			exact: true,
		}),
	).toHaveCount(0);
	await expect
		.poll(() => keptTitles(member, chatId))
		.toEqual([
			fileName,
		]);
	expect(continuations()).toBe(0);

	await page.reload();
	await awaitHydration(page);
	await expect(
		widget.getByText(fileName, {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		widget.getByText(removedName, {
			exact: true,
		}),
	).toHaveCount(0);

	await continueButton(widget).click();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	expect(continuations()).toBe(1);

	const requests = turnRequests(inference);
	expect(requests).toHaveLength(3);
	expect(offeredToolsOf(requests[0])).not.toContain("requestUpload");
	expect(offeredToolsOf(requests[1])).toContain("requestUpload");
	const result = toolMessages(requests[2]).at(-1);
	expect(result).toMatchObject({
		status: "saved",
		attached: false,
		assets: [
			{
				title: fileName,
			},
		],
		next: "Attach them to a repository with createRepository or updateRepository.",
	});
	const assets =
		isRecord(result) && Array.isArray(result.assets) ? result.assets : [];
	expect(assets).toHaveLength(1);
	const assetId = (
		assets[0] as {
			id: AssetId;
		}
	).id;
	await adoptPageZedToken(page, zedTokens);
	const asset = await member.asset.find({
		id: assetId,
	});
	expect(asset.data).toMatchObject({
		title: fileName,
		keptIn: "library",
	});
	expect(
		(
			await member.asset.list({
				filters: {
					ids: [
						removedId as AssetId,
					],
				},
			})
		).data,
	).toEqual([]);

	const reply = await lastRow(member, chatId);
	expect(toolParts(reply, "requestUpload")).toMatchObject([
		{
			state: "output-available",
			output: {
				status: "saved",
				assets: [
					{
						id: assetId,
						title: fileName,
					},
				],
			},
		},
	]);
	expect(await keptAssets(member, chatId)).toEqual([]);

	const line = pluralMessage("assistant_tool_request_upload_summary_saved", {
		count: 1,
	});
	await expect(widget).toHaveCount(0);
	const entry = await openWorkLogEntry(page, line);
	await expect(
		entry.getByText(fileName, {
			exact: true,
		}),
	).toBeVisible();

	await page.reload();
	await awaitHydration(page);
	const stored = await openWorkLogEntry(page, line);
	await expect(
		stored.getByText(fileName, {
			exact: true,
		}),
	).toBeVisible();
	await stored
		.getByRole("button", {
			name: message("assistant_tool_request_upload_edit_metadata_label", {
				title: fileName,
			}),
		})
		.click();
	const metadata = page.getByRole("dialog", {
		name: message("assets_selected_list_dialog_title"),
	});
	await expect(
		metadata.getByLabel(message("assets_metadata_source_title_label")),
	).toHaveValue(fileName);
});

test("assistant: Cancel after an upload answers cancelled and keeps the file in the Library", async ({
	api,
	inference,
	org,
	pageAs,
	zedTokens,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "Kept in the Library, then.";
	const fileName = `${chatName("Kept")}.txt`;
	inference.script(
		loadTools("bots"),
		actStep(LEAD_IN, requestUploadCall(REASON)),
		{
			text: done,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Add my style guide");

	const widget = uploadWidget(page);
	await uploadTextFiles(widget, [
		fileName,
	]);
	await expect(continueButton(widget)).toBeVisible();
	await widget
		.getByRole("button", {
			name: message("common_cancel_button"),
			exact: true,
		})
		.click();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);

	expect(toolMessages(turnRequests(inference)[2]).at(-1)).toEqual({
		status: "cancelled",
	});
	await adoptPageZedToken(page, zedTokens);
	const library = await member.asset.list({
		filters: {
			search: fileName,
		},
	});
	expect(library.data.map((asset) => asset.title)).toEqual([
		fileName,
	]);
});

test("assistant: Cancel during an upload asks, aborts it and reports cancelled", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "No files, then.";
	inference.script(
		loadTools("bots"),
		actStep(LEAD_IN, requestUploadCall(REASON)),
		{
			text: done,
		},
	);
	const assetCount = async () => (await member.asset.list({})).rowCount;
	const assetsBefore = await assetCount();

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Add my style guide");

	const widget = uploadWidget(page);
	const uploads = await holdUploads(page);
	await uploadTextFiles(widget, [
		`${chatName("Discarded")}.txt`,
	]);
	const cancel = widget.getByRole("button", {
		name: message("common_cancel_button"),
		exact: true,
	});

	await cancel.click();
	await discardPrompt(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_stay_button"),
		})
		.click();
	await expect(discardPrompt(page)).toHaveCount(0);
	await expect(cancel).toBeVisible();

	await cancel.click();
	await discardPrompt(page)
		.getByRole("button", {
			name: message("common_unsaved_changes_discard_button"),
		})
		.click();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	uploads.release();

	const reply = await lastRow(member, chatId);
	expect(toolParts(reply, "requestUpload")).toMatchObject([
		{
			state: "output-available",
			output: {
				status: "cancelled",
			},
		},
	]);
	expect(toolMessages(turnRequests(inference)[2]).at(-1)).toEqual({
		status: "cancelled",
	});
	expect(await assetCount()).toBe(assetsBefore);
	await openWorkLogEntry(
		page,
		message("assistant_tool_request_upload_summary_cancelled"),
	);
});

test("assistant: a new message instead of an upload skips the widget", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "Something else, then.";
	inference.script(
		loadTools("bots"),
		actStep(LEAD_IN, requestUploadCall(REASON)),
		{
			text: done,
		},
	);
	const assetCount = async () => (await member.asset.list({})).rowCount;
	const assetsBefore = await assetCount();

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	const continuations = countContinuations(page);
	await ask(page, "Add my style guide");

	const widget = uploadWidget(page);
	await expect(widget).toBeVisible();
	await ask(page, "Never mind, what can you do?");
	await expect(widget).toHaveCount(0);
	const entry = await openWorkLogEntry(
		page,
		message("assistant_tool_request_upload_name"),
	);
	await expect(
		entry.getByText(message("chat_work_log_tool_status_skipped"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	expect(continuations()).toBe(0);

	const requests = turnRequests(inference);
	expect(requests).toHaveLength(3);
	expect(toolResultsOf(requests[2]).at(-1)).toContain(SKIPPED_SENTENCE);
	expect(await assetCount()).toBe(assetsBefore);

	await page.reload();
	await awaitHydration(page);
	const stored = await openWorkLogEntry(
		page,
		message("assistant_tool_request_upload_name"),
	);
	await expect(
		stored.getByText(message("chat_work_log_tool_status_skipped"), {
			exact: true,
		}),
	).toBeVisible();
});

test("assistant: ai.continue validates client tool outputs and persists nothing it rejects", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "Cancelled, then.";
	inference.script(
		loadTools("bots"),
		actStep(LEAD_IN, requestUploadCall(REASON)),
		{
			text: done,
		},
	);

	const paused = await pauseTurn(member, chatId, "Add my style guide");
	const [upload] = toolParts(paused, "requestUpload");
	const [search] = toolParts(paused, "loadTools");
	const uploadCallId = upload?.toolCallId;
	const searchCallId = search?.toolCallId;
	if (upload?.state !== "input-available" || !uploadCallId || !searchCallId) {
		throw new Error("The reply is not waiting for the upload");
	}
	const turn = {
		chatId,
		messageId: paused.id,
		approvals: [],
	};

	for (const output of [
		{
			status: "saved",
			assets: [],
		},
		{
			status: "saved",
			assets: [
				{
					id: "not-an-asset-id",
					title: "Forged",
				},
			],
		},
	]) {
		const forged = await continueRefusal(member, {
			...turn,
			toolOutputs: [
				{
					toolCallId: uploadCallId,
					output,
				},
			],
		});
		expect(reasonOf(forged)).toBe("CHAT_TOOL_OUTPUT_INVALID");
	}

	const serverCall = await continueRefusal(member, {
		...turn,
		toolOutputs: [
			{
				toolCallId: searchCallId,
				output: {
					tools: [],
				},
			},
		],
	});
	expect(reasonOf(serverCall)).toBe("CHAT_TURN_NOT_AWAITING");

	const partial = await continueRefusal(member, turn);
	expect(reasonOf(partial)).toBe("CHAT_TURN_DECISIONS_INCOMPLETE");

	expect((await lastRow(member, chatId)).parts).toEqual(paused.parts);

	expect(
		await continueTurn(member, {
			...turn,
			toolOutputs: [
				{
					toolCallId: uploadCallId,
					output: {
						status: "cancelled",
					},
				},
			],
		}),
	).toBe(done);
	expect(
		toolParts(await lastRow(member, chatId), "requestUpload"),
	).toMatchObject([
		{
			state: "output-available",
			output: {
				status: "cancelled",
			},
		},
	]);
});
