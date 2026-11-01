import type { BlockId } from "@orcai/core";
import type {
	ErrorReasonParams,
	PublicationStatus,
	SaveBotInput,
} from "@orcai/schema";
import type { InferClientInputs, InferClientOutputs } from "@orpc/client";
import { evaluate } from "@tanstack/react-form";
import {
	type BotEditorFormValues,
	toBotEditorFormValues,
} from "@/components/authoring/bot-editor-form-options";
import { hasCapability } from "@/lib/authz/capabilities";
import { errorReasonOf } from "@/lib/errors/describe-error";
import type { client } from "@/lib/orpc/orpc";

type TemplateBlockValues = NonNullable<BotEditorFormValues["templateBlock"]>;
type DatabaseBlockValues = BotEditorFormValues["databaseBlocks"][number];

export const toTemplateBlockInput = (block: TemplateBlockValues) => ({
	name: block.name,
	description: block.description.trim() ? block.description : null,
	contentJson: block.contentJson ?? null,
	type: "template" as const,
	status: block.status,
	config: block.config,
});

export const toDatabaseBlockInput = (block: DatabaseBlockValues) => ({
	name: block.name,
	description: block.description.trim() ? block.description : null,
	contentJson: block.contentJson ?? null,
	type: "database" as const,
	status: block.status,
	config: block.config,
	assets: block.assetIds ?? [],
	uploadRunIds: block.uploadRunIds,
});

const toBlockInput = (block: TemplateBlockValues | DatabaseBlockValues) =>
	block.type === "template"
		? toTemplateBlockInput(block)
		: toDatabaseBlockInput(block);

type BlockValues = TemplateBlockValues | DatabaseBlockValues;

/**
 * What the server holds: the bot as last saved, and every block the editor
 * knows by id, linked or not yet.
 */
export type BotEditorBaseline = {
	bot: BotEditorFormValues;
	blocks: ReadonlyMap<BlockId, BlockValues>;
};

export const botEditorBaseline = (
	bot: BotEditorFormValues,
): BotEditorBaseline => ({
	bot,
	blocks: new Map(
		[
			...(bot.templateBlock
				? [
						bot.templateBlock,
					]
				: []),
			...bot.databaseBlocks,
		].flatMap((block) =>
			block.id
				? [
						[
							block.id,
							block,
						] as const,
					]
				: [],
		),
	),
});

/** The baseline once the server holds `block` as given. */
export const withSavedBlock = (
	baseline: BotEditorBaseline,
	block: BlockValues & {
		id: BlockId;
	},
): BotEditorBaseline => ({
	bot:
		block.type === "template"
			? {
					...baseline.bot,
					templateBlock:
						baseline.bot.templateBlock?.id === block.id
							? block
							: baseline.bot.templateBlock,
				}
			: {
					...baseline.bot,
					databaseBlocks: baseline.bot.databaseBlocks.map((saved) =>
						saved.id === block.id ? block : saved,
					),
				},
	blocks: new Map(baseline.blocks).set(block.id, block),
});

type BlockWrite = "create" | "update" | null;

/** A new block is created; a known one is written when it is editable and differs from what the server holds. */
const blockWrite = (
	block: BlockValues,
	blocks: BotEditorBaseline["blocks"],
): BlockWrite => {
	if (!block.id) {
		return "create";
	}
	if (!hasCapability(block.capabilities, "edit")) {
		return null;
	}
	const before = blocks.get(block.id);

	return before && evaluate(toBlockInput(block), toBlockInput(before))
		? null
		: "update";
};

const botFields = (values: BotEditorFormValues, status: PublicationStatus) => ({
	name: values.name,
	description: values.description,
	contentJson: values.contentJson,
	status,
	features: values.features,
	templateBlockId: values.templateBlock?.id,
	databaseBlockIds: values.databaseBlocks.map((block) => block.id),
});

export type BotEditorSavePlan = {
	values: BotEditorFormValues;
	status: PublicationStatus;
	templateBlock: BlockWrite;
	databaseBlocks: BlockWrite[];
	bot: boolean;
};

/**
 * What saving `values` over the `baseline` writes, or null when nothing
 * changed. A new bot is always saved, and so is the bot that links a new block.
 */
