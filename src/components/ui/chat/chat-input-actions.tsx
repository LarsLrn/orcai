import { CompassIcon, RefreshCcwIcon } from "lucide-react";
import { ChatSettings } from "@/components/chat/chat-settings";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/lib/orpc/schemas/chat";

const ChatUtilities = ({
	chatId,
	hasMessages,
	handleReload,
}: {
	chatId: Chat["id"];
	hasMessages: boolean;
	handleReload: () => void;
}) => {
	return (
		<div className="flex gap-1">
			<ChatSettings chatId={chatId} />
			{hasMessages && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={handleReload}
				>
					<RefreshCcwIcon className="size-4" />
					<span className="sr-only">Regenerate last message</span>
				</Button>
			)}

			<AppTourButton
				tour="chatTour"
				type="button"
				variant="ghost"
				size="icon"
				autoTrigger={true}
			>
				<CompassIcon className="size-4" />
				<span className="sr-only">Start tour</span>
			</AppTourButton>
		</div>
	);
};

export { ChatUtilities };
