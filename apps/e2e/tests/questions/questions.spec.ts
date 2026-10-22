import { actStep } from "../../fixtures/assistant/approval";
import {
	openConversation,
	pluralMessage,
	setUpAssistantModel,
	startTitledConversation,
	toolMessages,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import {
	messageText,
	openChat,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import {
	ask,
	completionBodies,
	createBot,
	createBotChat,
	toolResults,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, type JsonValue, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import {
	askUserCall,
	option,
	QUESTIONS,
	questionsButton,
	questionsCard,
} from "../../fixtures/questions/questions";

const ROUND_TITLE = "About your bot";

const CLARIFYING: JsonValue = {
	mode: "regular",
	title: ROUND_TITLE,
	questions: [
		{
			type: "single",
			prompt: "Who is it for?",
			options: [
				"Students",
				"Staff",
			],
		},
		{
			type: "multiple",
			prompt: "Which features?",
			options: [
				"Web search",
				"Generative UI",
				"Quizzes",
			],
		},
		{
			type: "text",
			prompt: "What should it never do?",
		},
	],
};

const QUIZ_TITLE = "Capitals";

const QUIZ: JsonValue = {
	mode: "quiz",
	title: QUIZ_TITLE,
	questions: [
		{
			type: "single",
			section: "Europe",
			prompt: "Capital of France?",
			options: [
				"Lyon",
				"Paris",
			],
		},
		{
			type: "multiple",
			section: "Europe",
			prompt: "Which are capitals?",
			options: [
				"Berlin",
				"Munich",
				"Vienna",
			],
			points: 2,
		},
		{
			type: "text",
			section: "Asia",
			prompt: "Capital of Japan?",
		},
	],
};

const GRADING: JsonValue = {
	results: [
		{
			question: 1,
			verdict: "correct",
		},
		{
			question: 2,
			verdict: "partly_correct",
			earned: 1,
			expected: "Berlin and Vienna",
			explanation: "Vienna is a capital too.",
		},
		{
			question: 3,
			verdict: "incorrect",
			expected: "Tokyo",
			explanation: "Kyoto was the capital until 1869.",
		},
	],
};

const score = (earned: number, points: number) =>
	pluralMessage("gen_ui_quiz_score", {
		earned,
		points,
		count: points,
	});

test("questions: the assistant asks, and continues the same reply with the answers", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const member = api.as("member");
	const chatId = await startTitledConversation(member, inference);
	const done = "Thanks, a bot for students.";
	inference.script(actStep("A few questions first.", askUserCall(CLARIFYING)), {
		text: done,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);
	await ask(page, "Help me build a bot");

	const card = questionsCard(page, ROUND_TITLE);
	await expect(
		card.getByText(
			message("questions_step_progress", {
				step: 1,
				count: 3,
			}),
		),
	).toBeVisible();
	await option(card, "radio", "Students").click();

	await expect(
		card.getByText(
			message("questions_step_progress", {
				step: 2,
				count: 3,
			}),
		),
	).toBeVisible();
	await option(card, "checkbox", "Web search").click();
	await option(card, "checkbox", "Quizzes").click();
	await questionsButton(card, "questions_next_action").click();

	await card
		.getByRole("textbox", {
			name: "What should it never do?",
		})
		.fill("Grade essays");
	await questionsButton(card, "questions_next_action").click();

	await expect(card.getByText(message("questions_review_title"))).toBeVisible();
	await expect(card.getByText("Web search, Quizzes")).toBeVisible();
	await questionsButton(card, "questions_submit_action").click();

	await expect(messageText(page, done)).toBeVisible();
	await turnFinished(page);
	expect(toolMessages(turnRequests(inference).at(-1)).at(-1)).toEqual({
		status: "answered",
		answers: [
			{
				question: "Who is it for?",
				answer: {
					selected: "Students",
				},
			},
			{
				question: "Which features?",
				answer: {
					selected: [
						"Web search",
						"Quizzes",
					],
				},
			},
			{
				question: "What should it never do?",
				answer: "Grade essays",
			},
		],
	});

	await page.reload();
	await expect(card.getByText("Grade essays")).toBeVisible();
	await expect(questionsButton(card, "questions_submit_action")).toHaveCount(0);
});

test("questions: a bot's quiz is answered, submitted and graded with the computed score", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const bot = await createBot(member, QUESTIONS);
	const chatId = await createBotChat(member, model, bot.id);
	const remark = "Half the points; Asia needs work.";
	inference.script(
		{
			text: "Here is your quiz.",
			toolCalls: [
				askUserCall(QUIZ),
			],
		},
		{
			toolCalls: [
				{
					name: "showQuizResult",
					input: GRADING,
				},
			],
		},
		{
			text: remark,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await ask(page, "Quiz me on capitals");

	const card = questionsCard(page, QUIZ_TITLE);
	await expect(
		card.getByText("Europe", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		card.getByText(
			pluralMessage("questions_points", {
				count: 2,
			}),
		),
	).toBeVisible();
	await expect(
		option(card, "radio", message("questions_other_label")),
	).toHaveCount(0);
	await option(card, "radio", "Paris").click();
	await option(card, "checkbox", "Berlin").click();
	await questionsButton(card, "questions_next_action").click();

	await card
		.getByRole("textbox", {
			name: /Capital of Japan\?/,
		})
		.fill("Kyoto");
	await questionsButton(card, "questions_submit_quiz_action").click();

	await expect(messageText(page, remark)).toBeVisible();
	await turnFinished(page);
	const log = page.getByRole("log");
	await expect(
		log.getByText(score(2, 4), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		log.getByText(score(2, 3), {
			exact: true,
		}),
	).toBeVisible();
	await expect(log.getByText("Vienna is a capital too.")).toBeVisible();
	await expect(
		log.getByText("Kyoto was the capital until 1869."),
	).toBeVisible();
	const grading = toolResults(completionBodies(inference).at(-1)).map(String);
	expect(grading.at(-1)).toContain('"earned":2,"points":4');

	inference.script({
		text: "Let us practise Asia.",
	});
	await log
		.getByRole("button", {
			name: message("gen_ui_quiz_practice_action"),
		})
		.click();
	await expect(
		messageText(page, message("gen_ui_quiz_practice_message")),
	).toBeVisible();
	await expect(messageText(page, "Let us practise Asia.")).toBeVisible();
});

test("questions: skipping tells the model the user declined", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const bot = await createBot(member, QUESTIONS);
	const chatId = await createBotChat(member, model, bot.id);
	const reply = "Fine, I will assume the defaults.";
	inference.script(
		{
			toolCalls: [
				askUserCall(CLARIFYING),
			],
		},
		{
			text: reply,
		},
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await ask(page, "Set up a bot");

	const card = questionsCard(page, ROUND_TITLE);
	await questionsButton(card, "questions_skip_action").click();

	await expect(messageText(page, reply)).toBeVisible();
	await turnFinished(page);
	await expect(
		card.getByText(message("chat_work_log_tool_status_skipped"), {
			exact: true,
		}),
	).toBeVisible();
	expect(
		toolResults(completionBodies(inference).at(-1)).map(String).at(-1),
	).toContain("The user skipped the questions.");
});
