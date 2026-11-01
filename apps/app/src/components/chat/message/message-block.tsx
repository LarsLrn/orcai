import type { ChatId } from "@orcai/core";
import type { ChatBranchLink } from "@orcai/schema";
import { PlayIcon } from "lucide-react";
import { type ReactNode, use, useMemo, useRef, useState } from "react";
import { CitationsContext } from "@/components/ai-elements/cite";
import {
	Message,
	MessageContent,
	MessageToolbar,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { TurnZedTokenContext } from "@/components/assistant/tool-summary-line";
import {
	useWrittenResources,
	WrittenResourcesContext,
} from "@/components/assistant/written-resources";
import { MessageBranches } from "@/components/chat/branch-links";
import { ActivityLine } from "@/components/chat/message/work-log/activity-line";
import {
	activityLabel,
	WorkLog,
} from "@/components/chat/message/work-log/work-log";
import { StepAnswersContext } from "@/components/chat/step-answers";
import { Button } from "@/components/ui/button";
import { useMessageScrollerInView } from "@/components/ui/message-scroller";
import { InView } from "@/components/ui/motion/in-view";
import { citedWebSources } from "@/lib/ai/tools/web/sources";
import type { MessageView } from "@/lib/ai/turn-view/turn-view";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";
import { MessageSources } from "./message-sources";
import { MessageCompacted } from "./metadata/message-compacted";
import { MessageContextNotice } from "./metadata/message-context-notice";

const NO_CITATIONS = {};

interface MessageBlockProps {
	view: MessageView;
	chatId: ChatId;
	animate?: boolean;
	/** Chats branched from this message. */
	branches?: ChatBranchLink[];
	onBranch?: () => void;
	branching?: boolean;
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
}: MessageBlockProps) => {
	const { message, running, workLog, answer, missing, activity } = view;
	const variant = message.role === "user" ? "sent" : "received";
	const messageAttachments = getChatMessageAttachments(message);
	const [workLogOpen, setWorkLogOpen] = useState(false);
	const workLogRef = useRef<HTMLDivElement>(null);
	const [activityRef, activityInView] = useMessageScrollerInView();
	const answers = use(StepAnswersContext);
	// The server resolves refs; a cite without an entry shows as its text.
	const citations = message.metadata?.citations ?? NO_CITATIONS;
	const webSources = useMemo(
		() => citedWebSources(message.parts),
		[
			message,
		],
	);
	const writtenResources = useWrittenResources(
		answer,
		message.metadata?.zedToken,
	);

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
			{view.compactedBefore && <MessageCompacted />}
			<Message
				from={message.role}
				key={message.id}
				className="grid grid-cols-1"
			>
				<TurnZedTokenContext value={message.metadata?.zedToken}>
					<WrittenResourcesContext value={writtenResources}>
						<CitationsContext value={citations}>
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
										activityRef={activityRef}
									/>
								)}
								{answer.map((part, i) => (
									<MessagePartRenderer
										key={`${part.part.type}${message.id}${i}`}
										answer={part}
										running={running}
									/>
								))}
								{!running && <MessageSources sources={webSources} />}
								{(missing === "step-limit" || missing === "no-answer") && (
									<p className="text-muted-foreground text-sm">
										{missing === "step-limit"
											? m.chat_reply_step_limit()
											: m.chat_reply_no_answer()}
									</p>
								)}
								{view.canContinue && answers && (
									<Button
										variant="outline"
										size="sm"
										className="w-fit"
										onClick={() => void answers.continue()}
									>
										<PlayIcon data-icon="inline-start" />
										{m.assistant_turn_continue_action()}
									</Button>
								)}
								{running && (
									<ActivityLine
										label={activity ? activityLabel(activity) : null}
										shown={
											workLog.length === 0 ||
											!activityInView ||
											answer.some(
												(part) =>
													part.kind === "display" || part.kind === "client",
											)
										}
										onShowSteps={workLog.length > 0 ? showSteps : undefined}
									/>
								)}
							</MessageContent>
						</CitationsContext>
					</WrittenResourcesContext>
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
							<MessageContextNotice message={message} />
							{message.metadata?.model && (
								<span className="wrap-anywhere min-w-0 text-muted-foreground text-xs">
									{message.metadata.model}
								</span>
							)}
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
