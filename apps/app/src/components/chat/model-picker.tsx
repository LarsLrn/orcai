import type { Model, Provider } from "@orcai/schema";
import { LockIcon } from "lucide-react";
import type { ModelPickerState } from "@/components/chat/model-picker-state";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The composer's model picker, locked on a bot's required model or hinting at its recommended one. */
const ModelPicker = ({
	state,
	botName,
	selectedModelId,
	selectedProviderId,
	onSelect,
	className,
}: {
	state: ModelPickerState;
	botName: string | undefined;
	selectedModelId?: string;
	selectedProviderId?: string;
	onSelect: (model: Model, provider: Provider) => void;
	className?: string;
}) => {
	if (state.kind === "locked") {
		return (
			<Tooltip>
				<TooltipTrigger
					render={
						<span
							// biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip says why the model cannot change
							tabIndex={0}
							className={cn(
								"inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-muted-foreground text-sm",
								className,
							)}
						/>
					}
				>
					<LockIcon aria-hidden className="size-3.5 shrink-0" />
					<span className="truncate">
						{state.modelName ?? m.chat_model_locked_missing_label()}
					</span>
				</TooltipTrigger>
				<TooltipContent>
					{m.chat_model_locked_tooltip({
						bot: botName ?? m.chat_bot_model_notice_bot_fallback(),
					})}
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<>
			<ModelSelectorButton
				selectedModelId={selectedModelId}
				selectedProviderId={selectedProviderId}
				onSelect={onSelect}
				className={className}
			/>
			{state.kind === "tuned" && (
				<span className="hidden truncate text-muted-foreground text-xs sm:inline">
					{m.chat_model_tuned_hint({
						model: state.modelName,
					})}
				</span>
			)}
		</>
	);
};

export { ModelPicker };
