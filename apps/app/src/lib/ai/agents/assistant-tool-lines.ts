import { toolSummaryByName } from "@/components/assistant/tool-summary-registry";
import type { NameOf } from "@/lib/ai/tools/assistant/summary";
import { getServerAsyncLocalStorage } from "@/paraglide/runtime";

/** One tool call that returned an output. */
export interface ToolExecution {
	toolCallId: string;
	toolName: string;
	input: unknown;
	output: unknown;
}

/** A stored UI message, typed structurally so the agent's signature does not depend on its own message type. */
export interface StoredMessage {
	parts: readonly {
		type: string;
		toolCallId?: string;
		state?: string;
		input?: unknown;
		output?: unknown;
	}[];
}

/** The stored tool calls that returned an output, in conversation order. */
export const storedExecutions = (
	history: readonly StoredMessage[],
): ToolExecution[] =>
	history.flatMap((message) =>
		message.parts.flatMap((part) =>
			part.type.startsWith("tool-") &&
			part.toolCallId !== undefined &&
			part.state === "output-available"
				? [
						{
							toolCallId: part.toolCallId,
							toolName: part.type.slice("tool-".length),
							input: part.input,
							output: part.output,
						},
					]
				: [],
		),
	);

const NAME_KEYS = [
	"name",
	"title",
	"email",
] as const;
const MAX_NAME_DEPTH = 6;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const collectNames = (
	value: unknown,
	names: Map<string, string>,
	depth = 0,
) => {
	if (depth > MAX_NAME_DEPTH || !isRecord(value)) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectNames(item, names, depth + 1);
		}
		return;
	}

	if (typeof value.id === "string" && !names.has(value.id)) {
		const name = NAME_KEYS.map((key) => value[key]).find(
			(candidate) => typeof candidate === "string" && candidate !== "",
		);
		if (typeof name === "string") {
			names.set(value.id, name);
		}
	}

	for (const nested of Object.values(value)) {
		collectNames(nested, names, depth + 1);
	}
};

/** The model reads English; the request's locale lives in Paraglide's AsyncLocalStorage. */
const inEnglish = (line: () => string): string => {
	const storage = getServerAsyncLocalStorage();

	return storage
		? storage.run(
				{
					...storage.getStore(),
					locale: "en",
				},
				line,
			)
		: line();
};

const docsLine = (output: unknown) => {
	if (!isRecord(output) || typeof output.path !== "string") {
		return "Read the docs index";
	}

	return typeof output.title === "string"
		? `Read the docs page “${output.title}” (${output.path})`
		: `Read the docs page ${output.path}`;
};

const lineOf = (execution: ToolExecution, nameOf: NameOf) => {
	if (execution.toolName === "readDocs") {
		return docsLine(execution.output);
	}

	const summary = toolSummaryByName(execution.toolName);
	if (!summary) {
		return undefined;
	}

	const part = {
		type: `tool-${execution.toolName}`,
		toolCallId: execution.toolCallId,
		state: "output-available",
		input: execution.input,
		output: execution.output,
	} as unknown as Parameters<typeof summary.line>[0];

	try {
		return inEnglish(() => summary.line(part, nameOf));
	} catch {
		// Stored outputs of an older shape fall back to the generic line.
		return undefined;
	}
};

/**
 * The work-log summary line of every tool output, keyed by tool call id.
 * Names come from the inputs and outputs seen so far, otherwise the id.
 */
export const createToolLines = (history: readonly StoredMessage[]) => {
	const names = new Map<string, string>();
	const lines = new Map<string, string>();
	const nameOf: NameOf = (ref) => names.get(ref.id) ?? ref.id;

	const record = (executions: readonly ToolExecution[]) => {
		for (const execution of executions) {
			collectNames(execution.input, names);
			collectNames(execution.output, names);
		}
		for (const execution of executions) {
			const line = lineOf(execution, nameOf);
			if (line !== undefined) {
				lines.set(execution.toolCallId, line);
			}
		}
	};

	record(storedExecutions(history));

	return {
		lines: lines as ReadonlyMap<string, string>,
		record,
	};
};
