import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The assistant's model, read-only where a chat offers its model picker. */
const AssistantModelLabel = ({ className }: { className?: string }) => {
	const { modelName } = useAssistantModel();

	if (!modelName) return null;

	return (
		<span
			title={m.assistant_composer_model_hint()}
			className={cn(
				"text-muted-foreground max-w-60 min-w-0 truncate px-2 text-sm",
				className,
			)}
		>
			{modelName}
		</span>
	);
};

export { AssistantModelLabel };
