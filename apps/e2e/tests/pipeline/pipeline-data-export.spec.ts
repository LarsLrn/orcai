import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { uploadAsset } from "../../fixtures/assets";
import { pageForSession } from "../../fixtures/auth/users";
import {
	chatName,
	createChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { pipelineName } from "../../fixtures/pipeline/repository";

const NOTES = "# Field notes\n\nSoil samples from the north plot.\n";

test("pipeline: a user exports their data from the account page and downloads the archive", async ({
	api,
	appBaseURL,
	browser,
	inference,
	outbox,
}) => {
	const model = await setUpChatModel(api, inference);
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "export",
		admin: api.as("admin"),
	});
	const title = chatName("Export");
	const chatId = await createChat(user.api, model, title);
	await sendTurn({
		client: user.api,
		inference,
		chatId,
		turn: {
			question: "How deep do I sample?",
			reply: "Thirty centimetres.",
		},
	});
	const asset = await uploadAsset(user.api, pipelineName("Notes"), {
		content: NOTES,
		type: "text/markdown",
	});

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page, "data");
		const card = accountCard(page, message("account_data_export_card_title"));
		await card
			.getByRole("button", {
				name: message("account_data_export_request_button"),
			})
			.click();
		await expect(
			card.getByText(message("account_data_export_status_pending")),
		).toBeVisible();

		// The app picks the job up once the workers have created its queue.
		const download = card.getByRole("link", {
			name: message("account_data_export_download_button"),
		});
		await expect(download).toBeVisible({
			timeout: 60_000,
		});

		const [file] = await Promise.all([
			page.waitForEvent("download"),
			download.click(),
		]);
		expect(file.suggestedFilename()).toMatch(
			/^orcai-data-export-\d{4}-\d{2}-\d{2}\.zip$/,
		);
		const archive = unzipSync(await readFile(await file.path()));
		const entry = (name: string) =>
			strFromU8(archive[name] ?? new Uint8Array());

		expect(JSON.parse(entry("profile.json")).email).toBe(user.email);
		const transcript = Object.keys(archive).find(
			(name) => name.startsWith(`chats/${title}`) && name.endsWith(".md"),
		);
		expect(entry(transcript ?? "")).toBe(
			"**User:**\n\nHow deep do I sample?\n\n**Assistant:**\n\nThirty centimetres.",
		);
		const upload = Object.keys(archive).find((name) =>
			name.startsWith(`files/${asset.id}/`),
		);
		expect(entry(upload ?? "")).toBe(NOTES);

		// The workers send it at once, which clears its payload.
		expect(
			await outbox.latestFor(user.email, "data-export.ready"),
		).toBeDefined();
	} finally {
		await context.close();
	}
});
