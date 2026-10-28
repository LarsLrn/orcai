import type { Page } from "@playwright/test";
import {
	attachRepository,
	type ChatModel,
	chatName,
	completionRequests,
	composer,
	createChat,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import {
	expect,
	type InferenceMock,
	test,
} from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

/** The chat agent's step budget. */
const STEP_LIMIT = 25;
const FINAL_STEP_NOTE =
	"This is the last step of this turn: no more tools can run. Answer the user now from what you have so far, and say briefly what you could not finish.";
/** A turn of 25 model calls and searches outlasts the default expect timeout on a loaded machine. */
const FULL_TURN = {
	timeout: 20_000,
};
const QUESTION = "Check every citation.";
const ANSWER = "I checked 24 citations; the rest are still open.";

const searchSteps = (count: number) =>
	Array.from(
		{
			length: count,
		},
		(_, index) => ({
			toolCalls: [
				{
					name: "searchKnowledgeBase",
					input: {
						query: `citation ${index + 1}`,
					},
				},
			],
		}),
	);

type CompletionBody = {
	tool_choice?: unknown;
	tools?: unknown[];
	messages: {
		role: string;
		content: unknown;
	}[];
};

const lastCompletion = (inference: InferenceMock) =>
	completionRequests(inference).at(-1)?.body as CompletionBody;

/** Opens a chat with a repository, so the search tool is offered. */
const openChatWithRepository = async ({
	member,
	model,
	pageAs,
	orgSlug,
}: {
	member: ApiClient;
	model: ChatModel;
	pageAs: (role: "member") => Promise<Page>;
	orgSlug: string;
}) => {
	const chatId = await createChat(member, model, chatName("Step Limit"));
	await attachRepository(member, chatId);

	const page = await pageAs("member");
	await enterApp(page, orgSlug);
	await openChat(page, chatId);
	return page;
};

const send = async (page: Page, question: string) => {
	await composer(page).fill(question);
	await page
		.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
			exact: true,
		})
		.click();
};

const expectNoWorkingIndicator = async (page: Page) => {
	await expect(
		page.getByRole("button", {
			name: message("ai_elements_prompt_input_stop_aria_label"),
			exact: true,
		}),
	).toHaveCount(0);
	await expect(
		page.getByRole("log").getByText(message("chat_work_log_working")),
	).toHaveCount(0);
	await expect(
		page.getByRole("log").getByText(message("chat_work_log_thinking")),
	).toHaveCount(0);
};

test("a turn that would keep searching answers on its last step", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const page = await openChatWithRepository({
		member: api.as("member"),
		model,
		pageAs,
		orgSlug: org.slug,
	});
	inference.script(...searchSteps(STEP_LIMIT - 1), {
		text: ANSWER,
	});

	await send(page, QUESTION);

	await expect(messageText(page, ANSWER)).toBeVisible(FULL_TURN);
	await expectNoWorkingIndicator(page);
	expect(completionRequests(inference)).toHaveLength(STEP_LIMIT);

	const finalStep = lastCompletion(inference);
	expect(finalStep.tool_choice).toBe("none");
	expect(finalStep.tools?.length).toBeGreaterThan(0);
	expect(finalStep.messages.at(-1)).toEqual({
		role: "user",
		content: FINAL_STEP_NOTE,
	});
	for (const step of completionRequests(inference).slice(0, -1)) {
		expect((step.body as CompletionBody).tool_choice).not.toBe("none");
	}
});

test("a model that still calls tools on its last step ends at the step limit", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const page = await openChatWithRepository({
		member: api.as("member"),
		model,
		pageAs,
		orgSlug: org.slug,
	});
	inference.script(...searchSteps(STEP_LIMIT + 5));

	await send(page, QUESTION);

	const stopped = page
		.getByRole("log")
		.getByText(message("chat_reply_step_limit"), {
			exact: true,
		});
	await expect(stopped).toBeVisible(FULL_TURN);
	await expectNoWorkingIndicator(page);
	expect(completionRequests(inference)).toHaveLength(STEP_LIMIT);

	await page.reload();
	await expect(stopped).toBeVisible();
	await expectNoWorkingIndicator(page);
});

test("a request pool with 3 requests left gives the turn 3 steps, the last one answering", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference, {
		meteringMode: "requests",
		budgetAmount: 3,
	});
	const page = await openChatWithRepository({
		member: api.as("member"),
		model,
		pageAs,
		orgSlug: org.slug,
	});
	inference.script(...searchSteps(2), {
		text: ANSWER,
	});

	await send(page, QUESTION);

	await expect(messageText(page, ANSWER)).toBeVisible();
	await expectNoWorkingIndicator(page);
	expect(completionRequests(inference)).toHaveLength(3);
	expect(lastCompletion(inference).tool_choice).toBe("none");
	expect(lastCompletion(inference).messages.at(-1)).toEqual({
		role: "user",
		content: FINAL_STEP_NOTE,
	});
});
