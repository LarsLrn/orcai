import type { Schema, ToolExecutionOptions, ToolResultPart } from "ai";
import type * as Effect from "effect/Effect";
import type { z } from "zod/v4";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { toolInputSchema } from "./input-schema";
import { runAssistantTool } from "./tool-error";

/**
 * The tool context of every chat tool. Left to inference, a `toModelOutput`
 * that reads the output widens the context type and breaks the agent's settings.
 */
export type NoToolContext = Record<string, never>;

/**
 * A function tool, typed without the SDK's conditional `Tool` types, which do
 * not resolve over a generic input and output. With concrete ones it is a `Tool`.
 */
export interface AssistantTool<Input, Output> {
	description: string;
	inputSchema: Schema<Input>;
	execute: (
		input: Input,
		options: ToolExecutionOptions<NoToolContext>,
	) => Output | PromiseLike<Output>;
	toModelOutput?: (options: {
		toolCallId: string;
		input: Input;
		output: Output;
	}) => ToolResultPart["output"];
}

type Definition<Input, Output> = Omit<
	AssistantTool<Input, Output>,
	"inputSchema"
> & {
	inputSchema: z.ZodType<Input>;
};

export const assistantTool = <Input, Output>({
	inputSchema,
	...definition
}: Definition<Input, Output>): AssistantTool<Input, Output> => ({
	...definition,
	inputSchema: toolInputSchema(inputSchema),
});

/**
 * A tool whose call runs `run` with the services of `context` and the call's
 * abort signal. A failure or defect becomes the tool error the model reads.
 */
export const effectTool = <Input, Output>({
	context,
	run,
	...definition
}: Omit<Definition<Input, Output>, "execute"> & {
	context: ORPCContext;
	run: (
		input: Input,
		options: ToolExecutionOptions<NoToolContext>,
	) => Effect.Effect<Output, unknown, AppRuntimeContext>;
}): AssistantTool<Input, Output> =>
	assistantTool({
		...definition,
		execute: (input, options) =>
			runAssistantTool(run(input, options), {
				context,
				abortSignal: options.abortSignal,
			}),
	});
