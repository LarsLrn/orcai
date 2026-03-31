import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
} from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Select,
	SelectContent as SelectDropdownContent,
	SelectItem as SelectDropdownItem,
	SelectTrigger as SelectDropdownTrigger,
	SelectValue as SelectDropdownValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type DialogSelectContextValue = {
	multiple: boolean;
	value: string | null;
	values: string[];
	onSelect: (itemValue: string) => void;
	setOpen: (open: boolean) => void;
};

const DialogSelectContext = createContext<DialogSelectContextValue | null>(
	null,
);

function useDialogSelectContext() {
	const ctx = useContext(DialogSelectContext);
	if (!ctx) {
		throw new Error(
			"DialogSelect compound components must be used within <DialogSelect>",
		);
	}
	return ctx;
}

// ---------------------------------------------------------------------------
// DialogSelect (root)
// ---------------------------------------------------------------------------

type DialogSelectProps = {
	children: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
} & (
	| {
			multiple?: false;
			value: string | null;
			onValueChange: (value: string | null) => void;
			values?: never;
			onValuesChange?: never;
	  }
	| {
			multiple: true;
			values: string[];
			onValuesChange: (values: string[]) => void;
			value?: never;
			onValueChange?: never;
	  }
);

function DialogSelect({
	children,
	open,
	onOpenChange,
	...rest
}: DialogSelectProps) {
	const multiple = rest.multiple === true;

	const handleSelect = useCallback(
		(itemValue: string) => {
			if (multiple) {
				const current = rest.values;
				const next = current.includes(itemValue)
					? current.filter((v) => v !== itemValue)
					: [
							...current,
							itemValue,
						];
				rest.onValuesChange(next);
			} else {
				rest.onValueChange(itemValue);
				onOpenChange?.(false);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			multiple,
			rest.values,
			rest.onValuesChange,
			rest.onValueChange,
			onOpenChange,
		],
	);

	const ctx = useMemo<DialogSelectContextValue>(
		() => ({
			multiple,
			value: multiple ? null : (rest.value ?? null),
			values: multiple ? rest.values : [],
			onSelect: handleSelect,
			setOpen: (v) => onOpenChange?.(v),
		}),
		[
			multiple,
			rest.value,
			rest.values,
			handleSelect,
			onOpenChange,
		],
	);

	return (
		<DialogSelectContext.Provider value={ctx}>
			<Dialog open={open} onOpenChange={onOpenChange}>
				{children}
			</Dialog>
		</DialogSelectContext.Provider>
	);
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

function DialogSelectTrigger({
	className,
	children,
	placeholder,
	size = "default",
	...props
}: React.ComponentProps<typeof DialogTrigger> & {
	placeholder?: string;
	size?: "sm" | "default";
}) {
	const hasValue =
		children !== undefined && children !== null && children !== "";

	return (
		<DialogTrigger
			className={cn(
				"flex w-fit items-center justify-between gap-1.5 whitespace-nowrap rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				!hasValue && "text-muted-foreground",
				className,
			)}
			data-size={size}
			{...props}
		>
			<span className="flex flex-1 items-center gap-1.5 truncate text-left">
				{hasValue ? children : placeholder}
			</span>
			<ChevronDownIcon className="size-4 text-muted-foreground" />
		</DialogTrigger>
	);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function DialogSelectContent({
	className,
	children,
	title = "Select an item",
	...props
}: React.ComponentProps<typeof DialogContent> & {
	title?: string;
}) {
	return (
		<DialogContent
			className={cn("flex max-h-[80vh] flex-col gap-4 sm:max-w-2xl", className)}
			{...props}
		>
			<DialogTitle className="sr-only">{title}</DialogTitle>
			{children}
		</DialogContent>
	);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function DialogSelectSearch({
	className,
	value,
	onValueChange,
	...props
}: Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
	value: string;
	onValueChange: (value: string) => void;
}) {
	return (
		<InputGroup className={cn("h-9", className)}>
			<InputGroupAddon>
				<SearchIcon className="size-4 shrink-0 opacity-50" />
			</InputGroupAddon>
			<Input
				data-slot="input-group-control"
				className="h-full border-none bg-transparent shadow-none outline-none ring-0 focus-visible:border-none focus-visible:ring-0"
				value={value}
				onChange={(e) => onValueChange(e.target.value)}
				{...props}
			/>
		</InputGroup>
	);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function DialogSelectFilters({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-select-filters"
			className={cn("flex flex-wrap items-center gap-2", className)}
			{...props}
		/>
	);
}

type DialogSelectFilterOption = {
	value: string;
	label: string;
};

function DialogSelectFilter({
	options,
	value,
	onValueChange,
	placeholder = "Filter",
	className,
}: {
	options: DialogSelectFilterOption[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<Select value={value} onValueChange={(v) => onValueChange(v ?? value)}>
			<SelectDropdownTrigger className={cn("h-8 text-xs", className)} size="sm">
				<SelectDropdownValue>
					{(v) => options.find((o) => o.value === v)?.label ?? placeholder}
				</SelectDropdownValue>
			</SelectDropdownTrigger>
			<SelectDropdownContent>
				{options.map((option) => (
					<SelectDropdownItem key={option.value} value={option.value}>
						{option.label}
					</SelectDropdownItem>
				))}
			</SelectDropdownContent>
		</Select>
	);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function DialogSelectList({
	className,
	children,
	loading = false,
	...props
}: React.ComponentProps<"div"> & {
	loading?: boolean;
}) {
	return (
		<div
			data-slot="dialog-select-list"
			className={cn(
				"no-scrollbar -mx-1 flex max-h-80 flex-col gap-1 overflow-y-auto px-1",
				className,
			)}
			{...props}
		>
			{loading ? <DialogSelectLoading /> : children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

function DialogSelectItem({
	value: itemValue,
	title,
	description,
	icon,
	trailing,
	disabled = false,
	className,
}: {
	value: string;
	title: string;
	description?: string;
	icon?: ReactNode;
	trailing?: ReactNode;
	disabled?: boolean;
	className?: string;
}) {
	const ctx = useDialogSelectContext();
	const isSelected = ctx.multiple
		? ctx.values.includes(itemValue)
		: ctx.value === itemValue;

	return (
		<Item
			size="sm"
			variant="default"
			className={cn(
				"cursor-pointer select-none rounded-2xl transition-colors hover:bg-muted",
				isSelected && "bg-muted",
				disabled && "pointer-events-none opacity-50",
				className,
			)}
			role="option"
			aria-selected={isSelected}
			aria-disabled={disabled}
			onClick={() => {
				if (!disabled) ctx.onSelect(itemValue);
			}}
			onKeyDown={(e) => {
				if (!disabled && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					ctx.onSelect(itemValue);
				}
			}}
			tabIndex={disabled ? -1 : 0}
		>
			{icon && <ItemMedia variant="icon">{icon}</ItemMedia>}
			<ItemContent>
				<ItemTitle>{title}</ItemTitle>
				{description && <ItemDescription>{description}</ItemDescription>}
			</ItemContent>
			{trailing && <div className="ml-auto shrink-0">{trailing}</div>}
			{isSelected && (
				<CheckIcon className="ml-auto size-4 shrink-0 text-primary" />
			)}
		</Item>
	);
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

function DialogSelectEmpty({
	className,
	children = "No results found.",
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-select-empty"
			className={cn(
				"flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-sm",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function DialogSelectLoading({
	rows = 4,
	className,
}: {
	rows?: number;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-1", className)}>
			{Array.from({
				length: rows,
			}).map((_, i) => (
				<div
					key={`skeleton-${String(i)}`}
					className="flex items-center gap-3.5 rounded-2xl px-3.5 py-3"
				>
					<Skeleton className="size-8 shrink-0 rounded-lg" />
					<div className="flex flex-1 flex-col gap-1.5">
						<Skeleton className="h-3.5 w-1/3" />
						<Skeleton className="h-3 w-2/3" />
					</div>
				</div>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function DialogSelectPagination({
	page,
	pageCount,
	onPageChange,
	className,
}: {
	page: number;
	pageCount: number;
	onPageChange: (page: number) => void;
	className?: string;
}) {
	if (pageCount <= 1) return null;

	return (
		<Pagination className={cn("pt-2", className)}>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						onClick={() => onPageChange(Math.max(0, page - 1))}
						aria-disabled={page <= 0}
						className={cn(page <= 0 && "pointer-events-none opacity-50")}
					/>
				</PaginationItem>
				<PaginationItem>
					<span className="px-2 text-muted-foreground text-sm">
						{page + 1} / {pageCount}
					</span>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext
						onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
						aria-disabled={page >= pageCount - 1}
						className={cn(
							page >= pageCount - 1 && "pointer-events-none opacity-50",
						)}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { DialogSelectFilterOption, DialogSelectProps };
export {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectFilter,
	DialogSelectFilters,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectLoading,
	DialogSelectPagination,
	DialogSelectSearch,
	DialogSelectTrigger,
};
