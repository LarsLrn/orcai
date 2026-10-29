import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
	return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxInputGroup({
	className,
	...props
}: ComboboxPrimitive.InputGroup.Props) {
	return (
		<ComboboxPrimitive.InputGroup
			data-slot="combobox-input-group"
			className={cn(
				"relative flex min-h-9 w-full cursor-text items-center rounded-3xl border border-transparent bg-input/50 py-[calc(--spacing(1)-1px)] pr-9 pl-[calc(--spacing(1.5)-1px)] transition-[color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxChips({ className, ...props }: ComboboxPrimitive.Chips.Props) {
	return (
		<ComboboxPrimitive.Chips
			data-slot="combobox-chips"
			className={cn(
				"flex min-w-0 flex-1 flex-wrap items-center gap-1",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxChip({
	className,
	children,
	removeLabel,
	...props
}: ComboboxPrimitive.Chip.Props & {
	removeLabel: string;
}) {
	return (
		<ComboboxPrimitive.Chip
			data-slot="combobox-chip"
			className={cn(
				"flex h-7 min-w-0 cursor-default items-center gap-1 rounded-full border bg-background py-0 pr-1 pl-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-highlighted:ring-2 data-highlighted:ring-ring/50",
				className,
			)}
			{...props}
		>
			<span className="truncate">{children}</span>
			<ComboboxPrimitive.ChipRemove
				data-slot="combobox-chip-remove"
				aria-label={removeLabel}
				className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<XIcon className="size-3.5" />
			</ComboboxPrimitive.ChipRemove>
		</ComboboxPrimitive.Chip>
	);
}

function ComboboxChipsInput({
	className,
	...props
}: ComboboxPrimitive.Input.Props) {
	return (
		<ComboboxPrimitive.Input
			data-slot="combobox-chips-input"
			className={cn(
				"h-7 min-w-24 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxTrigger({
	className,
	...props
}: ComboboxPrimitive.Trigger.Props) {
	return (
		<ComboboxPrimitive.Trigger
			data-slot="combobox-trigger"
			className={cn(
				"absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none",
				className,
			)}
			{...props}
		>
			<ChevronDownIcon className="size-4" />
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxContent({
	className,
	side = "bottom",
	sideOffset = 6,
	align = "start",
	alignOffset = 0,
	...props
}: ComboboxPrimitive.Popup.Props &
	Pick<
		ComboboxPrimitive.Positioner.Props,
		"side" | "align" | "sideOffset" | "alignOffset"
	>) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className="isolate z-50"
			>
				<ComboboxPrimitive.Popup
					data-slot="combobox-content"
					className={cn(
						"dark data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 relative isolate z-50 flex max-h-[min(var(--available-height),22rem)] w-(--anchor-width) min-w-56 max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-3xl bg-popover/70 p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 duration-100 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 data-closed:animate-out data-open:animate-in dark:ring-foreground/10",
						className,
					)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
	return (
		<ComboboxPrimitive.List
			data-slot="combobox-list"
			className={cn(
				"min-h-0 flex-1 scroll-py-1 overflow-y-auto overscroll-contain",
				className,
			)}
			{...props}
		/>
	);
}

/** An item with a checkbox mark, for multiple selection. */
function ComboboxItem({
	className,
	children,
	...props
}: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-item"
			className={cn(
				"group/combobox-item relative flex cursor-default select-none items-center gap-2.5 rounded-2xl px-3 py-2 text-sm outline-hidden data-disabled:pointer-events-none data-highlighted:bg-foreground/10 data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<span className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-foreground/15 group-data-selected/combobox-item:bg-primary group-data-selected/combobox-item:text-primary-foreground">
				<ComboboxPrimitive.ItemIndicator>
					<CheckIcon className="size-3" strokeWidth={3} />
				</ComboboxPrimitive.ItemIndicator>
			</span>
			<span className="min-w-0 flex-1">{children}</span>
		</ComboboxPrimitive.Item>
	);
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			data-slot="combobox-empty"
			className={cn(
				"px-3 py-2 text-muted-foreground text-sm empty:hidden",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInputGroup,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
};
