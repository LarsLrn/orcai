import { describe, expect, mock, test } from "bun:test";
import type { BlockId, BotId } from "@orcai/core";
import type { BotEditor, PublicationStatus } from "@orcai/schema";
import { ORPCError } from "@orpc/client";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { toBotEditorFormValues } = await import(
	"@/components/authoring/bot-editor-form-options"
);
const {
	botEditorBaseline,
	executeBotEditorSave,
	planBotEditorSave,
	withSavedBlock,
} = await import("@/components/authoring/bot-editor-save");
const { emptyCapabilities, ownerCapabilities } = await import(
	"@/lib/authz/capabilities"
);

type Values = ReturnType<typeof toBotEditorFormValues>;
type Baseline = ReturnType<typeof botEditorBaseline>;
type BlockSaved = Parameters<
	Parameters<typeof executeBotEditorSave>[0]["onBlockSaved"]
>[0];

const botId = "00000000-0000-4000-8000-000000000001" as BotId;
const behaviourId = "00000000-0000-4000-8000-000000000002" as BlockId;
const repositoryId = "00000000-0000-4000-8000-000000000003" as BlockId;
const createdId = "00000000-0000-4000-8000-000000000004" as BlockId;
const libraryId = "00000000-0000-4000-8000-000000000005" as BlockId;

const published = (): Values =>
	toBotEditorFormValues({
		id: botId,
		name: "Course bot",
		description: "Answers course questions",
		contentJson: {},
		status: "ready",
		capabilities: ownerCapabilities("bot"),
		templateBlock: {
			id: behaviourId,
			type: "template",
			name: "Course behaviour",
			description: null,
			contentJson: null,
			status: "ready",
			config: {
				systemPrompt: "Answer from the course material.",
			},
			capabilities: ownerCapabilities("block"),
		},
		databaseBlocks: [
			{
				id: repositoryId,
				type: "database",
				name: "Course repository",
				description: null,
				contentJson: null,
				status: "ready",
				config: {
					minReferences: 1,
					maxReferences: 5,
					defaultReferences: 3,
				},
				capabilities: ownerCapabilities("block"),
				assetIds: [
					"asset-1",
				],
				assets: [],
			},
		],
		features: {},
	} as unknown as BotEditor);

/**
 * Plans and runs a save against recording procedures; the bot save echoes its
 * input, and `failing` names a procedure that rejects. With `listing`, the bot
 * is listed and its save asks to list the new repository until the answer to
 * the confirm lists it.
 */
const save = async ({
	values,
	baseline = botEditorBaseline(published()),
	status,
	failing,
	listing,
}: {
	values: Values;
	baseline?: Baseline;
	status?: PublicationStatus;
	failing?: "createBlock" | "updateBlock" | "saveBot";
	listing?: {
		confirms: boolean;
	};
}) => {
	const calls: [
		string,
		Record<string, unknown>,
	][] = [];
	const blocksSaved: BlockSaved[] = [];
	const plan = planBotEditorSave({
		values,
		baseline,
		status,
	});
	if (!plan) {
		return {
			calls,
			blocksSaved,
		};
	}

	const call = <T>(name: string, input: Record<string, unknown>, output: T) => {
		calls.push([
			name,
			input,
		]);
		if (
			name === "saveBot" &&
			listing &&
			(input.listBlockIds as BlockId[]).length === 0
		) {
			return Promise.reject(
				new ORPCError("BAD_REQUEST", {
					data: {
						reason: "LISTING_BLOCKS_UNCONFIRMED",
						params: {
							blocks: [
								{
									id: createdId,
									name: "New repository",
								},
							],
						},
					},
				}),
			);
		}
		return name === failing
			? Promise.reject(new Error(`${name} failed`))
			: Promise.resolve(output as never);
	};
	const confirmed: string[][] = [];
	const error = await executeBotEditorSave(
		{
			plan,
			onBlockSaved: (saved) => blocksSaved.push(saved),
			confirmListing: (blocks) => {
				confirmed.push(blocks.map((block) => block.name));
				return Promise.resolve(listing?.confirms ?? false);
			},
		},
		{
			createBlock: (input) =>
				call("createBlock", input, {
					data: {
						id: createdId,
					},
				}),
			updateBlock: (input) => call("updateBlock", input, undefined),
			saveBot: (input) =>
				call("saveBot", input, {
					data: {
						...values,
						templateBlock: null,
						databaseBlocks: [],
					},
				}),
		},
	).then(
		() => undefined,
		(error: unknown) => error,
	);
	return {
		calls,
		blocksSaved,
		confirmed,
		error,
	};
};

