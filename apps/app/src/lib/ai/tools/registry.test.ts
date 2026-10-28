import { describe, expect, test } from "bun:test";
import { formatNames, type NameOf } from "./declaration";
import type { EntityRef } from "./entity-kind";
import { type ToolName, toolLabels, toolSummary } from "./registry";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const ids = (count: number) =>
	Array.from(
		{
			length: count,
		},
		(_, index) => id(index + 1),
	);

const lookedUp: NameOf = (ref) => `${ref.kind} ${ref.id.slice(-1)}`;

const calls = (nameOf: NameOf) => {
	const refs: EntityRef[] = [];
	const spy: NameOf = (ref) => {
		refs.push(ref);
		return nameOf(ref);
	};
	return {
		refs,
		spy,
	};
};

/** A model-facing input per tool, as the model would send it. */
const pendingInputs = {
	findBots: {
		query: "citation",
		limit: 20,
	},
	getBot: {
		id: id(1),
	},
	getBlock: {
		id: id(1),
	},
	findBlocks: {
		type: "template",
		query: "essay",
		limit: 20,
	},
	findAssets: {
		query: "syllabus",
		repositoryId: id(2),
		limit: 20,
	},
	listGroups: {
		limit: 20,
	},
	listMembers: {
		query: "anna",
		limit: 20,
	},
	loadTools: {
		groups: [
			"bots",
			"people",
		],
	},
	updatePlan: {
		title: "Set up the course",
		items: [
			{
				label: "Create the bot",
				status: "pending",
			},
			{
				label: "Share it",
				status: "pending",
			},
		],
	},
	createBot: {
		name: "Citation check",
		description: "Checks citations",
	},
	updateBot: {
		id: id(1),
		description: "Checks citations",
	},
	publishBot: {
		id: id(1),
	},
	deleteBot: {
		ids: ids(1),
	},
	createTemplate: {
		name: "Essay feedback",
		systemPrompt: "Give feedback.",
	},
	updateTemplate: {
		id: id(2),
		systemPrompt: "Give feedback.",
	},
	createRepository: {
		name: "Sources",
		assetIds: ids(2),
	},
	updateRepository: {
		id: id(2),
		assetIds: ids(2),
	},
	deleteBlock: {
		ids: ids(1),
	},
	updateAsset: {
		id: id(3),
		metadata: {
			author: "Anna",
		},
	},
	deleteAsset: {
		ids: ids(1),
	},
	retryAsset: {
		assetId: id(3),
		repositoryId: id(2),
	},
	generateAssetMetadata: {
		assetIds: ids(1),
	},
	requestUpload: {
		reason: "Upload the style guides for the repository 'APA rules'",
	},
	listAccess: {
		resourceType: "bot",
		resourceId: id(1),
	},
	findPrincipals: {
		resourceType: "bot",
		resourceId: id(1),
		query: "teach",
		limit: 25,
		excludeGranted: false,
	},
	grantAccess: {
		resourceType: "bot",
		resourceId: id(1),
		principals: [
			{
				principalType: "group",
				principalId: id(4),
			},
		],
		role: "editor",
	},
	revokeAccess: {
		resourceType: "bot",
		resourceId: id(1),
		principalType: "user",
		principalId: id(5),
	},
	createGroup: {
		name: "Teaching",
	},
	updateGroup: {
		id: id(4),
		description: "Teaching staff",
	},
	deleteGroup: {
		ids: ids(1),
	},
	addGroupMembers: {
		groupId: id(4),
		userIds: ids(1),
	},
	removeGroupMembers: {
		groupId: id(4),
		userIds: ids(1),
	},
	listGroupMembers: {
		groupId: id(4),
		limit: 20,
	},
	changeMemberRole: {
		userId: id(5),
		role: "admin",
	},
	removeMembers: {
		userIds: ids(1),
	},
	inviteMembers: {
		emails: [
			"anna@example.org",
		],
		role: "member",
	},
	listInvitations: {
		status: "pending",
		limit: 20,
	},
	cancelInvitation: {
		ids: ids(1),
	},
} satisfies Partial<Record<ToolName, unknown>>;

type SummarisedName = keyof typeof pendingInputs;

const summarised = Object.keys(pendingInputs) as SummarisedName[];

const summaryOf = (
	name: string,
	call: {
		input: unknown;
		output?: unknown;
	},
) => {
	const summary = toolSummary(name, call);

	if (!summary) {
		throw new Error(`${name} has no summary`);
	}

	return summary;
};

