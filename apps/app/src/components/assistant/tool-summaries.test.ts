import { describe, expect, mock, test } from "bun:test";
import { GATED_ASSISTANT_TOOLS } from "@/lib/ai/tools/assistant/approval";
import {
	formatNames,
	type NameOf,
	type NameRef,
} from "@/lib/ai/tools/assistant/summary";
import type { SummarisedToolName, SummarisedToolPart } from "./tool-summaries";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { assistantToolSummaries, toolSummaryOf } = await import(
	"./tool-summaries"
);

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
	const refs: NameRef[] = [];
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
const pendingInputs: Record<SummarisedToolName, unknown> = {
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
};

const partOf = (
	name: SummarisedToolName,
	fields: Record<string, unknown>,
): SummarisedToolPart =>
	({
		type: `tool-${name}`,
		toolCallId: `call-${name}`,
		...fields,
	}) as unknown as SummarisedToolPart;

const toolNames = Object.keys(assistantToolSummaries).map((type) =>
	type.replace(/^tool-/, ""),
) as SummarisedToolName[];

describe("summary registry", () => {
	test("covers every summarised tool", () => {
		expect(Object.keys(assistantToolSummaries).sort()).toEqual(
			Object.keys(pendingInputs)
				.map((name) => `tool-${name}`)
				.sort(),
		);
	});

	test("gated tools and only those carry their card verb", () => {
		const expected: Partial<Record<SummarisedToolName, string>> = {
			deleteBot: "delete",
			deleteBlock: "delete",
			deleteAsset: "delete",
			deleteGroup: "delete",
			revokeAccess: "remove",
			removeGroupMembers: "remove",
			removeMembers: "remove",
			cancelInvitation: "withdraw",
			grantAccess: "grant",
			addGroupMembers: "add",
			changeMemberRole: "change",
			inviteMembers: "invite",
		};

		for (const name of toolNames) {
			expect({
				name,
				verb: toolSummaryOf(partOf(name, {})).verb as string | undefined,
			}).toEqual({
				name,
				verb: expected[name],
			});
		}
		expect(Object.keys(expected).sort()).toEqual(
			[
				...GATED_ASSISTANT_TOOLS,
			].sort(),
		);
	});
});

describe.each(toolNames)("%s summary", (name) => {
	const summary = toolSummaryOf(partOf(name, {}));

	test("reads a pending input and names what its refs look up", () => {
		const part = partOf(name, {
			state: "input-available",
			input: pendingInputs[name],
		});
		const { refs, spy } = calls(lookedUp);
		const line = summary.line(part as never, spy);

		expect(line).not.toBe("");
		expect(line).not.toContain("undefined");
		expect(line).not.toContain("[object");
		for (const ref of summary.refs?.(part as never) ?? []) {
			expect(line).toContain(lookedUp(ref));
		}
		// Every looked-up name is one the hook fetches.
		const fetched = (summary.refs?.(part as never) ?? []).map(
			(ref) => `${ref.kind}:${ref.id}`,
		);
		for (const ref of refs) {
			expect(fetched).toContain(`${ref.kind}:${ref.id}`);
		}
	});

	test("survives an error without input", () => {
		const part = partOf(name, {
			state: "output-error",
			input: undefined,
			errorText: "PERMISSION_DENIED: No.",
		});

		expect(summary.refs?.(part as never) ?? []).toEqual([]);
		expect(summary.line(part as never, lookedUp)).not.toBe("");
	});
});

const gatedNames: SummarisedToolName[] = [
	...GATED_ASSISTANT_TOOLS,
];

describe.each(gatedNames)("%s card line", (name) => {
	test("names the item it acts on", () => {
		const part = partOf(name, {
			state: "approval-requested",
			input: pendingInputs[name],
			approval: {
				id: "approval-1",
			},
		});
		const summary = toolSummaryOf(part);
		const line = summary.line(part as never, lookedUp);

		if (name === "inviteMembers") {
			expect(line).toContain("anna@example.org");
		} else {
			expect((summary.refs?.(part as never) ?? []).length).toBeGreaterThan(0);
		}
	});
});

const deleteOutputs: Partial<
	Record<
		SummarisedToolName,
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

describe.each(Object.keys(deleteOutputs) as SummarisedToolName[])(
	"%s after it ran",
	(name) => {
		test("names the gone items from its output without a lookup", () => {
			const fixture = deleteOutputs[name];
			const part = partOf(name, {
				state: "output-available",
				input: pendingInputs[name],
				output: fixture?.output,
			});
			const summary = toolSummaryOf(part);
			const { refs, spy } = calls(lookedUp);
			const line = summary.line(part as never, spy);

			expect(summary.refs?.(part as never) ?? []).toEqual([]);
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
		SummarisedToolName,
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
				kind: "user",
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
				kind: "user",
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
				kind: "user",
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

describe.each(Object.keys(batches) as SummarisedToolName[])(
	"%s over a batch",
	(name) => {
		test("names three items and counts the rest", () => {
			const batch = batches[name];
			const part = partOf(name, {
				state: "approval-requested",
				input: batch?.input,
				approval: {
					id: "approval-1",
				},
			});
			const line = toolSummaryOf(part).line(part as never, lookedUp);
			const names = batch?.names ?? [];

			expect(line).toContain(formatNames(names));
			expect(line).not.toContain(names[3] as string);
		});
	},
);

describe("loadTools summary", () => {
	test("names the loaded groups, not the refused ones", () => {
		const part = partOf("loadTools", {
			state: "output-available",
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

		expect(toolSummaryOf(part).line(part as never, lookedUp)).toBe(
			"Loaded tools: Bots and Sharing",
		);
	});
});
