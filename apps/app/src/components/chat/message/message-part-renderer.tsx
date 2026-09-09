import { MessageResponse } from "@/components/ai-elements/message";
import type { MessagePart } from "@/components/chat/message/classify-turn";
import { ImagePart } from "./parts/image-part";

const MessagePartRenderer = ({ part }: { part: MessagePart }) => {
	if (part.type === "file" && part.mediaType === "image/png") {
		return <ImagePart url={part.url} alt={part.type} />;
	}

	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
	}

	return null;
};

export { MessagePartRenderer };
