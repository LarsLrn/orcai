import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type EditorControl, shortcutLabel, useControl } from "../controls";
import { useToolbar } from "./toolbar-provider";

export const ControlButton = ({ control }: { control: EditorControl }) => {
	const { editor } = useToolbar();
	const { isActive, canRun, run } = useControl(editor, control);
	const label = control.label();

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={label}
						aria-pressed={control.isActive ? isActive : undefined}
						className={cn("h-8 w-8 p-0 sm:h-9 sm:w-9", isActive && "bg-accent")}
						onClick={run}
						disabled={!canRun}
					>
						<control.icon className="h-4 w-4" />
					</Button>
				}
			/>
			<TooltipContent>
				<span>{label}</span>
				{control.shortcut && (
					<span className="ml-1 text-xs">
						{shortcutLabel(control.shortcut)}
					</span>
				)}
			</TooltipContent>
		</Tooltip>
	);
};
