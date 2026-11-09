import type { ChatMessageId } from "@orcai/core";
import {
	type ChatMessageMetadata,
	type ChatMessagePart,
	chatMessagePartSchema,
} from "@orcai/schema";
import {
	type ChatAgentUIMessage,
	toChatAgentParts,
} from "@/lib/ai/messages/chat-agent-message";
import type {
	MessagePart,
	ReasoningPart,
	TextPart,
	ToolPart,
	ToolPartOf,
} from "@/lib/ai/messages/turn-view";
import type { ToolName } from "@/lib/ai/tools/registry";

/** A part as the chat reads it from storage: it must pass the stored part schema. */
const read = (part: unknown): MessagePart => {
	const [readPart] = toChatAgentParts([
		chatMessagePartSchema.parse(part),
	]);
	if (!readPart) throw new Error("The part did not read");
	return readPart;
};

/** A part as stored, also one today's tool types no longer describe. */
export const storedPart = (part: ChatMessagePart) => read(part);

export const textPart = (
	text: string,
	{
		state = "done",
		providerMetadata,
	}: Pick<TextPart, "state" | "providerMetadata"> = {},
): TextPart => {
	const part = read({
		type: "text",
		text,
		state,
		...(providerMetadata
			? {
					providerMetadata,
				}
			: {}),
	});
	if (part.type !== "text") throw new Error("Not a text part");
	return part;
};

export const reasoningPart = (
	text: string,
	state: ReasoningPart["state"] = "done",
): ReasoningPart => {
	const part = read({
		type: "reasoning",
		text,
		state,
	});
	if (part.type !== "reasoning") throw new Error("Not a reasoning part");
	return part;
};

export const stepStartPart = () =>
	read({
		type: "step-start",
	});

type CallState = ToolPart["state"];

type CallIn<Name extends ToolName, State extends CallState> = Extract<
	ToolPartOf<Name>,
	{
		state: State;
	}
>;

/** What a call carries besides its type and state; the state decides which fields it needs. */
type CallFields<Name extends ToolName, State extends CallState> = Omit<
	CallIn<Name, State>,
	"type" | "state" | "toolCallId"
> & {
	toolCallId?: string;
};

const isCallOf = <Name extends ToolName, State extends CallState>(
	part: MessagePart,
	name: Name,
	state: State,
): part is CallIn<Name, State> =>
	part.type === `tool-${name}` && "state" in part && part.state === state;

/**
 * A call of tool `name` in `state`. The fields take the tool's input and
 * output types, and the stored part schema checks that the state has what it
 * needs, e.g. an output once the output is available.
 */
export const toolPart = <Name extends ToolName, State extends CallState>(
	name: Name,
	state: State,
	{
		toolCallId = `${name}-${crypto.randomUUID()}`,
		...fields
	}: CallFields<Name, State>,
): CallIn<Name, State> => {
	const part = read({
		...fields,
		type: `tool-${name}`,
		toolCallId,
		state,
	});
	if (!isCallOf(part, name, state)) throw new Error(`Not a ${name} call`);
	return part;
};

/** A chat message with these parts. */
export const uiMessage = ({
	id = crypto.randomUUID(),
	role,
	parts,
	metadata,
}: {
	id?: string;
	role: ChatAgentUIMessage["role"];
	parts: MessagePart[];
	metadata?: ChatMessageMetadata;
}): ChatAgentUIMessage => ({
	id: id as ChatMessageId,
	role,
	parts,
	...(metadata
		? {
				metadata,
			}
		: {}),
});
