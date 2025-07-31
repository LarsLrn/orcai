import type { CustomUIMessage } from "@/lib/ai/tools";
import { MessagePartRenderer } from "./message-part-renderer";
import { sortMessageParts } from "./utils/sort-message-parts";

interface MessageContentProps {
	message: CustomUIMessage;
	variant: "sent" | "received";
}

export const MessageContent = ({ message, variant }: MessageContentProps) => {
	// Sort parts to handle AI SDK v5 streaming patterns
	const sortedParts = sortMessageParts(message.parts);

	return (
		<div>
			{sortedParts.map((part, i) => (
				<MessagePartRenderer
					key={`${part.type}${message.id}${i}`}
					part={part}
					variant={variant}
				/>
			))}
		</div>
	);
};
