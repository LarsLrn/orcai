import {
	answers,
	answersIn,
	calls,
	callsBefore,
	callsWith,
	change,
	changesOnly,
	cites,
	citesComplete,
	citesIssued,
	citesNothing,
	createsAfter,
	doesNotCall,
	glossaryTerms,
	mentions,
	mentionsDate,
	noLegacyCite,
	noOtherCitationStyle,
	omits,
} from "../checks";
import {
	type Answerer,
	type ApprovedPlan,
	ASSISTANT_DATE,
	type Reply,
	runAssistant,
	type Scripted,
} from "../harness";
import type { EvalCase } from "./case";

const bot = (name: string, status: "draft" | "ready" = "ready") => ({
	id: crypto.randomUUID(),
	name,
	description: `${name} for Riverside School.`,
	status,
	canEdit: true,
	favourite: false,
});

const citationCheck = bot("Citation check");
const oldQuiz = bot("Old quiz");

const group = (name: string) => ({
	id: crypto.randomUUID(),
	name,
	description: `Students of ${name.toLowerCase()}.`,
	kind: "custom",
});
const year9 = group("Year 9");

const repository = (name: string) => ({
	id: crypto.randomUUID(),
	name,
	description: `${name} for Research methods.`,
	status: "ready",
	type: "repository",
});
const courseReadings = repository("Course readings");

/** Look-alikes beside each target, so a call on the wrong one fails. */
const otherBots = [
	bot("Citation drill"),
	bot("Quiz master"),
];
const otherGroups = [
	group("Year 10"),
	group("Year 9 teachers"),
];
const otherBlocks = [
	repository("Course rubrics"),
];

interface Library {
	bots?: ReturnType<typeof bot>[];
	blocks?: ReturnType<typeof repository>[];
	groups?: ReturnType<typeof group>[];
}

const found = <
	Item extends {
		name: string;
	},
>(
	items: Item[],
	query: string | undefined,
) =>
	items.filter(
		({ name }) => !query || name.toLowerCase().includes(query.toLowerCase()),
	);

const byId = <
	Item extends {
		id: string;
	},
>(
	items: Item[],
	id: string,
) => {
	const item = items.find((candidate) => candidate.id === id);
	if (!item) {
		throw new Error(`NOT_FOUND: Nothing with id ${id}.`);
	}
	return item;
};

interface GrantInput {
	targetType: string;
	targetId: string;
	grantees: {
		granteeId: string;
	}[];
	role: string;
}

interface Query {
	query?: string;
}

interface Id {
	id: string;
}

/**
 * Riverside School as the read tools see it: the case's bots, repositories
 * and groups, one model and nothing else, so a run never stops on a read.
 */
const riverside = ({
	bots = [],
	blocks = [],
	groups = [],
}: Library): Scripted => ({
	findBots: ({ query }: Query) => ({
		bots: found(bots, query),
		total: found(bots, query).length,
	}),
	getBot: ({ id }: Id) => ({
		...byId(bots, id),
		features: {},
		behaviour: {
			id: crypto.randomUUID(),
			name: byId(bots, id).name,
			status: "ready",
		},
		repositories: [],
	}),
	findBlocks: ({ query }: Query) => ({
		blocks: found(blocks, query),
		total: found(blocks, query).length,
	}),
	getBlock: ({ id }: Id) => ({
		...byId(blocks, id),
		assets: [],
	}),
	findAssets: () => ({
		assets: [],
		total: 0,
	}),
	listGroups: ({ query }: Query) => ({
		groups: found(groups, query),
		total: found(groups, query).length,
	}),
	findPeople: ({ query }: Query) => ({
		grantees: found(groups, query).map(({ id, name, description, kind }) => ({
			granteeType: "group",
			granteeId: id,
			name,
			description,
			kind,
		})),
		count: found(groups, query).length,
	}),
	listMembers: () => ({
		members: [],
		total: 0,
	}),
	listGroupMembers: () => ({
		members: [],
		total: 0,
	}),
	listInvitations: () => ({
		invitations: [],
		total: 0,
	}),
	listAccess: () => ({
		grants: [],
		inherited: [],
	}),
	findCatalogue: () => ({
		entries: [],
		total: 0,
	}),
	findModels: () => ({
		models: [
			{
				id: crypto.randomUUID(),
				name: "School default",
				description: "The organisation's default chat model.",
				maxOutputTokens: 8192,
			},
		],
		total: 1,
	}),
});

const assistant =
	(
		message: string,
		library: Library = {},
		replies: Reply[] = [],
	): EvalCase["run"] =>
	(model) =>
		runAssistant({
			model,
			message,
			replies,
			scripted: riverside(library),
		});

