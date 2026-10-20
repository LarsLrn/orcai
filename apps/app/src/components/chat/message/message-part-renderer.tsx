import { MessageResponse } from "@/components/ai-elements/message";
import { isDisplayToolPart } from "@/components/chat/gen-ui/catalog";
import { DisplayPart } from "@/components/chat/gen-ui/display-part";
import type { MessagePart } from "@/components/chat/message/classify-turn";
import { ImagePart } from "./parts/image-part";

const MessagePartRenderer = ({
	part,
	running,
}: {
	part: MessagePart;
	running: boolean;
}) => {
	if (part.type === "file" && part.mediaType === "image/png") {
		return <ImagePart url={part.url} alt={part.type} />;
	}

	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
	}

	if (isDisplayToolPart(part)) {
		return <DisplayPart part={part} running={running} />;
	}

	return null;
};

export { MessagePartRenderer };
