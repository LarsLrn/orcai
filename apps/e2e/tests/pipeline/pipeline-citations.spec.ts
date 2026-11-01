import type { Page } from "@playwright/test";
import {
	ask,
	chatName,
	completionRequests,
	composer,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { createGenUiChat } from "../../fixtures/gen-ui/gen-ui";
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import {
	preparedReadiness,
	repositoryWithAsset,
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
	const ref = /<passage [^>]*?\bref=(k[0-9a-z]{6})\b/.exec(results)?.[1];

	if (!ref) {
		throw new Error("The model read no passage ref.");
	}

	return ref;
};

const citation = (page: Page, title: string) =>
	page.getByRole("log").getByRole("button", {
		name: message("ai_elements_cite_asset_aria_label", {
			label: title,
		}),
		exact: true,
	});

test("pipeline: a citation by ref names the uploaded asset, also after a reload", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(member, model, chatName("Citations"));
	const repository = await repositoryWithAsset(member, {
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
	// A follow-up cites the earlier search's ref, in its text and in a display field.
	inference.script(
		{
			text: `Refunds are paid <cite ref=${ref}>within 14 days</cite>.`,
			toolCalls: [
				{
					name: "showChecklist",
					input: {
						title: "Refund check",
						items: [
							{
								label: "Deadline",
								status: "met",
								summary: "Paid in time.",
								body: `Paid <cite ref=${ref}>within two weeks</cite>.`,
							},
						],
					},
				},
			],
		},
		{
			text: "That is the rule.",
		},
	);
	await composer(page).fill("Cite it.");
	await composer(page).press("Enter");

	const citations = citation(page, repository.asset.title);
	const expanded = async () => {
		await expect(messageText(page, "within 14 days")).toBeVisible();
		await page
			.getByRole("log")
			.getByRole("button", {
				name: /Deadline/,
			})
			.click();
		await expect(
			page.getByRole("log").getByText("within two weeks"),
		).toBeVisible();
		await expect(citations).toHaveCount(2);
	};
	await expanded();

	await page.reload();
	await expanded();

	// The card opens the asset in the app, which asks nothing.
	await citations.first().click();
	await expect(
		page.getByRole("link", {
			name: message("ai_elements_cite_open_asset_action"),
		}),
	).toHaveAttribute("href", /\/app\/library\/assets\//);
});
