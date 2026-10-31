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
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { enterApp } from "../../fixtures/navigation";
import {
	preparedReadiness,
	repositoryWithDocument,
} from "../../fixtures/pipeline/repository";

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
	// Quotes are escaped inside the JSON of the messages.
	const ref = /<passage ref=\\"(k[0-9a-z]{6})\\"/.exec(results)?.[1];

	if (!ref) {
		throw new Error("The model read no passage ref.");
	}

	return ref;
};

const citation = (page: Page, title: string) =>
	page.getByRole("log").getByRole("button", {
		name: title,
		exact: true,
	});

test("pipeline: a citation by chunk ref names the uploaded document, also after a reload", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Citations"));
	const repository = await repositoryWithDocument(member, {
		label: "Refund Policy",
		content: `# Refunds\n\n${CHUNK}\n`,
	});
	await member.chatBlock.attach({
		chatId,
		blockId: repository.blockId,
	});
	const readiness = await preparedReadiness(member, repository.blockId);
	expect(readiness.totals.ready).toBe(1);

	inference.script(
		{
			toolCalls: [
				{
					name: "searchRepositories",
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
	expect(JSON.stringify(completionRequests(inference).at(-1)?.body)).toContain(
		CHUNK,
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	inference.script({
		text: `Refunds are paid <cite chunk="${ref}">within 14 days</cite>.`,
	});
	await composer(page).fill("Cite it.");
	await composer(page).press("Enter");

	await expect(messageText(page, "within 14 days")).toBeVisible();
	await expect(citation(page, repository.asset.title)).toBeVisible();

	await page.reload();
	await expect(citation(page, repository.asset.title)).toBeVisible();
});