/** Takes every suggested option, the first, and answers each text question with `text`. */
const acceptSuggestions =
	(text: string): Answerer =>
	({ questions }) => ({
		status: "answered",
		answers: questions.map((question) => {
			switch (question.type) {
				case "text":
					return {
						type: "text",
						text,
					};
				case "scale":
					return {
						type: "scale",
						value: Math.round((question.min + question.max) / 2),
					};
				default:
					return {
						type: "choice",
						choices: [
							0,
						],
					};
			}
		}),
	});

/** Every line in capitals, a pseudo-heading such as "TONE AND STYLE:". */
const capitalsLine = /^[^a-z\n]*[A-Z]{2}[^a-z\n]*[A-Z]{2}[^a-z\n]*$/m;

const SPANISH_DRILL =
	'Create a bot named "Spanish drill" for my year 9 class. Its behaviour: quiz the students on Spanish vocabulary, one word at a time, and correct each answer in one sentence. It needs no repositories and no features. Use the default model.';

const spanishDrillPlan: ApprovedPlan = {
	leadIn:
		"I will create the behaviour first and then the bot that uses it with the default model.",
	plan: {
		title: "Set up Spanish drill",
		items: [
			{
				label: "Create the behaviour",
				details:
					"Quiz year 9 students on Spanish vocabulary, one word at a time, and correct each answer in one sentence.",
				status: "pending",
			},
			{
				label: "Create the bot",
				details:
					"Spanish drill with that behaviour, the default model, no repositories and no features.",
				status: "pending",
			},
		],
	},
};

/** The continuation after the user approved the plan. */
const approvedPlan =
	(plan: ApprovedPlan, message = SPANISH_DRILL): EvalCase["run"] =>
	(model) =>
		runAssistant({
			model,
			message,
			approved: plan,
			scripted: riverside({}),
		});

const ESSAY_COACH =
	'Create a behaviour named "Essay coach" for first-year students writing their first academic essays. It gives feedback on structure, argument and citations, asks one question back at a time, keeps each answer to four to six sentences, and refers questions about grades to the course team.';

const essayCoachPlan: ApprovedPlan = {
	leadIn: "I will create the behaviour Essay coach.",
	loaded: [
		"bots",
	],
	plan: {
		title: "Create Essay coach",
		items: [
			{
				label: "Create the behaviour",
				details:
					"Essay coach for first-year students: feedback on structure, argument and citations, one question back at a time, four to six sentences per answer, grade questions go to the course team.",
				status: "pending",
			},
		],
	},
};

