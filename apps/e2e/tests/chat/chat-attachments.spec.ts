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
