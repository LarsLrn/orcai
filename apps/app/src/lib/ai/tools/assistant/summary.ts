import type { LucideIcon } from "lucide-react";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";
import type { AssistantToolName } from "./groups";

type MessagePart = ChatAgentUIMessage["parts"][number];

export type AssistantToolPart<Name extends AssistantToolName> = Extract<
	MessagePart,
	{
		type: `tool-${Name}`;
	}
>;

export type SettledToolPart<Name extends AssistantToolName> = Exclude<
	AssistantToolPart<Name>,
	{
		state: "input-streaming";
	}
>;

/** An id whose name the client looks up through that entity's `find` query. */
export interface NameRef {
	kind: "bot" | "block" | "asset" | "group" | "user" | "invitation";
	id: string;
}

/** Looked-up name, or a placeholder while loading or when it cannot be read. */
export type NameOf = (ref: NameRef) => string;

/** The confirm button of a gated tool's card. */
export type ConfirmationVerb =
	| "delete"
	| "remove"
	| "withdraw"
	| "grant"
	| "add"
	| "change"
	| "invite";

/** How one assistant tool reads in the work log and on its Confirmation card. */
export interface AssistantToolSummary<Name extends AssistantToolName> {
	icon: LucideIcon;
	/** Entry label before the input is complete. */
	name: () => string;
	/** Label while the call runs. */
	active: () => string;
	/** Ids `line` names; leave out those the output already names. */
	refs?: (part: SettledToolPart<Name>) => NameRef[];
	/** The one line, such as "Delete bot “Citation check”". */
	line: (part: SettledToolPart<Name>, nameOf: NameOf) => string;
	/** Gated tools only. */
	verb?: ConfirmationVerb;
}

export const defineToolSummary = <Name extends AssistantToolName>(
	summary: AssistantToolSummary<Name>,
) => summary;

type PartInput<Name extends AssistantToolName> =
	SettledToolPart<Name> extends {
		input: infer Input;
	}
		? Input
		: never;

type PartOutput<Name extends AssistantToolName> =
	Extract<
		SettledToolPart<Name>,
		{
			state: "output-available";
		}
	> extends {
		output: infer Output;
	}
		? Output
		: never;

/** Names a batch's targets, from the output once there is one. */
export const defineBatchSummary = <Name extends AssistantToolName>({
	kind,
	ids,
	named,
	summary,
	...labels
}: Pick<AssistantToolSummary<Name>, "icon" | "name" | "active" | "verb"> & {
	kind: NameRef["kind"];
	ids: (input: PartInput<Name>) => readonly string[] | undefined;
	named: (output: PartOutput<Name>) => {
		id: string;
		name?: string;
	}[];
	summary: (inputs: { names: string; count: number }) => string;
}) => {
	// A generic part does not narrow on its state.
	const settle = (part: SettledToolPart<Name>) =>
		part as unknown as
			| {
					state: "output-available";
					output: PartOutput<Name>;
			  }
			| {
					state: Exclude<
						SettledToolPart<AssistantToolName>["state"],
						"output-available"
					>;
					input: PartInput<Name>;
			  };

	return defineToolSummary<Name>({
		...labels,
		refs: (part) => {
			const settled = settle(part);

			return settled.state === "output-available"
				? []
				: (ids(settled.input) ?? []).map((id) => ({
						kind,
						id,
					}));
		},
		line: (part, nameOf) => {
			const settled = settle(part);
			const names =
				settled.state === "output-available"
					? named(settled.output).map(
							(target) =>
								target.name ??
								nameOf({
									kind,
									id: target.id,
								}),
						)
					: (ids(settled.input) ?? []).map((id) =>
							nameOf({
								kind,
								id,
							}),
						);

			return summary({
				names: formatNames(names),
				count: names.length,
			});
		},
	});
};

const MAX_NAMED = 3;

/** “A”, “B”, “C” and 2 more: up to three quoted names, the rest counted. */
export const formatNames = (names: string[]) => {
	const quoted = names.slice(0, MAX_NAMED).map((name) =>
		m.assistant_tool_quoted_name({
			name,
		}),
	);
	const rest = names.length - quoted.length;

	return rest > 0
		? m.assistant_tool_names_more({
				names: quoted.join(", "),
				count: rest,
			})
		: formatList(quoted);
};
