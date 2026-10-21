import type { LinkSafetyConfig } from "streamdown";
import { MessageResponse } from "@/components/ai-elements/message";
import type { ClientToolActions } from "@/components/assistant/client-tool-actions";
import { clientToolRenderersOf } from "@/components/assistant/client-tool-renderers";
import {
	type AddToolApprovalResponse,
	ConfirmationCard,
} from "@/components/assistant/confirmation-card";
import { isSummarisedToolPart } from "@/components/assistant/tool-summaries";
import { DisplayPart } from "@/components/chat/gen-ui/display-part";
import type { AnswerPart } from "@/lib/ai/turn-view/turn-view";
import { ImagePart } from "./parts/image-part";

const MessagePartRenderer = ({
	answer,
	running,
	linkSafety,
	addToolApprovalResponse,
	clientToolActions,
}: {
	answer: AnswerPart;
	running: boolean;
	linkSafety?: LinkSafetyConfig;
	addToolApprovalResponse?: AddToolApprovalResponse;
	clientToolActions?: ClientToolActions;
}) => {
	switch (answer.kind) {
		case "text":
			return (
				<MessageResponse linkSafety={linkSafety}>
					{answer.part.text}
				</MessageResponse>
			);
		case "file":
			return answer.part.mediaType === "image/png" ? (
				<ImagePart url={answer.part.url} alt={answer.part.type} />
			) : null;
		case "display":
			return <DisplayPart part={answer.part} running={running} />;
		case "client": {
			const { Widget } = clientToolRenderersOf(answer.part);
			return (
				<Widget
					part={answer.part}
					status={answer.status}
					actions={answer.answerable ? clientToolActions : undefined}
				/>
			);
		}
		case "approval":
			return isSummarisedToolPart(answer.part) ? (
				<ConfirmationCard
					part={answer.part}
					status={answer.status}
					addToolApprovalResponse={
						answer.answerable ? addToolApprovalResponse : undefined
					}
				/>
			) : null;
	}
};

export { MessagePartRenderer };
