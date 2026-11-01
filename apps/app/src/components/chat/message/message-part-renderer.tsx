import { use } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { ConfirmationCard } from "@/components/assistant/confirmation-card";
import { DisplayPart } from "@/components/chat/gen-ui/display-part";
import { ClientToolWidget } from "@/components/chat/message/client-tool-renderers";
import { StepAnswersContext } from "@/components/chat/step-answers";
import type { AnswerPart } from "@/lib/ai/turn-view/turn-view";
import { ImagePart } from "./parts/image-part";

const MessagePartRenderer = ({
	answer,
	running,
}: {
	answer: AnswerPart;
	running: boolean;
}) => {
	const answers = use(StepAnswersContext);

	switch (answer.kind) {
		case "text":
			return <MessageResponse>{answer.part.text}</MessageResponse>;
		case "file":
			return answer.part.mediaType === "image/png" ? (
				<ImagePart url={answer.part.url} alt={answer.part.type} />
			) : null;
		case "display":
			return <DisplayPart part={answer.part} running={running} />;
		case "client":
			return (
				<ClientToolWidget
					part={answer.part}
					status={answer.status}
					answers={answer.answerable ? answers : undefined}
				/>
			);
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
