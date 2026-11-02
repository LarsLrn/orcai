import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Check,
	ChevronDown,
} from "lucide-react";
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
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group";
import { useToolbar, useToolbarState } from "./toolbar-provider";

const ALIGNMENTS = [
	"left",
	"center",
	"right",
	"justify",
] as const;

export const AlignmentTooolbar = () => {
	const { editor } = useToolbar();
	const isMobile = useMediaQuery("(max-width: 640px)");
	const handleAlign = (value: string) => {
		editor?.chain().focus().setTextAlign(value).run();
	};

	const textAlign = useToolbarState(
		(current) =>
			ALIGNMENTS.find((value) =>
				current.isActive({
					textAlign: value,
				}),
			) ?? "left",
	);

	const alignmentOptions = [
		{
			name: m.editor_toolbar_alignment_left_option(),
			value: "left",
			icon: <AlignLeft className="h-4 w-4" />,
		},
		{
			name: m.editor_toolbar_alignment_centre_option(),
			value: "center",
			icon: <AlignCenter className="h-4 w-4" />,
		},
		{
			name: m.editor_toolbar_alignment_right_option(),
			value: "right",
			icon: <AlignRight className="h-4 w-4" />,
		},
		{
			name: m.editor_toolbar_alignment_justify_option(),
			value: "justify",
			icon: <AlignJustify className="h-4 w-4" />,
		},
	];

	const findIndex = (value: string) => {
		return alignmentOptions.findIndex((option) => option.value === value);
	};

	if (isMobile) {
		return (
			<MobileToolbarGroup
				label={
					alignmentOptions[findIndex(textAlign)]?.name ??
					m.editor_toolbar_alignment_left_option()
				}
			>
				{alignmentOptions.map((option) => (
					<MobileToolbarItem
						key={option.value}
						onClick={() => handleAlign(option.value)}
						active={textAlign === option.value}
					>
						<span className="mr-2">{option.icon}</span>
						{option.name}
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
									<span className="mr-2">
										{alignmentOptions[findIndex(textAlign)]?.icon}
									</span>
									{alignmentOptions[findIndex(textAlign)]?.name}
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
					{alignmentOptions.map((option) => (
						<DropdownMenuItem
							onSelect={() => {
								handleAlign(option.value);
							}}
							key={option.value}
						>
							<span className="mr-2">{option.icon}</span>
							{option.name}

							{option.value === textAlign && (
								<Check className="ml-auto h-4 w-4" />
							)}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
