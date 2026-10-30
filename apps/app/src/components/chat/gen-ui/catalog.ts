import { type Tool, tool } from "ai";
import {
	GraduationCapIcon,
	Grid3x3Icon,
	ListChecksIcon,
	type LucideIcon,
	SpellCheckIcon,
} from "lucide-react";
import type { z } from "zod/v4";
import { readChecklist } from "@/components/chat/gen-ui/checklist/read";
import { checklistSchema } from "@/components/chat/gen-ui/checklist/schema";
import { checklistToMarkdown } from "@/components/chat/gen-ui/checklist/to-markdown";
import { readMatrix } from "@/components/chat/gen-ui/matrix/cells";
import { matrixSchema } from "@/components/chat/gen-ui/matrix/schema";
import { matrixToMarkdown } from "@/components/chat/gen-ui/matrix/to-markdown";
import { readQuizResult } from "@/components/chat/gen-ui/quiz-result/read";
import { quizResultToMarkdown } from "@/components/chat/gen-ui/quiz-result/to-markdown";
import { readReview } from "@/components/chat/gen-ui/review/findings";
import { reviewSchema } from "@/components/chat/gen-ui/review/schema";
import { reviewToMarkdown } from "@/components/chat/gen-ui/review/to-markdown";
import { toolInputSchema } from "@/lib/ai/tools/input-schema";
import {
	quizGradingSchema,
	showQuizResultDescription,
} from "@/lib/ai/tools/questions/quiz-result";
import { m } from "@/paraglide/messages";

interface PrimitiveEntry<Schema extends z.ZodType, View> {
	schema: Schema;
	description: string;
	/** Reads any input, streamed, stored or invalid, and the output once the call ran, into what the renderer and markdown show. */
	read: (input: unknown, output?: unknown) => View;
	toMarkdown: (view: View) => string;
	/** Work-log label */
	icon: LucideIcon;
	name: () => string;
	active: () => string;
}

const primitive = <Schema extends z.ZodType, View>(
	entry: PrimitiveEntry<Schema, View>,
) => entry;

/** The primitives of the Generative UI feature. */
const genUiEntries = {
	showChecklist: primitive({
		schema: checklistSchema,
		description:
			"Show a checklist in your answer: a list of items, each with an optional status (met, partial, not_met, n_a), a one-line summary, and an expandable explanation with an optional quoted passage. Use it when you check something against a list of criteria or requirements, one row per criterion or per checked item. Leave out status for a plain list of expandable points. Use one call per list.",
		read: readChecklist,
		toMarkdown: checklistToMarkdown,
		icon: ListChecksIcon,
		name: () => m.chat_work_log_tool_show_checklist_name(),
		active: () => m.chat_work_log_tool_show_checklist_active(),
	}),
	showReview: primitive({
		schema: reviewSchema,
		description:
			"Show a review in your answer: one or more texts checked against rules or a guide, each with findings on specific passages and, where useful, a corrected version. Use it when the user asks you to check texts such as references, outcomes or paragraphs against rules, one item per text. Quote each excerpt exactly from its item's text. Put observations not tied to one text in `general`. Use one call per review.",
		read: readReview,
		toMarkdown: reviewToMarkdown,
		icon: SpellCheckIcon,
		name: () => m.chat_work_log_tool_show_review_name(),
		active: () => m.chat_work_log_tool_show_review_active(),
	}),
	showMatrix: primitive({
		schema: matrixSchema,
		description:
			"Show a matrix in your answer: several items checked against the same set of criteria, as a grid of statuses (met, partial, not_met, n_a). Use it when a grid reads better than one review per item: one row per item, one column per criterion, and a note on any cell that needs explaining. Use one call per grid.",
		read: readMatrix,
		toMarkdown: matrixToMarkdown,
		icon: Grid3x3Icon,
		name: () => m.chat_work_log_tool_show_matrix_name(),
		active: () => m.chat_work_log_tool_show_matrix_active(),
	}),
};

const entries = {
	...genUiEntries,
	// The questions feature builds it, since it grades the conversation's quiz.
	showQuizResult: primitive({
		schema: quizGradingSchema,
		description: showQuizResultDescription,
		read: readQuizResult,
		toMarkdown: quizResultToMarkdown,
		icon: GraduationCapIcon,
		name: () => m.chat_work_log_tool_show_quiz_result_name(),
		active: () => m.chat_work_log_tool_show_quiz_result_active(),
	}),
};

type Entries = typeof entries;

export type DisplayToolName = keyof Entries;

export type DisplayView<Name extends DisplayToolName> = ReturnType<
	Entries[Name]["read"]
>;

/**
 * Display tools keyed by tool name, in the order they are offered. Mapped so
 * that indexing with a generic name keeps each entry's reader and markdown
 * paired.
 */
export const primitiveCatalog: {
	[Name in DisplayToolName]: PrimitiveEntry<
		Entries[Name]["schema"],
		DisplayView<Name>
	>;
} = entries;

type DisplayToolInput<Name extends DisplayToolName> = z.infer<
	(typeof primitiveCatalog)[Name]["schema"]
>;

type GenUiToolName = keyof typeof genUiEntries;

export type GenUiTools = {
	[Name in GenUiToolName]: Tool<
		DisplayToolInput<Name>,
		{
			shown: true;
		}
	>;
};

const displayTool = ({
	schema,
	description,
}: Pick<PrimitiveEntry<z.ZodType, unknown>, "schema" | "description">) =>
	tool({
		description,
		inputSchema: toolInputSchema(schema),
		execute: async () => ({
			shown: true as const,
		}),
	});

export const buildGenUiTools = (): GenUiTools =>
	Object.fromEntries(
		Object.entries(genUiEntries).map(([name, entry]) => [
			name,
			displayTool(entry),
		]),
	) as GenUiTools;

/**
 * Markdown of the reader's view of a display call: validated input when it
 * parses, the raw input otherwise. Null when it throws or is empty.
 */
export const displayToolMarkdown = <Name extends DisplayToolName>(
	name: Name,
	input: unknown,
	output?: unknown,
): string | null => {
	const { schema, read, toMarkdown } = primitiveCatalog[name];
	const parsed = schema.safeParse(input);
	try {
		const markdown = toMarkdown(
			read(parsed.success ? parsed.data : input, output),
		).trim();
		return markdown === "" ? null : markdown;
	} catch {
		return null;
	}
};
