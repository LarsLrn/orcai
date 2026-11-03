import { AssistantModelLabel } from "@/components/assistant/assistant-model-label";
import { AssistantPlaceholder } from "@/components/assistant/assistant-placeholder";
import { AssistantUnavailable } from "@/components/assistant/assistant-unavailable";
import { useAssistantStarter } from "@/components/assistant/use-assistant-starter";
import { Composer } from "@/components/chat/composer";
import { Spinner } from "@/components/ui/spinner";

const AssistantNewConversation = ({
	initialText,
}: {
	initialText?: string;
}) => {
	const { availability, model, blocker, isStarting, start } =
		useAssistantStarter();

	if (availability === "loading") {
		return <Spinner className="mx-auto my-8" />;
	}

	if (availability === "unset") {
		return <AssistantUnavailable />;
	}

	return (
		<div className="flex flex-col gap-6">
			<AssistantPlaceholder />
			<Composer
				draft={
					initialText
						? {
								text: initialText,
								attachments: [],
							}
						: undefined
				}
				onSend={start}
				withAttachments={false}
				assistant
				model={model}
				blocker={blocker}
				busy={isStarting}
				tools={() => <AssistantModelLabel />}
			/>
		</div>
	);
};

export { AssistantNewConversation };
