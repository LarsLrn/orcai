import { type DeepPartial, type Tool, tool } from "ai";
import type { z } from "zod/v4";
import { checklistSchema } from "@/components/chat/gen-ui/checklist/schema";
import { checklistToMarkdown } from "@/components/chat/gen-ui/checklist/to-markdown";

interface PrimitiveEntry<Schema extends z.ZodType> {
	schema: Schema;
	description: string;
	/** Tolerates missing fields, so it also serves invalid stored input. */
	toMarkdown: (input: DeepPartial<z.infer<Schema>>) => string;
}

const primitive = <Schema extends z.ZodType>(entry: PrimitiveEntry<Schema>) =>
	entry;

/** Display tools keyed by tool name, in the order they are offered. */
export const primitiveCatalog = {
	showChecklist: primitive({
		schema: checklistSchema,
		description:
			"Show a checklist in your answer: a list of items, each with an optional status (met, partial, not_met, n_a), a one-line summary, and an expandable explanation with an optional quoted passage. Use it when you check something against a list of criteria or requirements, one row per criterion or per checked item. Leave out status for a plain list of expandable points. Use one call per list and do not repeat its content in text.",
		toMarkdown: checklistToMarkdown,
	}),
};

export type DisplayToolName = keyof typeof primitiveCatalog;

export type DisplayToolInput<Name extends DisplayToolName> = z.infer<
	(typeof primitiveCatalog)[Name]["schema"]
>;

export const GEN_UI_TOOL_NAMES = Object.keys(
	primitiveCatalog,
) as DisplayToolName[];

export type GenUiTools = {
	[Name in DisplayToolName]: Tool<
		DisplayToolInput<Name>,
		{
			shown: true;
		}
	>;
};

export const buildGenUiTools = (): GenUiTools =>
	Object.fromEntries(
		GEN_UI_TOOL_NAMES.map((name) => {
			const { schema, description } = primitiveCatalog[name];
			return [
				name,
				tool({
					description,
					inputSchema: schema,
					execute: async () => ({
						shown: true as const,
					}),
				}),
			];
		}),
	) as GenUiTools;

const isDisplayToolName = (name: string): name is DisplayToolName =>
	Object.hasOwn(primitiveCatalog, name);

export const displayToolNameOf = (
	type: string,
): DisplayToolName | undefined => {
	const name = type.replace(/^tool-/, "");
	return type.startsWith("tool-") && isDisplayToolName(name) ? name : undefined;
};

export const isDisplayToolPart = <
	Part extends {
		type: string;
	},
>(
	part: Part,
): part is Extract<
	Part,
	{
		type: `tool-${DisplayToolName}`;
	}
> => displayToolNameOf(part.type) !== undefined;

/**
 * Markdown for a display call's input: validated input when it parses, the
 * raw input otherwise. Null when `toMarkdown` throws or yields nothing.
 */
export const displayToolMarkdown = (
	name: DisplayToolName,
	input: unknown,
): string | null => {
	const { schema, toMarkdown } = primitiveCatalog[name];
	const parsed = schema.safeParse(input);
	try {
		const markdown = toMarkdown(
			(parsed.success ? parsed.data : (input ?? {})) as DeepPartial<
				DisplayToolInput<typeof name>
			>,
		).trim();
		return markdown === "" ? null : markdown;
	} catch {
		return null;
	}
};
