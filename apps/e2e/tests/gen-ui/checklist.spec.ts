import {
	attachRepository,
	chatName,
	messageText,
	openChat,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import {
	ask,
	completionBodies,
	createGenUiChat,
	historyToolCalls,
	offeredTools,
	toolResults,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, type JsonValue, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const INTRO = "I checked the reference list against the guide.";
const CLOSING = "Fix the two flagged items before you submit.";
const TITLE = "Reference list check";
const DESCRIPTION = "Four rules from the style guide.";
const QUOTE = "Smith, J. 2020. Learning outcomes.";
const BODY_TEXT = "The guide puts the year in parentheses";

const CHECKLIST: JsonValue = {
	title: TITLE,
	description: DESCRIPTION,
	items: [
		{
			label: "Author names",
			status: "met",
			summary: "Surnames and initials are complete.",
		},
		{
			label: "Publication year",
			status: "partial",
			summary: "One year lacks parentheses.",
			// No source in this chat issued the ref, so the cite shows as its text.
			body: `${BODY_TEXT} <cite ref=kgol9ts>after the author</cite>.`,
			quote: QUOTE,
		},
		{
			label: "Italic titles",
			status: "not_met",
			summary: "Journal names are not italic.",
		},
		{
			label: "DOI format",
			status: "n_a",
			summary: "No DOIs are given.",
		},
	],
};

test("gen-ui: a checklist renders in the answer between the turn's text", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(member, model, chatName("Checklist"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		{
			text: INTRO,
			toolCalls: [
				{
					name: "showChecklist",
					input: CHECKLIST,
				},
			],
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Check my references");
	await turnFinished(page);

	const log = page.getByRole("log");
	const title = log.getByText(TITLE, {
		exact: true,
	});
	// A union matches in document order, which the log's scrolling cannot change.
	await expect(
		messageText(page, INTRO).or(title).or(messageText(page, CLOSING)),
	).toHaveText([
		INTRO,
		TITLE,
		CLOSING,
	]);
	await expect(log.getByText(DESCRIPTION)).toBeVisible();

	const icon = (status: string) =>
		log.getByRole("img", {
			name: message(status),
			exact: true,
		});
	// One icon per row; the header tally repeats every status but n_a.
	for (const [status, label] of [
		[
			"gen_ui_status_met",
			"Author names",
		],
		[
			"gen_ui_status_partial",
			"Publication year",
		],
		[
			"gen_ui_status_not_met",
			"Italic titles",
		],
		[
			"gen_ui_status_n_a",
			"DOI format",
		],
	]) {
		await expect(
			log
				.getByRole("listitem")
				.filter({
					hasText: label,
				})
				.getByRole("img", {
					name: message(status),
					exact: true,
				}),
		).toBeVisible();
		await expect(icon(status)).toHaveCount(
			status === "gen_ui_status_n_a" ? 1 : 2,
		);
	}
	await expect(
		log.getByText(message("gen_ui_status_partial"), {
			exact: true,
		}),
	).toBeVisible();

	const yearRow = log.getByRole("button", {
		name: /Publication year/,
	});
	await expect(yearRow).toBeEnabled();
	await expect(
		log.getByRole("button", {
			name: /Author names/,
		}),
	).toBeDisabled();

	await yearRow.click();
	await expect(log.getByText(QUOTE)).toBeVisible();
	await expect(log.getByText(BODY_TEXT)).toBeVisible();
	await expect(log.getByText("after the author")).toBeVisible();
	await expect(
		log.getByRole("button", {
			name: message("ai_elements_cite_asset_aria_label", {
				label: "",
			}).trim(),
		}),
	).toHaveCount(0);

	await page.reload();
	await expect(title).toBeVisible();
	await expect(messageText(page, CLOSING)).toBeVisible();

	const [first, second] = completionBodies(inference);
	expect(offeredTools(first)).toContain("showChecklist");
	expect(toolResults(second).map(String).join("")).toContain('{"shown":true}');

	await openChat(page, chatId);
	await ask(page, "Thanks");
	await turnFinished(page);
	expect(historyToolCalls(completionBodies(inference).at(-1))).toContain(
		"showChecklist",
	);
});

test("gen-ui: a running turn shows its activity below the answer", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(member, model, chatName("Activity"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		{
			text: INTRO,
			toolCalls: [
				{
					name: "showChecklist",
					input: CHECKLIST,
				},
			],
			hold: "end",
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Check my references");

	const log = page.getByRole("log");
	const working = message("chat_work_log_working");
	const activity = log.getByText(working, {
		exact: true,
	});
	// The line itself and its live region for screen readers.
	await expect(activity).toHaveCount(2);
	await expect(
		log.getByRole("status").filter({
			hasText: working,
		}),
	).toHaveText(working);

	inference.release();
	await turnFinished(page);
	await expect(messageText(page, CLOSING)).toBeVisible();
	await expect(activity).toHaveCount(0);
});

test("gen-ui: a running turn shows its activity below a checklist while the work log is in view", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(
		member,
		model,
		chatName("Activity Below"),
	);
	await attachRepository(member, chatId);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		{
			toolCalls: [
				{
					name: "searchRepositories",
					input: {
						query: "reference style",
					},
				},
			],
		},
		{
			toolCalls: [
				{
					name: "showChecklist",
					input: CHECKLIST,
				},
			],
			hold: "end",
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Check my references");

	const log = page.getByRole("log");
	await expect(
		log.getByText(TITLE, {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		log.getByRole("button", {
			name: /^1 step/,
		}),
	).toBeInViewport();
	await expect(
		log.getByRole("button", {
			name: message("chat_work_log_working"),
			exact: true,
		}),
	).toBeVisible();

	inference.release();
	await turnFinished(page);
	await expect(messageText(page, CLOSING)).toBeVisible();
});
