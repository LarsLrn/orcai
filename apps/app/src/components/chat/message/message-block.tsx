import type { ChatId } from "@orcai/core";
import type { ChatBranchLink } from "@orcai/schema";
import { PlayIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import type { LinkSafetyConfig } from "streamdown";
import {
	Message,
	MessageContent,
	MessageToolbar,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ClientToolActions } from "@/components/assistant/client-tool-actions";
import type { AddToolApprovalResponse } from "@/components/assistant/confirmation-card";
import { TurnZedTokenContext } from "@/components/assistant/tool-summary-line";
import { MessageBranches } from "@/components/chat/branch-links";
import { ActivityLine } from "@/components/chat/message/work-log/activity-line";
import {
	activityLabel,
	WorkLog,
} from "@/components/chat/message/work-log/work-log";
import { Button } from "@/components/ui/button";
import { InView } from "@/components/ui/motion/in-view";
import type { MessageView } from "@/lib/ai/turn-view/turn-view";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";
import { MessageUsage } from "./metadata/message-usage";

interface MessageBlockProps {
	view: MessageView;
	chatId: ChatId;
	animate?: boolean;
	/** Chats branched from this message. */
	branches?: ChatBranchLink[];
	onBranch?: () => void;
	branching?: boolean;
	/** Overrides the default confirmation for links in the answer. */
	linkSafety?: LinkSafetyConfig;
	/** Answers the Confirmation cards the view marks answerable. */
	addToolApprovalResponse?: AddToolApprovalResponse;
	/** Answers the client calls the view marks answerable, such as the upload widget. */
	clientToolActions?: ClientToolActions;
	/** Runs a step whose cards are answered but that has not run, as after a reload. */
	onContinue?: () => void;
}

const MessageEntrance = ({
	animate,
	children,
}: {
	animate: boolean;
	children: ReactNode;
}) => {
	if (!animate) {
		return <>{children}</>;
	}

	return (
		<InView
			variants={{
				hidden: {
					opacity: 0,
					y: 8,
				},
				visible: {
					opacity: 1,
					y: 0,
				},
			}}
			viewOptions={{
				margin: "0px 0px -200px 0px",
			}}
			transition={{
				duration: 0.2,
				ease: "easeOut",
			}}
		>
			{children}
		</InView>
	);
};

export const MessageBlock = ({
	view,
	chatId,
	animate = true,
	branches = [],
	onBranch,
	branching,
	linkSafety,
	addToolApprovalResponse,
	clientToolActions,
	onContinue,
}: MessageBlockProps) => {
	const { message, running, workLog, answer, missing, activity } = view;
	const variant = message.role === "user" ? "sent" : "received";
	const messageAttachments = getChatMessageAttachments(message);
	const [workLogOpen, setWorkLogOpen] = useState(false);
	const workLogRef = useRef<HTMLDivElement>(null);

	const showSteps = () => {
		setWorkLogOpen(true);
		workLogRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	// A reply exists from the first chunk on, before the model has written anything.
	if (missing === "waiting") {
		return (
			<div className="w-full text-foreground">
				<Shimmer>{m.chat_waiting_for_model()}</Shimmer>
			</div>
		);
	}
	if (missing === "pending") {
		return null;
	}

	return (
		<MessageEntrance animate={animate}>
			<Message
				from={message.role}
				key={message.id}
				className="grid grid-cols-1"
			>
				<TurnZedTokenContext value={message.metadata?.zedToken}>
					<MessageContent>
						<ChatMessageAttachments attachments={messageAttachments} />
						{workLog.length > 0 && (
							<WorkLog
								ref={workLogRef}
								entries={workLog}
								running={running}
								activity={activity}
								open={workLogOpen}
								onOpenChange={setWorkLogOpen}
							/>
						)}
						{answer.map((part, i) => (
							<MessagePartRenderer
								key={`${part.part.type}${message.id}${i}`}
								answer={part}
								running={running}
								linkSafety={linkSafety}
								addToolApprovalResponse={addToolApprovalResponse}
								clientToolActions={clientToolActions}
							/>
						))}
						{(missing === "step-limit" || missing === "no-answer") && (
							<p className="text-muted-foreground text-sm">
								{missing === "step-limit"
									? m.chat_reply_step_limit()
									: m.chat_reply_no_answer()}
							</p>
						)}
						{view.canContinue && onContinue && (
							<Button
								variant="outline"
								size="sm"
								className="w-fit"
								onClick={onContinue}
							>
								<PlayIcon data-icon="inline-start" />
								{m.assistant_turn_continue_action()}
							</Button>
						)}
						{running && (
							<ActivityLine
								label={activity ? activityLabel(activity) : null}
								onShowSteps={workLog.length > 0 ? showSteps : undefined}
							/>
						)}
					</MessageContent>
				</TurnZedTokenContext>
				<MessageToolbar>
					<MessageActions
						view={view}
						variant={variant}
						chatId={chatId}
						onBranch={onBranch}
						branching={branching}
						className={cn({
							"w-full justify-end": variant === "sent",
						})}
					/>
					{variant === "received" && (
						<div className="mt-1 flex items-center justify-end gap-2">
							<MessageUsage message={message} />
						</div>
					)}
				</MessageToolbar>
				{branches.length > 0 && (
					<MessageBranches
						branches={branches}
						className={cn({
							"justify-end": variant === "sent",
						})}
					/>
				)}
			</Message>
		</MessageEntrance>
	);
};
