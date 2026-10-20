import type { AssetId } from "@orcai/core";
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
	discardPrompt,
	requestUploadCall,
	saveOntoAsset,
	saveUploadedFiles,
	uploadTextFile,
	uploadWidget,
} from "../../fixtures/assistant/upload";
import { assetRow } from "../../fixtures/authz/resources";
import { chatName, messageText } from "../../fixtures/chat/chat";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp } from "../../fixtures/navigation";

const LEAD_IN = "Upload the files here.";
const REASON = "Upload the style guides for the repository 'APA rules'";
const SKIPPED_SENTENCE = "Not run: the user sent a new message instead.";

test("assistant: requestUpload saves the uploaded files and continues the same reply", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "Your style guide is saved.";
	const fileName = `${chatName("Style guide")}.txt`;
	inference.script(
		loadTools("bots"),
		actStep(LEAD_IN, requestUploadCall(REASON)),
		{
			text: done,
		},
	);

	const row = await member.asset.create(assetRow(chatName("Placeholder")));

	const page = await pageAs("member");
	await saveOntoAsset(page, row.data.id);
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
	expect(continuations()).toBe(0);

	await uploadTextFile(widget, fileName);
	await saveUploadedFiles(widget);
	await expect(messageText(page, done)).toBeVisible();
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
	const assetId = (
		assets[0] as {
			id: AssetId;
		}
	).id;
	expect(assetId).toBe(row.data.id);
	const asset = await member.asset.find({
		id: assetId,
	});
	expect(asset.data.title).toBe(fileName);

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
});

test("assistant: Cancel on the upload widget asks before discarding uploads and reports cancelled", async ({
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
	await uploadTextFile(widget, `${chatName("Discarded")}.txt`);
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
