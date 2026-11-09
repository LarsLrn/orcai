import { use } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { DisplayPart } from "@/components/chat/gen-ui/display-part";
import { ConfirmationCard } from "@/components/chat/message/assistant/confirmation-card";
import { ResourceCard } from "@/components/chat/message/assistant/resource-card";
import { ClientToolWidget } from "@/components/chat/message/client-tool-renderers";
import { StepAnswersContext } from "@/components/chat/message/step-answers";
import type { AnswerPart } from "@/lib/ai/messages/turn-view";
import { m } from "@/paraglide/messages";
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
				<ImagePart url={answer.part.url} alt={m.chat_image_part_label()} />
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
		case "resource":
			return (
				<ResourceCard resource={answer.resource} settled={answer.settled} />
			);
	}
};

export { MessagePartRenderer };
