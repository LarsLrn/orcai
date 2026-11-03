import { ChevronDown } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
	controls,
	type HeadingLevel,
	headingControls,
	runControl,
} from "../controls";
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group";
import { useToolbar, useToolbarState } from "./toolbar-provider";

const allLevels: readonly HeadingLevel[] = [
	1,
	2,
	3,
	4,
];

export const HeadingsToolbar = ({
	levels = allLevels,
}: {
	/** The heading levels the editor offers. */
	levels?: readonly HeadingLevel[];
}) => {
	const { editor } = useToolbar();
	const isMobile = useMediaQuery("(max-width: 640px)");
	const activeLevel = useToolbarState((current) =>
		levels.find((level) => headingControls[level].isActive?.(current)),
	);
	const paragraph = controls.paragraph;
	const triggerLabel = activeLevel ? `H${activeLevel}` : paragraph.label();
	const setParagraph = () => runControl(editor, paragraph);
	const setHeading = (level: HeadingLevel) =>
		runControl(editor, headingControls[level]);

	if (isMobile) {
		return (
			<MobileToolbarGroup label={triggerLabel}>
				<MobileToolbarItem onClick={setParagraph} active={!activeLevel}>
					{paragraph.label()}
				</MobileToolbarItem>
				{levels.map((level) => (
					<MobileToolbarItem
						key={level}
						onClick={() => setHeading(level)}
						active={activeLevel === level}
					>
						H{level}
					</MobileToolbarItem>
				))}
			</MobileToolbarGroup>
		);
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className={cn(
										"h-8 w-max gap-1 px-3 font-normal",
										activeLevel && "bg-accent",
									)}
								>
									{triggerLabel}
									<ChevronDown className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								onClick={setParagraph}
								className={cn(
									"flex h-fit items-center gap-2",
									!activeLevel && "bg-accent",
								)}
							>
								{paragraph.label()}
							</DropdownMenuItem>
							{levels.map((level) => (
								<DropdownMenuItem
									key={level}
									onClick={() => setHeading(level)}
									className={cn(
										"flex items-center gap-2",
										activeLevel === level && "bg-accent",
									)}
								>
									H{level}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				}
			/>
			<TooltipContent>
				<span>{m.editor_toolbar_headings_tooltip()}</span>
			</TooltipContent>
		</Tooltip>
	);
};