describe.each(summarised)("%s summary", (name) => {
	test("reads a pending input and names what its refs look up", () => {
		const summary = summaryOf(name, {
			input: pendingInputs[name],
		});
		const { refs, spy } = calls(lookedUp);
		const line = summary.line(spy);

		expect(line).toBeString();
		expect(line).not.toBe("");
		expect(line).not.toContain("undefined");
		expect(line).not.toContain("[object");
		for (const ref of summary.refs) {
			expect(line).toContain(lookedUp(ref));
		}
		// Every looked-up name is one the hook fetches.
		const fetched = summary.refs.map((ref) => `${ref.kind}:${ref.id}`);
		for (const ref of refs) {
			expect(fetched).toContain(`${ref.kind}:${ref.id}`);
		}
	});

	test("survives a call without input", () => {
		const summary = summaryOf(name, {
			input: undefined,
		});

		expect(summary.refs).toEqual([]);
		expect(summary.line(lookedUp)).toBeString();
		expect(summary.line(lookedUp)).not.toBe("");
	});
});

const gatedNames = [
	"deleteBot",
	"deleteBlock",
	"deleteAsset",
	"deleteGroup",
	"revokeAccess",
	"removeGroupMembers",
	"removeMembers",
	"cancelInvitation",
	"grantAccess",
	"addGroupMembers",
	"changeMemberRole",
	"inviteMembers",
] as const satisfies SummarisedName[];

describe.each(gatedNames)("%s card line", (name) => {
	test("names the item it acts on", () => {
		const summary = summaryOf(name, {
			input: pendingInputs[name],
		});
		const line = summary.line(lookedUp);

		if (name === "inviteMembers") {
			expect(line).toContain("anna@example.org");
		} else {
			expect(summary.refs.length).toBeGreaterThan(0);
		}
	});
});

const deleteOutputs: Partial<
	Record<
		SummarisedName,
		{
			output: unknown;
			names: string[];
		}
	>
> = {
	deleteBot: {
		output: {
			deleted: [
				{
					id: id(1),
					name: "Citation check",
				},
			],
			skipped: [],
		},
		names: [
			"Citation check",
		],
	},
	deleteBlock: {
		output: {
			deleted: [
				{
					id: id(1),
					name: "Essay feedback",
				},
			],
			skipped: [],
		},
		names: [
			"Essay feedback",
		],
	},
	deleteAsset: {
		output: {
			deleted: [
				{
					id: id(1),
					name: "Syllabus.pdf",
				},
			],
			skipped: [],
		},
		names: [
			"Syllabus.pdf",
		],
	},
	deleteGroup: {
		output: {
			deleted: [
				{
					id: id(1),
					name: "Teaching",
				},
			],
			skipped: [],
		},
		names: [
			"Teaching",
		],
	},
	removeMembers: {
		output: {
			removed: [
				{
					id: id(1),
					name: "Anna",
				},
			],
		},
		names: [
			"Anna",
		],
	},
	cancelInvitation: {
		output: {
			withdrawn: [
				{
					id: id(1),
					email: "anna@example.org",
				},
			],
		},
		names: [
			"anna@example.org",
		],
	},
};

describe.each(Object.keys(deleteOutputs) as SummarisedName[])(
	"%s after it ran",
	(name) => {
		test("names the gone items from its output without a lookup", () => {
			const fixture = deleteOutputs[name];
			const summary = summaryOf(name, {
				input: pendingInputs[name],
				output: fixture?.output,
			});
			const { refs, spy } = calls(lookedUp);
			const line = summary.line(spy);

			expect(summary.refs).toEqual([]);
			expect(refs).toEqual([]);
			for (const itemName of fixture?.names ?? []) {
				expect(line).toContain(itemName);
			}
		});
	},
);

const five = ids(5);

const batches: Partial<
	Record<
		SummarisedName,
		{
			input: unknown;
			names: string[];
		}
	>
> = {
	deleteBot: {
		input: {
			ids: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "bot",
				id: value,
			}),
		),
	},
	deleteBlock: {
		input: {
			ids: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "block",
				id: value,
			}),
		),
	},
	deleteAsset: {
		input: {
			ids: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "asset",
				id: value,
			}),
		),
	},
	deleteGroup: {
		input: {
			ids: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "group",
				id: value,
			}),
		),
	},
	removeMembers: {
		input: {
			userIds: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "member",
				id: value,
			}),
		),
	},
	cancelInvitation: {
		input: {
			ids: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "invitation",
				id: value,
			}),
		),
	},
	addGroupMembers: {
		input: {
			groupId: id(9),
			userIds: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "member",
				id: value,
			}),
		),
	},
	removeGroupMembers: {
		input: {
			groupId: id(9),
			userIds: five,
		},
		names: five.map((value) =>
			lookedUp({
				kind: "member",
				id: value,
			}),
		),
	},
	grantAccess: {
		input: {
			resourceType: "bot",
			resourceId: id(9),
			principals: five.map((value) => ({
				principalType: "group",
				principalId: value,
			})),
			role: "viewer",
		},
		names: five.map((value) =>
			lookedUp({
				kind: "group",
				id: value,
			}),
		),
	},
	inviteMembers: {
		input: {
			emails: five.map((_, index) => `person${index}@example.org`),
			role: "member",
		},
		names: five.map((_, index) => `person${index}@example.org`),
	},
};

