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
import type { CustomUIMessage } from "@/lib/ai/tools";

const MessageUsage = ({ message }: { message: CustomUIMessage }) => {
	if (message.role === "user") return null;

	if (!message.metadata?.totalUsage || !message.metadata.totalUsage.totalTokens)
		return null;

	return (
		<Context
			maxTokens={128000} // TODO: make dynamic based on model
			usedTokens={message.metadata.totalUsage.totalTokens}
			usage={{
				inputTokens: message.metadata.totalUsage.inputTokens,
				outputTokens: message.metadata.totalUsage.outputTokens,
				totalTokens: message.metadata.totalUsage.totalTokens,
				cachedInputTokens: message.metadata.totalUsage.cachedInputTokens,
				reasoningTokens: message.metadata.totalUsage.reasoningTokens,
			}}
		>
			<ContextTrigger size="sm" />
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
