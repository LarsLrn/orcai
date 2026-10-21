import { useQueries } from "@tanstack/react-query";
import { getToolName } from "ai";
import { createContext, use } from "react";
import type { NameOf } from "@/lib/ai/tools/declaration";
import { type EntityRef, nameQuery } from "@/lib/ai/tools/entity-kind";
import { toolLabels, toolSummary } from "@/lib/ai/tools/registry";
import type { ToolPart } from "@/lib/ai/turn-view/turn-view";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const refKey = (ref: EntityRef) => `${ref.kind}:${ref.id}`;

/** The newest zedToken of the message's turn, so things it created can be named. */
export const TurnZedTokenContext = createContext<string | undefined>(undefined);

/**
 * The part's summary line, with the ids it names looked up through their
 * `find` queries. Before the input is complete it is the tool's name.
 */
export const useToolSummaryLine = (part: ToolPart): string => {
	const zedToken = use(TurnZedTokenContext);
	const summary =
		part.state === "input-streaming"
			? undefined
			: toolSummary(getToolName(part), {
					input: part.input,
					output: part.state === "output-available" ? part.output : undefined,
				});
	const refs = [
		...new Map(
			(summary?.refs ?? []).map((ref) => [
				refKey(ref),
				ref,
			]),
		).values(),
	];
	const names = useQueries({
		queries: refs.map((ref) => ({
			...nameQuery(orpc, ref, zedToken),
			retry: false,
		})),
		combine: (results) =>
			new Map(
				results.map((result, index) => [
					refKey(refs[index] as EntityRef),
					result.isPending
						? m.assistant_tool_name_loading()
						: (result.data ?? m.assistant_tool_name_unavailable()),
				]),
			),
	});
	const nameOf: NameOf = (ref) =>
		names.get(refKey(ref)) ?? m.assistant_tool_name_unavailable();

	return summary?.line(nameOf) ?? toolLabels(part).name;
};
