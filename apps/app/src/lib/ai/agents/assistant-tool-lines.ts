import type { NameOf } from "@/lib/ai/tools/declaration";
import { NAME_FIELDS } from "@/lib/ai/tools/entity-kind";
import { toolSummary } from "@/lib/ai/tools/registry";
import { withLocale } from "@/lib/presentation/with-locale";

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
		text?: string;
		kind?: string;
		providerMetadata?: unknown;
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
		const name = NAME_FIELDS.map((key) => value[key]).find(
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

const lineOf = ({ toolName, input, output }: ToolExecution, nameOf: NameOf) => {
	const summary = toolSummary(toolName, {
		input,
		output,
	});

	// The model reads English.
	return summary && withLocale("en", () => summary.line(nameOf));
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
