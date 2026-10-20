import type { LinkSafetyConfig } from "streamdown";
import { MessageResponse } from "@/components/ai-elements/message";
import {
	type AddToolApprovalResponse,
	ConfirmationCard,
} from "@/components/assistant/confirmation-card";
import { isSummarisedToolPart } from "@/components/assistant/tool-summaries";
import { isDisplayToolPart } from "@/components/chat/gen-ui/catalog";
import { DisplayPart } from "@/components/chat/gen-ui/display-part";
import {
	isPausingPart,
	type MessagePart,
} from "@/components/chat/message/classify-turn";
import { ImagePart } from "./parts/image-part";

const MessagePartRenderer = ({
	part,
	running,
	linkSafety,
	addToolApprovalResponse,
}: {
	part: MessagePart;
	running: boolean;
	linkSafety?: LinkSafetyConfig;
	addToolApprovalResponse?: AddToolApprovalResponse;
}) => {
	if (part.type === "file" && part.mediaType === "image/png") {
		return <ImagePart url={part.url} alt={part.type} />;
	}

	if (part.type === "text") {
		return (
			<MessageResponse linkSafety={linkSafety}>{part.text}</MessageResponse>
		);
	}

	if (isDisplayToolPart(part)) {
		return <DisplayPart part={part} running={running} />;
	}

	if (isPausingPart(part) && isSummarisedToolPart(part)) {
		return (
			<ConfirmationCard
				part={part}
				addToolApprovalResponse={addToolApprovalResponse}
			/>
		);
	}

	return null;
};

export { MessagePartRenderer };