export const assistantCases: EvalCase[] = [
	{
		id: "assistant/plan-asks-with-askuser",
		run: assistant(
			"Create a bot that helps my students practise Spanish vocabulary.",
			{},
			[
				{
					answers: acceptSuggestions(
						"Spanish drill, for my year 9 class: quiz them on vocabulary one word at a time and correct each answer in one sentence. No repositories, no features, the default model.",
					),
				},
				{
					approve: true,
				},
			],
		),
		checks: [
			callsBefore("askUser", "updatePlan"),
			createsAfter("updatePlan"),
		],
	},
	{
		id: "assistant/new-bot-specified-plans",
		run: assistant(SPANISH_DRILL),
		checks: [
			calls("updatePlan"),
			doesNotCall("askUser"),
		],
	},
	{
		id: "assistant/approved-plan-creates",
		run: approvedPlan({
			...spanishDrillPlan,
			loaded: [
				"bots",
			],
		}),
		checks: [
			callsBefore("createBehaviour", "createBot"),
		],
	},
	{
		id: "assistant/approved-plan-loads-and-creates",
		run: approvedPlan(spanishDrillPlan),
		checks: [
			callsBefore("loadTools", "createBehaviour", "createBot"),
			callsBefore("createBehaviour", "createBot"),
		],
	},
	{
		id: "assistant/behaviour-markdown",
		run: approvedPlan(essayCoachPlan, ESSAY_COACH),
		checks: [
			callsWith<{
				systemPrompt: string;
			}>(
				"createBehaviour",
				"a system prompt with Markdown headings and no lines in capitals",
				({ systemPrompt }) =>
					/^#{1,3} \S/m.test(systemPrompt) && !capitalsLine.test(systemPrompt),
			),
		],
	},
	{
		id: "assistant/catalogue-listing-links",
		run: assistant(
			'List my bot "Citation check" in the Catalogue so that every organisation on this instance can see it.',
			{
				bots: [
					citationCheck,
				],
			},
		),
		checks: [
			changesOnly(),
			// A Markdown link to an app path; an invented host breaks it.
			mentions(/\]\(\s*\/app\//),
		],
	},
	{
		id: "assistant/share-with-group",
		run: assistant(
			'Give the group "Year 9" access to use my bot "Citation check".',
			{
				bots: [
					citationCheck,
					...otherBots,
				],
				groups: [
					year9,
					...otherGroups,
				],
			},
		),
		checks: [
			changesOnly(
				change<GrantInput>(
					"grantAccess",
					"Year 9 as viewer on Citation check",
					({ targetType, targetId, grantees, role }) =>
						targetType === "bot" &&
						targetId === citationCheck.id &&
						role === "viewer" &&
						grantees.length === 1 &&
						grantees[0]?.granteeId === year9.id,
				),
			),
		],
	},
	{
		id: "assistant/action-cites-nothing",
		run: assistant(
			'Share my bot "Citation check" with the group "Year 9" so they can use it.',
			{
				bots: [
					citationCheck,
					...otherBots,
				],
				groups: [
					year9,
					...otherGroups,
				],
			},
		),
		checks: [
			calls("grantAccess"),
			citesNothing,
		],
	},
	{
		id: "assistant/how-to-cites-docs",
		run: assistant(
			"How do I publish a bot so that the people I share it with can use it?",
		),
		checks: [
			answers,
			cites,
			citesComplete,
			citesIssued,
			noLegacyCite,
			noOtherCitationStyle,
		],
	},
	{
		id: "assistant/ambiguous-name-asks",
		run: assistant("Delete my bot Helper.", {
			bots: [
				bot("Helper"),
				bot("Helper", "draft"),
			],
		}),
		checks: [
			calls("askUser"),
			changesOnly(),
		],
	},
	{
		id: "assistant/delete-confirms-in-tool",
		run: assistant('Delete my bot "Old quiz".', {
			bots: [
				oldQuiz,
				...otherBots,
			],
		}),
		checks: [
			changesOnly(
				change<{
					ids: string[];
				}>(
					"deleteBot",
					"Old quiz only",
					({ ids }) => ids.length === 1 && ids[0] === oldQuiz.id,
				),
			),
		],
	},
	{
		id: "assistant/upload-requests",
		run: assistant(
			'I want to add three PDFs to my repository "Course readings".',
			{
				blocks: [
					courseReadings,
					...otherBlocks,
				],
			},
		),
		checks: [
			changesOnly(
				change<{
					reason: string;
				}>("requestUpload", "a reason naming Course readings", ({ reason }) =>
					reason.includes("Course readings"),
				),
			),
		],
	},
	{
		id: "assistant/upload-question-answers",
		run: assistant("Which file types can I upload to a repository?"),
		checks: [
			doesNotCall("requestUpload"),
			answers,
		],
	},
	{
		id: "assistant/off-topic-declines",
		run: assistant("What is the capital of France?"),
		checks: [
			omits(/Paris/i),
			answers,
		],
	},
	{
		id: "terms/assistant-add-files",
		run: assistant("How do I give my bot its own files to answer from?"),
		checks: [
			answers,
			glossaryTerms,
		],
	},
	{
		id: "terms/assistant-behaviour-repository",
		run: assistant(
			"What is the difference between a behaviour and a repository?",
		),
		checks: [
			answers,
			glossaryTerms,
		],
	},
	{
		id: "terms/assistant-other-organisation",
		run: assistant("How can another organisation on our instance use my bot?"),
		checks: [
			answers,
			glossaryTerms,
		],
	},
	{
		id: "terms/assistant-published",
		run: assistant(
			'Can my students use my bot "Citation check" yet? What is its status?',
			{
				bots: [
					citationCheck,
					...otherBots,
				],
			},
		),
		checks: [
			answers,
			mentions(/published/i),
			omits(/\bready\b/i),
			omits(/\b(not|isn['’]t)\s+(yet\s+)?published\b|\bunpublished\b/i),
		],
	},
	{
		id: "context/assistant-knows-the-date",
		run: assistant(
			"What is today's date? I want to put it in my bot's description.",
		),
		checks: [
			mentionsDate(ASSISTANT_DATE),
		],
	},
	{
		id: "language/assistant-german",
		run: assistant("Wie lade ich Dateien in ein Repository hoch?"),
		checks: [
			answersIn("de"),
		],
	},
	{
		id: "language/german-cites-docs",
		run: assistant(
			"Wie veröffentliche ich einen Bot, damit die Personen, mit denen ich ihn teile, ihn nutzen können?",
		),
		checks: [
			answersIn("de"),
			cites,
			citesComplete,
			citesIssued,
			noOtherCitationStyle,
		],
	},
];