const names = ({ calls }: Awaited<ReturnType<typeof save>>) =>
	calls.map(([name]) => name);

const withRepository = (values: Values, name: string) => {
	const [repository] = values.databaseBlocks;
	if (repository) {
		values.databaseBlocks.push({
			...repository,
			id: undefined,
			name,
			status: "draft",
		});
	}
	return values;
};

const libraryBehaviour = () => {
	const behaviour = published().templateBlock;
	if (!behaviour) {
		throw new Error("The published bot has a behaviour");
	}
	return {
		...behaviour,
		id: libraryId,
		name: "Library behaviour",
	};
};

describe("saving the bot editor", () => {
	test("an unchanged bot writes nothing, also when saved as its own status", async () => {
		expect(
			names(
				await save({
					values: published(),
				}),
			),
		).toEqual([]);
		expect(
			names(
				await save({
					values: published(),
					status: "ready",
				}),
			),
		).toEqual([]);
	});

	test("a renamed bot saves only the bot", async () => {
		const values = published();
		values.name = "Renamed bot";

		const { calls } = await save({
			values,
		});

		expect(calls.map(([name]) => name)).toEqual([
			"saveBot",
		]);
		expect(calls[0]?.[1]).toMatchObject({
			name: "Renamed bot",
			status: "ready",
			templateBlockId: behaviourId,
			databaseBlockIds: [
				repositoryId,
			],
		});
	});

	test("an edited behaviour updates only that block", async () => {
		const values = published();
		if (values.templateBlock) {
			values.templateBlock.config = {
				systemPrompt: "Answer briefly.",
			};
		}

		const { calls } = await save({
			values,
		});

		expect(calls).toEqual([
			[
				"updateBlock",
				expect.objectContaining({
					id: behaviourId,
					status: "ready",
					config: {
						systemPrompt: "Answer briefly.",
					},
				}),
			],
		]);
	});

	test("a block the user cannot edit is never written", async () => {
		const saved = published();
		const values = published();
		for (const editor of [
			saved,
			values,
		]) {
			if (editor.templateBlock) {
				editor.templateBlock.capabilities = emptyCapabilities("block");
			}
		}
		if (values.templateBlock) {
			values.templateBlock.name = "Changed elsewhere";
		}

		expect(
			names(
				await save({
					values,
					baseline: botEditorBaseline(saved),
				}),
			),
		).toEqual([]);
	});

	test("a new repository is created, then linked by the bot", async () => {
		const { calls } = await save({
			values: withRepository(published(), "New repository"),
		});

		expect(calls.map(([name]) => name)).toEqual([
			"createBlock",
			"saveBot",
		]);
		expect(calls[1]?.[1]).toMatchObject({
			databaseBlockIds: [
				repositoryId,
				createdId,
			],
		});
	});

	test("an unchanged library block is linked without writing it", async () => {
		const values = published();
		values.templateBlock = libraryBehaviour();

		const { calls } = await save({
			values,
			baseline: withSavedBlock(
				botEditorBaseline(published()),
				libraryBehaviour(),
			),
		});

		expect(calls).toEqual([
			[
				"saveBot",
				expect.objectContaining({
					templateBlockId: libraryId,
				}),
			],
		]);
	});

	test("an edited library block is written with the bot that links it", async () => {
		const values = published();
		values.templateBlock = {
			...libraryBehaviour(),
			name: "Library behaviour, edited",
		};

		expect(
			names(
				await save({
					values,
					baseline: withSavedBlock(
						botEditorBaseline(published()),
						libraryBehaviour(),
					),
				}),
			),
		).toEqual([
			"updateBlock",
			"saveBot",
		]);
	});

	test("after a failed bot save, a retry writes only what is still unsaved", async () => {
		const values = withRepository(published(), "New repository");
		if (values.templateBlock) {
			values.templateBlock.name = "Edited behaviour";
		}

		const failed = await save({
			values,
			failing: "saveBot",
		});

		expect(failed.error).toBeInstanceOf(Error);
		expect(failed.blocksSaved).toEqual([
			expect.objectContaining({
				slot: "template",
				block: expect.objectContaining({
					id: behaviourId,
					name: "Edited behaviour",
				}),
			}),
			expect.objectContaining({
				slot: 1,
				block: expect.objectContaining({
					id: createdId,
				}),
			}),
		]);

		let baseline = botEditorBaseline(published());
		const retried = structuredClone(values);
		for (const { slot, block } of failed.blocksSaved) {
			baseline = withSavedBlock(baseline, block);
			const target =
				slot === "template"
					? retried.templateBlock
					: retried.databaseBlocks[slot];
			if (target) {
				target.id = block.id;
			}
		}

		const retry = await save({
			values: retried,
			baseline,
		});
		expect(retry.calls).toEqual([
			[
				"saveBot",
				expect.objectContaining({
					databaseBlockIds: [
						repositoryId,
						createdId,
					],
				}),
			],
		]);

		const reverted = structuredClone(retried);
		if (reverted.templateBlock) {
			reverted.templateBlock.name = "Course behaviour";
		}
		expect(
			names(
				await save({
					values: reverted,
					baseline,
				}),
			),
		).toEqual([
			"updateBlock",
			"saveBot",
		]);
	});

	test("a failed block write reports nothing for it", async () => {
		const values = published();
		if (values.templateBlock) {
			values.templateBlock.name = "Edited behaviour";
		}

		const failed = await save({
			values,
			failing: "updateBlock",
		});

		expect(failed.error).toBeInstanceOf(Error);
		expect(failed.blocksSaved).toEqual([]);
	});

	test("saving a published bot as draft saves only the bot", async () => {
		const { calls } = await save({
			values: published(),
			status: "draft",
		});

		expect(calls).toEqual([
			[
				"saveBot",
				expect.objectContaining({
					status: "draft",
				}),
			],
		]);
	});

	test("a new bot is always saved", async () => {
		expect(
			names(
				await save({
					values: toBotEditorFormValues(),
					baseline: botEditorBaseline(toBotEditorFormValues()),
				}),
			),
		).toEqual([
			"saveBot",
		]);
	});

	test("a listed bot lists the blocks it gains once the author confirms them", async () => {
		const result = await save({
			values: withRepository(published(), "New repository"),
			listing: {
				confirms: true,
			},
		});

		expect(result.confirmed).toEqual([
			[
				"New repository",
			],
		]);
		expect(result.error).toBeUndefined();
		expect(result.calls.at(-1)).toEqual([
			"saveBot",
			expect.objectContaining({
				listBlockIds: [
					createdId,
				],
			}),
		]);
	});

	test("declining to list the blocks fails the save and keeps the created block", async () => {
		const result = await save({
			values: withRepository(published(), "New repository"),
			listing: {
				confirms: false,
			},
		});

		expect(result.error).toBeInstanceOf(ORPCError);
		expect(names(result)).toEqual([
			"createBlock",
			"saveBot",
		]);
		expect(result.blocksSaved.map((saved) => saved.block.id)).toEqual([
			createdId,
		]);
	});
});
