import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { MobileToolbarGroup, MobileToolbarItem } from "./mobile-toolbar-group";
import { useToolbar } from "./toolbar-provider";

const COLOUR_IDS = [
	"default",
	"grey",
	"brown",
	"orange",
	"yellow",
	"green",
	"blue",
	"purple",
	"pink",
	"red",
] as const;

type ColourId = (typeof COLOUR_IDS)[number];

const CSS_COLOUR_NAMES: Record<ColourId, string> = {
	default: "default",
	grey: "gray",
	brown: "brown",
	orange: "orange",
	yellow: "yellow",
	green: "green",
	blue: "blue",
	purple: "purple",
	pink: "pink",
	red: "red",
};

const colourLabel = (id: ColourId) => {
	switch (id) {
		case "grey":
			return m.editor_colour_grey_option();
		case "brown":
			return m.editor_colour_brown_option();
		case "orange":
			return m.editor_colour_orange_option();
		case "yellow":
			return m.editor_colour_yellow_option();
		case "green":
			return m.editor_colour_green_option();
		case "blue":
			return m.editor_colour_blue_option();
		case "purple":
			return m.editor_colour_purple_option();
		case "pink":
			return m.editor_colour_pink_option();
		case "red":
			return m.editor_colour_red_option();
		default:
			return m.editor_colour_default_option();
	}
};

const colourOptions = (kind: "text" | "highlight") =>
	COLOUR_IDS.map((id) => ({
		id,
		name: colourLabel(id),
		color: `var(--editor-${kind}-${CSS_COLOUR_NAMES[id]})`,
	}));

interface ColorHighlightButtonProps {
	name: string;
	color: string;
	isActive: boolean;
	onClick: () => void;
	isHighlight?: boolean;
}

const ColorHighlightButton = ({
	name,
	color,
	isActive,
	onClick,
	isHighlight,
}: ColorHighlightButtonProps) => (
	<button
		onClick={onClick}
		className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-gray-3"
		type="button"
	>
		<div className="flex items-center space-x-2">
			<div
				className="rounded-sm border px-1 py-px font-medium"
				style={
					isHighlight
						? {
								backgroundColor: color,
							}
						: {
								color,
							}
				}
			>
				A
			</div>
			<span>{name}</span>
		</div>
		{isActive && <CheckIcon className="h-4 w-4" />}
	</button>
);

export const ColorHighlightToolbar = () => {
	const { editor } = useToolbar();
	const isMobile = useMediaQuery("(max-width: 640px)");

	const textColours = colourOptions("text");
	const highlightColours = colourOptions("highlight");
	const currentColor = editor?.getAttributes("textStyle").color;
	const currentHighlight = editor?.getAttributes("highlight").color;

	const handleSetColor = (color: string) => {
		editor
			?.chain()
			.focus()
			.setColor(color === currentColor ? "" : color)
			.run();
	};

	const handleSetHighlight = (color: string) => {
		editor
			?.chain()
			.focus()
			.setHighlight(
				color === currentHighlight
					? {
							color: "",
						}
					: {
							color,
						},
			)
			.run();
	};

	const isDisabled =
		!editor?.can().chain().setHighlight().run() ||
		!editor?.can().chain().setColor("").run();

	if (isMobile) {
		return (
			<div className="flex gap-1">
				<MobileToolbarGroup label={m.editor_toolbar_colour_group_label()}>
					{textColours.map(({ id, name, color }) => (
						<MobileToolbarItem
							key={id}
							onClick={() => handleSetColor(color)}
							active={currentColor === color}
						>
							<div className="flex items-center gap-2">
								<div
									className="rounded-sm border px-2"
									style={{
										color,
									}}
								>
									A
								</div>
								<span>{name}</span>
							</div>
						</MobileToolbarItem>
					))}
				</MobileToolbarGroup>

				<MobileToolbarGroup label={m.editor_toolbar_highlight_group_label()}>
					{highlightColours.map(({ id, name, color }) => (
						<MobileToolbarItem
							key={id}
							onClick={() => handleSetHighlight(color)}
							active={currentHighlight === color}
						>
							<div className="flex items-center gap-2">
								<div
									className="rounded-sm border px-2"
									style={{
										backgroundColor: color,
									}}
								>
									A
								</div>
								<span>{name}</span>
							</div>
						</MobileToolbarItem>
					))}
				</MobileToolbarGroup>
			</div>
		);
	}

	return (
		<Popover>
			<div className="relative h-full">
				<Tooltip>
					<TooltipTrigger
						render={
							<PopoverTrigger
								disabled={isDisabled}
								render={
									<Button
										variant="ghost"
										size="sm"
										style={{
											color: currentColor,
										}}
										className={cn("h-8 w-14 p-0 font-normal")}
									>
										<span className="text-md">A</span>
										<ChevronDownIcon />
									</Button>
								}
							/>
						}
					/>
					<TooltipContent>{m.editor_toolbar_colour_tooltip()}</TooltipContent>
				</Tooltip>

				<PopoverContent align="start" className="w-56 p-1 dark:bg-gray-2">
					<ScrollArea className="max-h-80 overflow-y-auto pr-2">
						<div className="mt-2 mb-2.5 px-2 text-gray-11 text-xs">
							{m.editor_toolbar_colour_section_label()}
						</div>
						{textColours.map(({ id, name, color }) => (
							<ColorHighlightButton
								key={id}
								name={name}
								color={color}
								isActive={currentColor === color}
								onClick={() => handleSetColor(color)}
							/>
						))}

						<Separator className="my-3" />

						<div className="mb-2.5 w-full px-2 pr-3 text-gray-11 text-xs">
							{m.editor_toolbar_background_section_label()}
						</div>
						{highlightColours.map(({ id, name, color }) => (
							<ColorHighlightButton
								key={id}
								name={name}
								color={color}
								isActive={currentHighlight === color}
								onClick={() => handleSetHighlight(color)}
								isHighlight
							/>
						))}
					</ScrollArea>
				</PopoverContent>
			</div>
		</Popover>
	);
};
