import type { OrganizationCapability } from "@orcai/schema";
import type { InferToolInput, InferToolOutput, Tool } from "ai";
import type { LucideIcon } from "lucide-react";
import type { z } from "zod/v4";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";
import type { EntityKind, EntityRef } from "./entity-kind";

/**
 * What a tool does: `display` shows a Gen UI primitive in the answer, `plan`
 * sets the conversation's plan, `create` is offered once the user approved a
 * plan, and the browser answers a `client` tool, which writes.
 */
export type ToolKind =
	| "read"
	| "display"
	| "plan"
	| "create"
	| "change"
	| "client";

/** Core tools are always active; the others once `loadTools` loaded their group. */
export type AssistantToolGroup = "core" | "bots" | "sharing" | "people";

/** The confirm button of a gated tool's card. */
export type ConfirmationVerb =
	| "delete"
	| "remove"
	| "withdraw"
	| "grant"
	| "add"
	| "change"
	| "invite";

/** Looked-up name, or a placeholder while loading or when it cannot be read. */
export type NameOf = (ref: EntityRef) => string;

/** A call whose input is complete, as its summary reads it; `output` once it ran. */
export interface ToolCall<Input, Output> {
	input: Input | undefined;
	output?: Output;
}

export interface ToolDeclaration<Input = unknown, Output = unknown> {
	kind: ToolKind;
	/** Assistant tools only. */
	group?: AssistantToolGroup;
	/** Any of these capabilities offers the tool; none means every role. */
	capabilities?: readonly OrganizationCapability[];
	/** The call pauses for the user's confirmation, on a card with this verb. */
	confirm?: ConfirmationVerb;
	/** Client tools: what the browser answers with. */
	outputSchema?: z.ZodType<Output>;
	icon: LucideIcon;
	/** Entry label before the input is complete. */
	name: () => string;
	/** Label while the call runs. */
	active: () => string;
	/** Ids `line` names; leave out those the output already names. */
	refs?(call: ToolCall<Input, Output>): EntityRef[];
	/** The one line, such as "Delete bot “Citation check”". */
	line?(call: ToolCall<Input, Output>, nameOf: NameOf): string;
}

type BuiltTool = Tool | ((...args: never[]) => Tool);
type ToolOf<Build extends BuiltTool> = Build extends (
	...args: never[]
) => infer Built
	? Built
	: Build;

export type DeclarationOf<Build extends BuiltTool> = ToolDeclaration<
	InferToolInput<ToolOf<Build>>,
	InferToolOutput<ToolOf<Build>>
>;

/** Declares the tool `Build` builds, typed by its input and output. */
export const declareTool =
	<Build extends BuiltTool>() =>
	<const Declaration extends DeclarationOf<Build>>(declaration: Declaration) =>
		declaration;

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

/** Names a batch's targets, from the output once there is one. */
export const batchSummary = <
	Build extends BuiltTool,
	Input = InferToolInput<ToolOf<Build>>,
	Output = InferToolOutput<ToolOf<Build>>,
>({
	kind,
	ids,
	named,
	summary,
}: {
	kind: EntityKind;
	ids: (input: Input | undefined) => readonly string[] | undefined;
	named: (output: Output) => {
		id: string;
		name?: string;
	}[];
	summary: (inputs: { names: string; count: number }) => string;
}): Pick<ToolDeclaration<Input, Output>, "refs" | "line"> => ({
	refs: (call) =>
		call.output
			? []
			: (ids(call.input) ?? []).map((id) => ({
					kind,
					id,
				})),
	line: (call, nameOf) => {
		const names = call.output
			? named(call.output).map(
					(target) =>
						target.name ??
						nameOf({
							kind,
							id: target.id,
						}),
				)
			: (ids(call.input) ?? []).map((id) =>
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
