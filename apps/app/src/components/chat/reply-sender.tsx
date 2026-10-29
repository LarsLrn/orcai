import type { ReactNode } from "react";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import { SendMessageContext } from "./send-message";
import {
	chatSelectedModel,
	type SelectedModel,
	type SendStateChat,
	useComposerSendState,
} from "./use-composer-send-state";

type ReplySenderProps = {
	chat: SendStateChat | undefined;
	send: (text: string) => Promise<void>;
	/** A turn is running. */
	busy: boolean;
	children: ReactNode;
};

const ReplySender = ({
	chat,
	selectedModel,
	send,
	busy,
	children,
}: ReplySenderProps & {
	selectedModel: SelectedModel;
}) => {
	const { canSend } = useComposerSendState({
		chat,
		selectedModel,
	});

	return (
		<SendMessageContext value={canSend && !busy ? send : undefined}>
			{children}
		</SendMessageContext>
	);
};

/** Prefilled replies send as the composer does: not while a turn runs, the chat is read-only or sending is blocked. */
const ChatReplySender = (props: ReplySenderProps) => (
	<ReplySender {...props} selectedModel={chatSelectedModel(props.chat)} />
);

/** The assistant's model comes from the organisation, which only the app's routes can read. */
const AssistantReplySender = (props: ReplySenderProps) => {
	const selectedModel = useAssistantModel();

	return <ReplySender {...props} selectedModel={selectedModel} />;
};

export { AssistantReplySender, ChatReplySender };
