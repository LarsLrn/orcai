import type { Page } from "@playwright/test";
import {
	ask,
	chatName,
	completionRequests,
	composer,
	createChat,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { repositoryWithChunk } from "../../fixtures/chat/knowledge-base";
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const QUERY = "refund deadline";
const CHUNK = "Refunds are paid within 14 days of the request being approved.";

/** The ref the model read in the search result of the latest tool step. */
const refFromSearch = (inference: InferenceMock) => {
	const body = completionRequests(inference).at(-1)?.body as {
		messages: {
			role: string;
			content: unknown;
		}[];
	};
	const results = JSON.stringify(
		body.messages.filter(({ role }) => role === "tool"),
	);
	const ref = /\[(k[0-9a-z]{6})\]/.exec(results)?.[1];

	if (!ref) {
		throw new Error("The model read no passage ref.");
	}

	return ref;
};

const citation = (page: Page, title: string) =>
	page.getByRole("log").getByRole("button", {
		name: message("ai_elements_cite_pill_label_with_page", {
			title,
			page: 4,
		}),
	});

test("a citation by chunk ref names its source, also after a reload", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});
	const chatId = await createChat(member, model, chatName("Citations"));
	const repository = await repositoryWithChunk({
		client: member,
		inference,
		chatId,
		query: QUERY,
		text: CHUNK,
		page: 4,
	});

	try {
		inference.script(
			{
				toolCalls: [
					{
						name: "searchKnowledgeBase",
						input: {
							query: QUERY,
						},
					},
				],
			},
			{
				text: "I found the refund rules.",
			},
		);
		await ask(member, chatId, "How fast are refunds paid?");
		const ref = refFromSearch(inference);
		expect(
			JSON.stringify(completionRequests(inference).at(-1)?.body),
		).toContain(CHUNK);

		const page = await pageAs("member");
		await enterApp(page, org.slug);
		await openChat(page, chatId);
		inference.script({
			text: `Refunds are paid <cite chunk="${ref}">within 14 days</cite>.`,
		});
		await composer(page).fill("Cite it.");
		await composer(page).press("Enter");

		await expect(messageText(page, "within 14 days")).toBeVisible();
		await expect(citation(page, repository.title)).toBeVisible();

		await page.reload();
		await expect(citation(page, repository.title)).toBeVisible();
	} finally {
		await repository.remove();
	}
});
