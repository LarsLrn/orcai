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
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group";
import { useToolbar, useToolbarState } from "./toolbar-provider";

type Level = 1 | 2 | 3 | 4;

const allLevels: readonly Level[] = [
	1,
	2,
	3,
	4,
];

export const HeadingsToolbar = ({
	className,
	levels = allLevels,
	...props
}: React.ComponentProps<"button"> & {
	/** The heading levels the editor offers. */
	levels?: readonly Level[];
}) => {
	const { editor } = useToolbar();
	const isMobile = useMediaQuery("(max-width: 640px)");
	const { activeLevel, isHeading } = useToolbarState((current) => ({
		activeLevel: levels.find((level) =>
			current.isActive("heading", {
				level,
			}),
		),
		isHeading: current.isActive("heading"),
	}));

	if (isMobile) {
		return (
			<MobileToolbarGroup
				label={
					activeLevel
						? `H${activeLevel}`
						: m.editor_toolbar_headings_normal_option()
				}
			>
				<MobileToolbarItem
					onClick={() => editor?.chain().focus().setParagraph().run()}
					active={!isHeading}
				>
					{m.editor_toolbar_headings_normal_option()}
				</MobileToolbarItem>
				{levels.map((level) => (
					<MobileToolbarItem
						key={level}
						onClick={() =>
							editor
								?.chain()
								.focus()
								.toggleHeading({
									level,
								})
								.run()
						}
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
										isHeading && "bg-accent",
										className,
									)}
									{...props}
								>
									{activeLevel
										? `H${activeLevel}`
										: m.editor_toolbar_headings_normal_option()}
									<ChevronDown className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								onClick={() => editor?.chain().focus().setParagraph().run()}
								className={cn(
									"flex h-fit items-center gap-2",
									!isHeading && "bg-accent",
								)}
							>
								{m.editor_toolbar_headings_normal_option()}
							</DropdownMenuItem>
							{levels.map((level) => (
								<DropdownMenuItem
									key={level}
									onClick={() =>
										editor
											?.chain()
											.focus()
											.toggleHeading({
												level,
											})
											.run()
									}
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

HeadingsToolbar.displayName = "HeadingsToolbar";
