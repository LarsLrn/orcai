import type { ToolUIPart } from "ai";
import { MessageResponse } from "@/components/ai-elements/message";
import type { CustomTools, CustomUIMessage } from "@/lib/ai/tools";
import { ImagePart } from "./parts/image-part";
import { ReasoningPart } from "./parts/reasoning-part";
import { ToolCallPart } from "./parts/tool-call-part";

interface MessagePartRendererProps {
	part: CustomUIMessage["parts"][number];
}

const MessagePartRenderer = ({ part }: MessagePartRendererProps) => {
	if (part.type === "reasoning") {
		return <ReasoningPart part={part} />;
	}

	if (part.type === "file" && part.mediaType === "image/png") {
		return <ImagePart url={part.url} alt={part.type} />;
	}

	if (part.type.startsWith("tool-")) {
		// We can be sure this is a tool call part
		return <ToolCallPart part={part as ToolUIPart<CustomTools>} />;
	}

	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
	}

	return null;
};

export { MessagePartRenderer };