describe.each(Object.keys(batches) as SummarisedName[])(
	"%s over a batch",
	(name) => {
		test("names three items and counts the rest", () => {
			const batch = batches[name];
			const line = summaryOf(name, {
				input: batch?.input,
			}).line(lookedUp);
			const names = batch?.names ?? [];

			expect(line).toContain(formatNames(names));
			expect(line).not.toContain(names[3] as string);
		});
	},
);

describe("loadTools summary", () => {
	test("names the loaded groups, not the refused ones", () => {
		const summary = summaryOf("loadTools", {
			input: pendingInputs.loadTools,
			output: {
				groups: [
					{
						group: "bots",
						loaded: true,
						tools: [],
					},
					{
						group: "sharing",
						loaded: true,
						tools: [],
					},
					{
						group: "people",
						loaded: false,
						error: "FORBIDDEN",
					},
				],
			},
		});

		expect(summary.line(lookedUp)).toBe("Loaded tools: Bots and Sharing");
	});
});

describe("requestUpload summary", () => {
	const input = pendingInputs.requestUpload;
	const line = (output?: unknown) =>
		summaryOf("requestUpload", {
			input,
			output,
		}).line(lookedUp);
	const saved = (count: number) => ({
		status: "saved",
		assets: ids(count).map((assetId, index) => ({
			id: assetId,
			title: `File ${index + 1}.pdf`,
		})),
	});

	test("counts the saved files", () => {
		expect(line(saved(1))).toBe("Uploaded 1 file");
		expect(line(saved(2))).toBe("Uploaded 2 files");
	});

	test("reads a cancelled upload", () => {
		expect(
			line({
				status: "cancelled",
			}),
		).toBe("Upload cancelled");
	});

	test("names the tool before it ran", () => {
		expect(line()).toBe("Upload files");
	});
});

describe("updatePlan summary", () => {
	const planLine = (statuses: string[]) =>
		summaryOf("updatePlan", {
			input: {
				title: "Set up the course",
				items: statuses.map((status, index) => ({
					label: `Step ${index + 1}`,
					status,
				})),
			},
			output: {
				updated: true,
			},
		}).line(lookedUp);

	test("names the plan and tallies its steps", () => {
		expect(
			planLine([
				"done",
				"done",
				"in_progress",
				"pending",
				"pending",
			]),
		).toBe("Plan “Set up the course”: 2 of 5 done");
	});

	test("adds the skipped steps", () => {
		expect(
			planLine([
				"done",
				"done",
				"skipped",
				"pending",
				"pending",
			]),
		).toBe("Plan “Set up the course”: 2 of 5 done, 1 skipped");
	});
});

describe("readDocs summary", () => {
	const line = (output?: unknown) =>
		summaryOf("readDocs", {
			input: {},
			output,
		}).line(lookedUp);
	const read = (path: string | null, title: string | null) => ({
		path,
		title,
		url: `https://orcai.example${path ?? "/docs"}`,
		content: "",
	});

	test("reads the index", () => {
		expect(line()).toBe("Read the docs index");
		expect(line(read(null, null))).toBe("Read the docs index");
	});

	test("names a page by its title and path", () => {
		expect(line(read("/docs/using-orcai/bots", "Bots"))).toBe(
			"Read the docs page “Bots” (/docs/using-orcai/bots)",
		);
		expect(line(read("/docs/using-orcai/bots", null))).toBe(
			"Read the docs page /docs/using-orcai/bots",
		);
	});
});

describe("toolSummary", () => {
	test("has no summary for a tool without a line or an unknown tool", () => {
		expect(
			toolSummary("searchKnowledgeBase", {
				input: {},
			}),
		).toBeUndefined();
		expect(
			toolSummary("retiredTool", {
				input: {},
			}),
		).toBeUndefined();
	});

	test("reads a stored call of an older shape as no line", () => {
		const summary = summaryOf("loadTools", {
			input: {},
			output: {
				loaded: [
					"bots",
				],
			},
		});

		expect(summary.line(lookedUp)).toBeUndefined();
	});
});

describe("toolLabels", () => {
	test("labels a declared tool from its declaration", () => {
		expect(
			toolLabels({
				type: "tool-searchKnowledgeBase",
			}),
		).toMatchObject({
			name: "Searched the sources",
			active: "Searching the sources",
		});
		expect(
			toolLabels({
				type: "tool-deleteBot",
			}).name,
		).toBe("Delete bots");
	});

	test("names a dynamic or retired tool by its name", () => {
		expect(
			toolLabels({
				type: "dynamic-tool",
				toolName: "webSearch",
			}).name,
		).toBe("webSearch");
		expect(
			toolLabels({
				type: "tool-retiredTool",
			}).name,
		).toBe("retiredTool");
	});
});
