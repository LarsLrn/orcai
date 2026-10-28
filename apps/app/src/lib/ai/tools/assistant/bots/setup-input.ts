import type { BotId } from "@orcai/core";
import {
	type BotSetup,
	botSetupStrengthSchema,
	generationSettingsSchema,
	modelIdSchema,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { z } from "zod/v4";
import { toolErrorText } from "@/lib/ai/tools/tool-error";
import {
	type AssistantToolDeps,
	callProcedure,
	mutation,
} from "../procedure-tool";

export const setupInputSchema = z
	.strictObject({
		modelId: modelIdSchema.describe(
			"Id of a chat model of the active organisation, from findModels.",
		),
		strength: botSetupStrengthSchema
			.default("recommended")
			.describe(
				"recommended seeds new chats and lets people switch; required makes every chat use the model and settings, also existing ones.",
			),
		generation: z
			.strictObject(generationSettingsSchema.shape)
			.default({})
			.describe(
				"Optional temperature, topP, maxTokens, frequencyPenalty and presencePenalty; leave out to keep the provider's defaults.",
			),
	})
	.nullable()
	.describe(
		"The bot's model in the active organisation; null removes it so chats pick freely. Leave out to keep it.",
	);

/** What a bot tool tells the model about a setup, with how many of the bot's audience a pool covers. */
const setupOutline = (
	setup: BotSetup,
	coverage:
		| {
				principals: {
					principal: {
						name: string;
					};
					covered: boolean;
				}[];
		  }
		| undefined,
) => ({
	model: setup.model && {
		id: setup.model.id,
		name: setup.model.name,
		usable: setup.model.usable,
	},
	strength: setup.strength,
	generation: setup.generation,
	coverage: coverage && {
		covered: coverage.principals.filter((entry) => entry.covered).length,
		total: coverage.principals.length,
		notCovered: coverage.principals
			.filter((entry) => !entry.covered)
			.map((entry) => entry.principal.name),
	},
});

/** The coverage of the setup's model, read only for setup editors. */
const coverageOf = (
	deps: AssistantToolDeps,
	botId: BotId,
	setup: BotSetup,
	canEdit: boolean,
) =>
	setup.model && canEdit
		? callProcedure(deps, (procedures, options) =>
				procedures.botSetup.coverage(
					{
						botId,
						// biome-ignore lint/style/noNonNullAssertion: checked above
						modelId: setup.model!.id,
					},
					options,
				),
			).pipe(Effect.map(({ data }) => data))
		: Effect.succeed(undefined);

/** Reads the bot's setup in the active organisation; editors also get its coverage. */
export const readSetup = (deps: AssistantToolDeps, botId: BotId) =>
	Effect.gen(function* () {
		const {
			data: { setup, canEdit },
		} = yield* callProcedure(deps, (procedures, options) =>
			procedures.botSetup.find(
				{
					botId,
				},
				options,
			),
		);
		if (!setup) return null;
		return setupOutline(setup, yield* coverageOf(deps, botId, setup, canEdit));
	});

/**
 * Saves or removes the setup through the shared writer, as the Model step
 * does. The bot is saved by then, so any failure, also of reading the
 * coverage, is reported next to it as `setupError` instead of failing the tool.
 */
export const writeSetup = (
	deps: AssistantToolDeps,
	botId: BotId,
	input: z.infer<typeof setupInputSchema>,
) =>
	Effect.gen(function* () {
		const saved = yield* Effect.result(
			callProcedure(deps, (procedures, options) =>
				procedures.botSetup.save(
					{
						botId,
						setup: input,
					},
					options,
				),
			).pipe(mutation("getBot")),
		);
		if (Result.isFailure(saved)) {
			return {
				setupError: toolErrorText(saved.failure),
			};
		}
		const setup = saved.success.data;
		if (!setup) {
			return {
				setup,
			};
		}
		const coverage = yield* Effect.result(coverageOf(deps, botId, setup, true));
		return Result.isSuccess(coverage)
			? {
					setup: setupOutline(setup, coverage.success),
				}
			: {
					setup: setupOutline(setup, undefined),
					setupError: `The setup was saved, but its coverage could not be read: ${toolErrorText(coverage.failure)}`,
				};
	});
