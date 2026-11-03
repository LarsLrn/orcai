import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LinkPopover, useLinkState } from "../link-popover";
import { useToolbar } from "./toolbar-provider";

export const LinkToolbar = () => {
	const { editor } = useToolbar();
	const { canLink, isActive } = useLinkState(editor);

	return (
		<LinkPopover editor={editor}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							disabled={!canLink}
							render={
								<Button
									variant="ghost"
									size="sm"
									className={cn(
										"h-8 w-max px-3 font-normal",
										isActive && "bg-accent",
									)}
								>
									<p aria-hidden className="mr-2 text-base">
										↗
									</p>
									<p className="underline underline-offset-4">
										{m.editor_control_link()}
									</p>
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>
					<span>{m.editor_control_link()}</span>
				</TooltipContent>
			</Tooltip>
		</LinkPopover>
	);
};
