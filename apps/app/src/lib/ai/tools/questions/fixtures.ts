import type { AskUserInput, AskUserOutput } from "./ask-user";

/** A clarifying round with one question of every type. */
export const clarifyingRound = {
	mode: "regular",
	title: "About your bot",
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
		{
			type: "scale",
			prompt: "How formal?",
			min: 1,
			max: 5,
			minLabel: "Casual",
			maxLabel: "Formal",
		},
	],
} satisfies AskUserInput;

export const clarifyingAnswers = {
	status: "answered",
	answers: [
		{
			type: "choice",
			choices: [],
			other: "Alumni",
		},
		{
			type: "choice",
			choices: [
				2,
				0,
			],
		},
		null,
		{
			type: "scale",
			value: 4,
		},
	],
} satisfies AskUserOutput;

/** A quiz of two sections, one question worth two points. */
export const capitalsQuiz = {
	mode: "quiz",
	title: "Capitals",
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
} satisfies AskUserInput;

export const capitalsAnswers = {
	status: "answered",
	answers: [
		{
			type: "choice",
			choices: [
				1,
			],
		},
		{
			type: "choice",
			choices: [
				0,
			],
		},
		null,
	],
} satisfies AskUserOutput;
