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
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group";
import { useToolbar } from "./toolbar-provider";

const levels = [
	1,
	2,
	3,
	4,
] as const;

export const HeadingsToolbar = ({
	className,
	...props
}: React.ComponentProps<"button">) => {
	const { editor } = useToolbar();
	const isMobile = useMediaQuery("(max-width: 640px)");
	const activeLevel = levels.find((level) =>
		editor?.isActive("heading", {
			level,
		}),
	);

	if (isMobile) {
		return (
			<MobileToolbarGroup label={activeLevel ? `H${activeLevel}` : "Normal"}>
				<MobileToolbarItem
					onClick={() => editor?.chain().focus().setParagraph().run()}
					active={!editor?.isActive("heading")}
				>
					Normal
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
						active={editor?.isActive("heading", {
							level,
						})}
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
										editor?.isActive("heading") && "bg-accent",
										className,
									)}
									{...props}
								>
									{activeLevel ? `H${activeLevel}` : "Normal"}
									<ChevronDown className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								onClick={() => editor?.chain().focus().setParagraph().run()}
								className={cn(
									"flex h-fit items-center gap-2",
									!editor?.isActive("heading") && "bg-accent",
								)}
							>
								Normal
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
										editor?.isActive("heading", {
											level,
										}) && "bg-accent",
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
				<span>Headings</span>
			</TooltipContent>
		</Tooltip>
	);
};

HeadingsToolbar.displayName = "HeadingsToolbar";
