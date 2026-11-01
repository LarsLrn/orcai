import {
	answers,
	answersIn,
	calls,
	callsBefore,
	change,
	changesOnly,
	doesNotCall,
	glossaryTerms,
	mentions,
	omits,
} from "../checks";
import { type ApprovedPlan, runAssistant, type Scripted } from "../harness";
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
	type: "database",
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
	(message: string, library: Library = {}): EvalCase["run"] =>
	(model) =>
		runAssistant({
			model,
			message,
			scripted: riverside(library),
		});

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
	(plan: ApprovedPlan): EvalCase["run"] =>
	(model) =>
		runAssistant({
			model,
			message: SPANISH_DRILL,
			approved: plan,
			scripted: riverside({}),
		});

export const assistantCases: EvalCase[] = [
	{
		id: "assistant/new-bot-asks-first",
		run: assistant(
			"Create a bot that helps my students practise Spanish vocabulary.",
		),
		checks: [
			callsBefore("askUser", "updatePlan"),
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
		id: "language/assistant-german",
		run: assistant("Wie lade ich Dateien in ein Repository hoch?"),
		checks: [
			answersIn("de"),
		],
	},
];