export const planBotEditorSave = ({
	values,
	baseline,
	status = values.status,
}: {
	values: BotEditorFormValues;
	baseline: BotEditorBaseline;
	status?: PublicationStatus;
}): BotEditorSavePlan | null => {
	const templateBlock = values.templateBlock
		? blockWrite(values.templateBlock, baseline.blocks)
		: null;
	const databaseBlocks = values.databaseBlocks.map((block) =>
		blockWrite(block, baseline.blocks),
	);
	const blockWrites = [
		templateBlock,
		...databaseBlocks,
	];
	const bot =
		!values.id ||
		blockWrites.includes("create") ||
		!evaluate(
			botFields(values, status),
			botFields(baseline.bot, baseline.bot.status),
		);

	return bot || blockWrites.includes("update")
		? {
				values,
				status,
				templateBlock,
				databaseBlocks,
				bot,
			}
		: null;
};

type Inputs = InferClientInputs<typeof client>;
type Outputs = InferClientOutputs<typeof client>;

type BotEditorProcedures = {
	createBlock: (
		input: Inputs["block"]["create"],
	) => Promise<Outputs["block"]["create"]>;
	updateBlock: (input: Inputs["block"]["update"]) => Promise<unknown>;
	saveBot: (input: Inputs["bot"]["save"]) => Promise<Outputs["bot"]["save"]>;
};

/** A block write the server committed; `slot` is "template" or the repository's index. */
export type BotEditorBlockSaved = {
	slot: "template" | number;
	block: BlockValues & {
		id: BlockId;
	};
	zedToken?: string;
};

type UnlistedBlock = {
	id: BlockId;
	name: string;
};

/** The unlisted blocks a listed bot's save asks to list with it, if that is why it failed. */
const unlistedBlocksOf = (error: unknown): UnlistedBlock[] | undefined => {
	const ref = errorReasonOf(error);
	return ref?.reason === "LISTING_BLOCKS_UNCONFIRMED"
		? (
				ref.params as ErrorReasonParams["LISTING_BLOCKS_UNCONFIRMED"]
			).blocks.map((block) => ({
				id: block.id as BlockId,
				name: block.name,
			}))
		: undefined;
};

/**
 * Writes a plan: blocks first, so the bot links the ids of new ones. Reports
 * each committed block write through `onBlockSaved`, so a later failure leaves
 * the caller knowing what the server already holds. Resolves with the saved
 * state and the newest zedToken.
 */
export const executeBotEditorSave = async (
	{
		plan,
		zedToken,
		onBlockSaved,
		confirmListing,
	}: {
		plan: BotEditorSavePlan;
		zedToken?: string;
		onBlockSaved: (saved: BotEditorBlockSaved) => void;
		confirmListing: (blocks: UnlistedBlock[]) => Promise<boolean>;
	},
	procedures: BotEditorProcedures,
) => {
	let token = zedToken;

	const writeBlock = async <Block extends BlockValues>(
		block: Block,
		write: BlockWrite,
		slot: BotEditorBlockSaved["slot"],
	): Promise<Block> => {
		if (write === null) {
			return block;
		}
		let id = block.id;
		if (write === "update" && id) {
			await procedures.updateBlock({
				id,
				...toBlockInput(block),
			});
		} else {
			const created = await procedures.createBlock(toBlockInput(block));
			token = created.meta?.zedToken ?? token;
			id = created.data.id;
		}
		const saved = {
			...block,
			id,
		};
		onBlockSaved({
			slot,
			block: saved,
			zedToken: token,
		});

		return saved;
	};

	const templateBlock = plan.values.templateBlock
		? await writeBlock(
				plan.values.templateBlock,
				plan.templateBlock,
				"template",
			)
		: null;
	const databaseBlocks: DatabaseBlockValues[] = [];
	for (const [index, block] of plan.values.databaseBlocks.entries()) {
		databaseBlocks.push(
			await writeBlock(block, plan.databaseBlocks[index] ?? null, index),
		);
	}

	if (!plan.bot) {
		return {
			values: plan.values,
			zedToken: token,
		};
	}

	const saveBot = (listBlockIds: BlockId[]) =>
		procedures.saveBot({
			zedToken: token,
			id: plan.values.id,
			name: plan.values.name,
			description: plan.values.description,
			contentJson: plan.values.contentJson as SaveBotInput["contentJson"],
			status: plan.status,
			templateBlockId: templateBlock?.id ?? null,
			databaseBlockIds: databaseBlocks.flatMap((block) =>
				block.id
					? [
							block.id,
						]
					: [],
			),
			features: plan.values.features,
			listBlockIds,
		});
	// A listed bot lists the blocks it gains, once the author confirms them.
	const saved = await saveBot([]).catch(async (error: unknown) => {
		const unlisted = unlistedBlocksOf(error);
		if (!unlisted || !(await confirmListing(unlisted))) {
			throw error;
		}
		return saveBot(unlisted.map((block) => block.id));
	});

	return {
		values: toBotEditorFormValues(saved.data),
		zedToken: saved.meta?.zedToken ?? token,
	};
};
