import type {
	AssetId,
	BlockId,
	BotId,
	GroupId,
	OrganizationInvitationId,
	UserId,
} from "@orcai/core";
import { useQueries } from "@tanstack/react-query";
import { createContext, use } from "react";
import {
	type SummarisedToolPart,
	toolSummaryOf,
} from "@/components/assistant/tool-summary-registry";
import type { NameOf, NameRef } from "@/lib/ai/tools/assistant/summary";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export {
	assistantToolSummaries,
	isSummarisedToolPart,
	type SummarisedToolName,
	type SummarisedToolPart,
	toolSummaryOf,
} from "@/components/assistant/tool-summary-registry";

const refKey = (ref: NameRef) => `${ref.kind}:${ref.id}`;

const nameQuery = (ref: NameRef, zedToken: string | undefined) => {
	switch (ref.kind) {
		case "bot":
			return orpc.bot.find.queryOptions({
				input: {
					id: ref.id as BotId,
					zedToken,
				},
				select: ({ data }) => data.name,
				retry: false,
			});
		case "block":
			return orpc.block.find.queryOptions({
				input: {
					id: ref.id as BlockId,
					zedToken,
				},
				select: ({ data }) => data.name,
				retry: false,
			});
		case "asset":
			return orpc.asset.find.queryOptions({
				input: {
					id: ref.id as AssetId,
					zedToken,
				},
				select: ({ data }) => data.title,
				retry: false,
			});
		case "group":
			return orpc.group.find.queryOptions({
				input: {
					id: ref.id as GroupId,
				},
				select: ({ data }) => data.name,
				retry: false,
			});
		case "user":
			return orpc.user.find.queryOptions({
				input: {
					id: ref.id as UserId,
					zedToken,
				},
				select: ({ data }) => data.name,
				retry: false,
			});
		case "invitation":
			return orpc.organizationInvitation.find.queryOptions({
				input: {
					id: ref.id as OrganizationInvitationId,
				},
				select: ({ data }) => data.email,
				retry: false,
			});
	}
};

/**
 * The part's summary line, with the ids it names looked up through their
 * `find` queries. Before the input is complete it is the tool's name.
 */
/** The newest zedToken of the message's turn, so things it created can be named. */
export const TurnZedTokenContext = createContext<string | undefined>(undefined);

export const useToolSummaryLine = (part: SummarisedToolPart): string => {
	const zedToken = use(TurnZedTokenContext);
	const summary = toolSummaryOf(part);
	const settled = part.state === "input-streaming" ? undefined : part;
	const refs = [
		...new Map(
			(settled ? (summary.refs?.(settled) ?? []) : []).map((ref) => [
				refKey(ref),
				ref,
			]),
		).values(),
	];
	const names = useQueries({
		queries: refs.map((ref) => nameQuery(ref, zedToken)),
		combine: (results) =>
			new Map(
				results.map((result, index) => [
					refKey(refs[index] as NameRef),
					result.isPending
						? m.assistant_tool_name_loading()
						: (result.data ?? m.assistant_tool_name_unavailable()),
				]),
			),
	});

	if (!settled) {
		return summary.name();
	}

	const nameOf: NameOf = (ref) =>
		names.get(refKey(ref)) ?? m.assistant_tool_name_unavailable();

	return summary.line(settled, nameOf);
};
