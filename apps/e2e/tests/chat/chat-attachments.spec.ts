import type { Page } from "@playwright/test";
import { adoptPageZedToken } from "../../fixtures/authz/resources";
import {
	chatName,
	composer,
	createChat,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

// A 1x1 PNG.
const PIXEL = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

for (const file of [
	{
		kind: "text",
		name: "trip-notes.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("The field trip leaves at eight from the north gate."),
		fileType: "txt",
		modelReads: "The field trip leaves at eight from the north gate.",
	},
	{
		kind: "image",
		name: "pixel.png",
		mimeType: "image/png",
		buffer: PIXEL,
		fileType: "png",
		modelReads: `data:image/png;base64,${PIXEL.toString("base64")}`,
	},
] as const) {
	test(`chat: an uploaded ${file.kind} attachment is a chat-origin asset the model reads`, async ({
		api,
		inference,
		org,
		pageAs,
		zedTokens,
	}) => {
		const model = await setUpChatModel(api, inference);
		const member = api.as("member");
		const chatId = await createChat(
			member,
			model,
			chatName(`Attachment ${file.kind}`),
		);
		await sendTurn({
			client: member,
			inference,
			chatId,
			turn: {
				question: "I will send you a file.",
				reply: "Send it over.",
			},
		});

		const page = await pageAs("member");
		await enterApp(page, org.slug);
		await openChat(page, chatId);
		await page.locator('input[type="file"]').setInputFiles({
			name: file.name,
			mimeType: file.mimeType,
			buffer: file.buffer,
		});
		inference.respondWith({
			text: `Got ${file.name}.`,
		});
		await composer(page).fill("Here it is.");
		await page
			.getByRole("button", {
				name: message("ai_elements_prompt_input_submit_aria_label"),
			})
			.click();

		const sentAttachments = async () => {
			const rows = await member.chatMessage.list({
				chatId,
				limit: 100,
			});
			return rows.data.filter((row) => row.role === "user").at(-1)?.attachments;
		};
		await expect.poll(sentAttachments).toMatchObject([
			{
				title: file.name,
				fileType: file.mimeType,
			},
		]);
		await expect
			.poll(() =>
				inference.requests.some(
					(request) =>
						request.path === "/v1/chat/completions" &&
						JSON.stringify(request.body).includes(file.modelReads),
				),
			)
			.toBe(true);
		const [attachment] = (await sentAttachments()) ?? [];
		if (!attachment) throw new Error("The message has no attachment");

		await adoptPageZedToken(page, zedTokens);
		const asset = await member.asset.find({
			id: attachment.assetId,
		});
		expect(asset.data).toMatchObject({
			title: file.name,
			fileType: file.fileType,
			origin: "chat",
		});
	});
}

type DroppedFile = {
	name: string;
	type: string;
	text: string;
};

/** Files as a drag would carry them, for dispatching drag events. */
const dataTransfer = (page: Page, files: DroppedFile[]) =>
	page.evaluateHandle((entries) => {
		const browser = globalThis as unknown as {
			DataTransfer: new () => {
				items: {
					add: (file: File) => void;
				};
			};
		};
		const transfer = new browser.DataTransfer();
		for (const { name, type, text } of entries) {
			transfer.items.add(
				new File(
					[
						text,
					],
					name,
					{
						type,
					},
				),
			);
		}
		return transfer;
	}, files);

test("chat: files dropped on the composer are attached with the upload button's file types", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Attachment drop"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	const files = await dataTransfer(page, [
		{
			name: "dropped-notes.txt",
			type: "text/plain",
			text: "The field trip leaves at eight.",
		},
		{
			name: "setup.exe",
			type: "application/x-msdownload",
			text: "MZ",
		},
	]);
	await composer(page).dispatchEvent("dragenter", {
		dataTransfer: files,
	});
	await expect(
		page.getByText(message("chat_composer_drop_label")),
	).toBeVisible();
	await composer(page).dispatchEvent("drop", {
		dataTransfer: files,
	});

	await expect(page.getByText(message("chat_composer_drop_label"))).toHaveCount(
		0,
	);
	const refused = page.getByRole("listitem").filter({
		hasText: message("chat_attachments_rejected_toast_error", {
			name: "setup.exe",
		}),
	});
	await expect(refused).toBeVisible();
	// The toast covers Submit, and a pointer resting on it keeps it open.
	await refused
		.getByRole("button", {
			name: message("toast_close_button_label"),
		})
		.click();
	await expect(refused).toHaveCount(0);
	inference.respondWith({
		text: "Got the notes.",
	});
	await composer(page).fill("Here it is.");
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
		})
		.click();

	await expect
		.poll(async () => {
			const rows = await member.chatMessage.list({
				chatId,
				limit: 100,
			});
			return rows.data.filter((row) => row.role === "user").at(-1)?.attachments;
		})
		.toMatchObject([
			{
				title: "dropped-notes.txt",
				fileType: "text/plain",
			},
		]);
});

test("chat: the composer takes no drop while an attachment uploads", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Attachment busy"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await composer(page).dispatchEvent("drop", {
		dataTransfer: await dataTransfer(page, [
			{
				name: "first.txt",
				type: "text/plain",
				text: "First.",
			},
		]),
	});
	await expect(page.getByText("first.txt")).toBeVisible();

	// Hold the upload, so the composer stays busy while the second file is dropped.
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/asset/createFromUploads**", async (route) => {
		await held;
		await route.continue();
	});
	inference.respondWith({
		text: "Got it.",
	});
	await composer(page).fill("Here it is.");
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
		})
		.click();
	await expect(
		page.getByRole("button", {
			name: message("chat_attachment_menu_trigger"),
		}),
	).toBeDisabled();

	const second = await dataTransfer(page, [
		{
			name: "second.txt",
			type: "text/plain",
			text: "Second.",
		},
	]);
	await composer(page).dispatchEvent("dragenter", {
		dataTransfer: second,
	});
	await expect(page.getByText(message("chat_composer_drop_label"))).toHaveCount(
		0,
	);
	await composer(page).dispatchEvent("drop", {
		dataTransfer: second,
	});
	await expect(page.getByText("second.txt")).toHaveCount(0);
	release();

	await expect
		.poll(async () => {
			const rows = await member.chatMessage.list({
				chatId,
				limit: 100,
			});
			return rows.data.filter((row) => row.role === "user").at(-1)?.attachments;
		})
		.toMatchObject([
			{
				title: "first.txt",
			},
		]);
});
