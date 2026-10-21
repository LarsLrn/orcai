import type { ToolUIPart } from "ai";
import type { ComponentType } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
	type DisplayToolName,
	displayToolMarkdown,
	primitiveCatalog,
} from "@/components/chat/gen-ui/catalog";
import {
	type DisplayRendererProps,
	displayRenderers,
} from "@/components/chat/gen-ui/renderers";
import { toolNameOf } from "@/lib/ai/tools/registry";
import { m } from "@/paraglide/messages";

export type DisplayToolPart = {
	type: `tool-${DisplayToolName}`;
	state: ToolUIPart["state"];
	input?: unknown;
};

const DisplayFallback = ({
	name,
	input,
}: {
	name: DisplayToolName;
	input: unknown;
}) => {
	const markdown = displayToolMarkdown(name, input);
	return markdown === null ? (
		<p className="text-muted-foreground text-sm">{m.gen_ui_cannot_display()}</p>
	) : (
		<MessageResponse>{markdown}</MessageResponse>
	);
};

const DisplayRenderer = <Name extends DisplayToolName>({
	name,
	input,
	streaming,
}: {
	name: Name;
	input: unknown;
	streaming: boolean;
}) => {
	const Renderer: ComponentType<DisplayRendererProps<Name>> =
		displayRenderers[name];
	const { schema, read } = primitiveCatalog[name];
	if (streaming) {
		return <Renderer view={read(input)} streaming />;
	}
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		return <DisplayFallback name={name} input={input} />;
	}
	return <Renderer view={read(parsed.data)} streaming={false} />;
};

/** Partial input while the call streams; validated input or a fallback after. */
export const DisplayPart = ({
	part,
	running,
}: {
	part: DisplayToolPart;
	running: boolean;
}) => {
	if (part.state === "output-error") {
		return null;
	}
	return (
		<DisplayRenderer
			name={toolNameOf(part)}
			input={part.input}
			streaming={part.state === "input-streaming" && running}
		/>
	);
};
