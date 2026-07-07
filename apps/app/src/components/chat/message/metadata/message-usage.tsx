import { BotIcon } from "lucide-react";
import {
	Context,
	ContextCacheUsage,
	ContextContent,
	ContextContentBody,
	ContextContentFooter,
	ContextContentHeader,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextTrigger,
} from "@/components/ai-elements/context";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";

const MessageUsage = ({ message }: { message: ChatAgentUIMessage }) => {
	if (message.role === "user") return null;

	if (!message.metadata?.totalUsage?.totalTokens) return null;

	return (
		<Context
			maxTokens={128000} // TODO: make dynamic based on model
			usedTokens={message.metadata.totalUsage.totalTokens}
			usage={{
				inputTokens: message.metadata.totalUsage?.inputTokens,
				inputTokenDetails: {
					noCacheTokens:
						message.metadata.totalUsage?.inputTokenDetails?.noCacheTokens,
					cacheReadTokens:
						message.metadata.totalUsage?.inputTokenDetails?.cacheReadTokens,
					cacheWriteTokens:
						message.metadata.totalUsage?.inputTokenDetails?.cacheWriteTokens,
				},
				outputTokens: message.metadata.totalUsage?.outputTokens,
				outputTokenDetails: {
					textTokens:
						message.metadata.totalUsage?.outputTokenDetails?.textTokens,
					reasoningTokens:
						message.metadata.totalUsage?.outputTokenDetails?.reasoningTokens,
				},
				totalTokens: message.metadata.totalUsage.totalTokens,
			}}
			modelId={message.metadata?.model}
		>
			<ContextTrigger size="sm">
				<span className="flex h-8 items-center gap-1 font-medium text-muted-foreground">
					<BotIcon className="size-4" />
					<span>{message.metadata?.model ?? "Unknown Model"}</span>
				</span>
			</ContextTrigger>
			<ContextContent>
				<ContextContentHeader />
				<ContextContentBody>
					<ContextInputUsage />
					<ContextOutputUsage />
					<ContextReasoningUsage />
					<ContextCacheUsage />
				</ContextContentBody>
				<ContextContentFooter />
			</ContextContent>
		</Context>
	);
};

export { MessageUsage };
