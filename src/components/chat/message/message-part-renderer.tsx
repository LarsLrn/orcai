import type { CustomUIMessage } from "@/lib/ai/tools";
import { ImagePart } from "./parts/image-part";
import { ReasoningPart } from "./parts/reasoning-part";
import { TextPart } from "./parts/text-part";
import { ToolCallPart } from "./parts/tool-call-part";

interface MessagePartRendererProps {
	part:
		| CustomUIMessage["parts"][0]
		| { type: "unified-reasoning"; reasoningParts: any[] };
	variant: "sent" | "received";
}

export const MessagePartRenderer = ({
	part,
	variant,
}: MessagePartRendererProps) => {
	if (part.type === "unified-reasoning") {
		return <ReasoningPart reasoningParts={part.reasoningParts} />;
	}

	if (part.type === "reasoning") {
		// Legacy support for individual reasoning parts
		return <ReasoningPart reasoningParts={[{ text: part.text }]} />;
	}

	if (part.type === "file" && part.mediaType === "image/png") {
		return <ImagePart url={part.url} alt={part.type} />;
	}

	if (part.type.startsWith("tool-")) {
		return <ToolCallPart part={part} />;
	}

	if (part.type === "text") {
		return <TextPart text={part.text} variant={variant} />;
	}

	return null;
};
