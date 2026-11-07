import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import type {
	generateText,
	LanguageModel,
	ModelMessage,
	OutputInterface,
} from "ai";
import { jsonAnswerModel } from "./json-answer";

/** What a call's structured output may be. */
export type CallOutput = OutputInterface;

/** One background call as its model receives it, built for the model's provider kind. */
export interface CallSpec<
	OUTPUT extends OutputInterface = OutputInterface<string, string>,
> {
	/** Names the call in telemetry and in its errors. */
	readonly operation: string;
	readonly instructions: string;
	readonly prompt: string | ModelMessage[];
	/** Structured output; a reply that does not match fails. */
	readonly output?: OUTPUT;
	readonly maxOutputTokens: number | undefined;
	readonly reasoning?: Parameters<typeof generateText>[0]["reasoning"];
	readonly timeoutMs?: number;
	readonly providerOptions: SharedV4ProviderOptions | undefined;
}

/** The request `call` makes of `model`; structured output reads the object out of a code fence too. */
export const callRequest = <OUTPUT extends OutputInterface>(
	model: LanguageModel,
	call: CallSpec<OUTPUT>,
) => ({
	model: call.output ? jsonAnswerModel(model) : model,
	instructions: call.instructions,
	prompt: call.prompt,
	output: call.output,
	maxOutputTokens: call.maxOutputTokens,
	reasoning: call.reasoning,
	providerOptions: call.providerOptions,
	...(call.timeoutMs !== undefined && {
		timeout: {
			totalMs: call.timeoutMs,
		},
	}),
});
