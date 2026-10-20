import {
	chatName,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import {
	ask,
	completionBodies,
	createGenUiChat,
	toolResults,
	turnFinished,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, type JsonValue, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const CLOSING = "Two references need work.";
const TITLE = "References against APA 7";
const AUTHORS_NOTE = "Use a comma and an ampersand.";
const DOI_NOTE = "Write the DOI as a URL.";
const SHUTE_NOTE = "No DOI given.";

const MATRIX: JsonValue = {
	title: TITLE,
	columns: [
		{
			key: "authors",
			label: "Authors",
		},
		{
			key: "title",
			label: "Title",
		},
		{
			key: "doi",
			label: "DOI",
		},
	],
	rows: [
		{
			label: "Hattie & Timperley (2007)",
			cells: {
				authors: {
					status: "not_met",
					note: AUTHORS_NOTE,
				},
				title: {
					status: "met",
				},
				doi: {
					status: "partial",
					note: DOI_NOTE,
				},
			},
		},
		{
			label: "Black & Wiliam (1998)",
			cells: {
				authors: {
					status: "met",
				},
				title: {
					status: "met",
				},
				doi: {
					status: "met",
				},
			},
		},
		{
			label: "Shute (2008)",
			cells: {
				authors: {
					status: "met",
				},
				title: {
					status: "n_a",
				},
				doi: {
					status: "not_met",
					note: SHUTE_NOTE,
				},
			},
		},
	],
};

test("gen-ui: a matrix renders statuses with expandable notes", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(member, model, chatName("Matrix"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		{
			toolCalls: [
				{
					name: "showMatrix",
					input: MATRIX,
				},
			],
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Compare my references");
	await turnFinished(page);

	const log = page.getByRole("log");
	await expect(
		log.getByText(TITLE, {
			exact: true,
		}),
	).toBeVisible();
	for (const label of [
		"Authors",
		"Title",
		"DOI",
	]) {
		await expect(
			log.getByRole("columnheader", {
				name: label,
				exact: true,
			}),
		).toBeVisible();
	}

	const row = (label: string) =>
		log.getByRole("row").filter({
			hasText: label,
		});
	const icon = (status: string) => ({
		name: message(status),
		exact: true,
	});
	const hattie = row("Hattie & Timperley (2007)");
	await expect(
		hattie.getByRole("img", icon("gen_ui_status_not_met")),
	).toBeVisible();
	await expect(
		hattie.getByRole("img", icon("gen_ui_status_partial")),
	).toBeVisible();
	await expect(
		hattie.getByRole("img", icon("gen_ui_status_met")),
	).toBeVisible();
	await expect(
		row("Black & Wiliam (1998)").getByRole("img", icon("gen_ui_status_met")),
	).toHaveCount(3);
	await expect(
		row("Shute (2008)").getByRole("img", icon("gen_ui_status_n_a")),
	).toBeVisible();

	await expect(row("Black & Wiliam (1998)").getByRole("button")).toHaveCount(0);
	const hattieNotes = hattie.getByRole("button");
	const shuteNotes = row("Shute (2008)").getByRole("button");
	await expect(hattieNotes).toHaveAttribute("aria-expanded", "false");
	await expect(log.getByText(AUTHORS_NOTE)).toHaveCount(0);

	await hattieNotes.click();
	await shuteNotes.click();
	await expect(hattieNotes).toHaveAttribute("aria-expanded", "true");
	await expect(shuteNotes).toHaveAttribute("aria-expanded", "true");
	await expect(log.getByText(AUTHORS_NOTE)).toBeVisible();
	await expect(log.getByText(DOI_NOTE)).toBeVisible();
	await expect(log.getByText(SHUTE_NOTE)).toBeVisible();

	await page.reload();
	await expect(messageText(page, CLOSING)).toBeVisible();
	await expect(
		row("Shute (2008)").getByRole("img", icon("gen_ui_status_n_a")),
	).toBeVisible();
	await expect(
		row("Hattie & Timperley (2007)").getByRole("button"),
	).toHaveAttribute("aria-expanded", "false");

	expect(
		toolResults(completionBodies(inference)[1]).map(String).join(""),
	).toContain('{"shown":true}');
});
