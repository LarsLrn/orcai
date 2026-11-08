import { isToolUIPart, type Tool, type ToolSet, type UIMessage } from "ai";
import * as Context from "effect/Context";
import { toolDeclarationOf } from "../registry";

/**
 * How long a stopped turn waits for its running calls before the reply is
 * stored. A change takes milliseconds, so the bound only matters for a hung
 * one; the client looks for the stored reply for 10 seconds.
 */
const RUNNING_CALLS_WAIT_MS = 5_000;

const runningCallsTimeout = () => AbortSignal.timeout(RUNNING_CALLS_WAIT_MS);

/** Aborts when a stopped turn waited long enough for its running calls. */
export const RunningCallsWait = Context.Reference<() => AbortSignal>(
	"RunningCallsWait",
	{
		defaultValue: () => runningCallsTimeout,
	},
);

/** The calls of an Assistant turn, which a stop can leave running after the stream ends. */
export interface RunningCalls {
	/**
	 * Runs a call that changes something to its end, whatever stops the turn,
	 * and keeps what each call returns.
	 */
	wrap: <T extends ToolSet>(tools: T) => T;
	/** Waits for the calls still running until the wait bound aborts. */
	settled: () => Promise<void>;
	/** Gives a call the stream ended before the output it returned since. */
	finish: (parts: UIMessage["parts"]) => UIMessage["parts"];
}

const changes = (name: string) => {
	const kind = toolDeclarationOf(name)?.kind;

	return kind === "create" || kind === "change";
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	typeof value === "object" &&
	value !== null &&
	"then" in value &&
	typeof value.then === "function";

export const createRunningCalls = (
	waitBound = runningCallsTimeout,
): RunningCalls => {
	const running = new Set<Promise<void>>();
	const outputs = new Map<string, unknown>();

	const wrapTool = (name: string, tool: Tool): Tool => {
		const { execute } = tool;
		if (execute === undefined) return tool;
		const writes = changes(name);

		return {
			...tool,
			execute: (input, options) => {
				const result = execute(
					input,
					writes
						? {
								...options,
								abortSignal: undefined,
							}
						: options,
				);
				if (isPromiseLike(result)) {
					const call = Promise.resolve(result).then(
						(output) => {
							outputs.set(options.toolCallId, output);
						},
						() => undefined,
					);
					running.add(call);
					void call.then(() => running.delete(call));
				}
				return result;
			},
		};
	};

	return {
		wrap: (tools) =>
			Object.fromEntries(
				Object.entries(tools).map(([name, tool]) => [
					name,
					wrapTool(name, tool),
				]),
			) as typeof tools,
		settled: async () => {
			const bound = waitBound();
			if (bound.aborted) return;
			await Promise.race([
				Promise.all(running),
				new Promise((resolve) =>
					bound.addEventListener("abort", resolve, {
						once: true,
					}),
				),
			]);
		},
		finish: (parts) =>
			parts.map((part) =>
				isToolUIPart(part) &&
				part.state === "input-available" &&
				outputs.has(part.toolCallId)
					? {
							...part,
							state: "output-available",
							output: outputs.get(part.toolCallId),
						}
					: part,
			),
	};
};
