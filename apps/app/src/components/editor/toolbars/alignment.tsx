import { Check, ChevronDown } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { m } from "@/paraglide/messages";
import { controls, runControl, useActiveControl } from "../controls";
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group";
import { useToolbar } from "./toolbar-provider";

const alignments = [
	controls.alignLeft,
	controls.alignCentre,
	controls.alignRight,
	controls.alignJustify,
];

export const AlignmentToolbar = () => {
	const { editor } = useToolbar();
	const isMobile = useMediaQuery("(max-width: 640px)");
	const active = useActiveControl(editor, alignments) ?? controls.alignLeft;

	if (isMobile) {
		return (
			<MobileToolbarGroup label={active.label()}>
				{alignments.map((alignment) => (
					<MobileToolbarItem
						key={alignment.label()}
						onClick={() => runControl(editor, alignment)}
						active={alignment === active}
					>
						<alignment.icon className="mr-2 h-4 w-4" />
						{alignment.label()}
					</MobileToolbarItem>
				))}
			</MobileToolbarGroup>
		);
	}

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger
					render={
						<DropdownMenuTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 w-max font-normal"
								>
									<active.icon className="mr-2 h-4 w-4" />
									{active.label()}
									<ChevronDown />
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>{m.editor_toolbar_alignment_tooltip()}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent>
				<DropdownMenuGroup className="w-40">
					{alignments.map((alignment) => (
						<DropdownMenuItem
							key={alignment.label()}
							onClick={() => runControl(editor, alignment)}
						>
							<alignment.icon className="mr-2 h-4 w-4" />
							{alignment.label()}
							{alignment === active && <Check className="ml-auto h-4 w-4" />}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
