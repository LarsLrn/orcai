import { use } from "react";
import type { LinkSafetyConfig } from "streamdown";
import { MessageResponse } from "@/components/ai-elements/message";
import { clientToolRenderersOf } from "@/components/assistant/client-tool-renderers";
import { ConfirmationCard } from "@/components/assistant/confirmation-card";
import { DisplayPart } from "@/components/chat/gen-ui/display-part";
import { StepAnswersContext } from "@/components/chat/step-answers";
import type { AnswerPart } from "@/lib/ai/turn-view/turn-view";
import { ImagePart } from "./parts/image-part";

const MessagePartRenderer = ({
	answer,
	running,
	linkSafety,
}: {
	answer: AnswerPart;
	running: boolean;
	linkSafety?: LinkSafetyConfig;
}) => {
	const answers = use(StepAnswersContext);

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
					answers={answer.answerable ? answers : undefined}
				/>
			);
		}
		case "approval":
			return (
				<ConfirmationCard
					part={answer.part}
					status={answer.status}
					answers={answer.answerable ? answers : undefined}
				/>
			);
	}
};

export { MessagePartRenderer };
