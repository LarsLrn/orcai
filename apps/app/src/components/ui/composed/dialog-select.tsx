import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
} from "react";
import { OptionPicker } from "@/components/ui/composed/option-picker";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
				"border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 flex w-fit min-w-0 items-center justify-between gap-1.5 rounded-4xl border px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				!hasValue && "text-muted-foreground",
				className,
			)}
			data-size={size}
			{...props}
		>
			<span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
				{hasValue ? children : placeholder}
			</span>
			<ChevronDownIcon className="text-muted-foreground size-4" />
		</DialogTrigger>
	);
}

function DialogSelectContent({
	className,
	children,
	title,
	...props
}: React.ComponentProps<typeof DialogContent> & {
	title: string;
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
				className="h-full border-none bg-transparent shadow-none ring-0 outline-none focus-visible:border-none focus-visible:ring-0"
				value={value}
				onChange={(e) => onValueChange(e.target.value)}
				{...props}
			/>
		</InputGroup>
	);
}

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
	placeholder = m.dialog_select_filter_placeholder(),
	className,
}: {
	options: DialogSelectFilterOption[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<OptionPicker
			options={options}
			value={value}
			onChange={onValueChange}
			placeholder={placeholder}
			size="sm"
			className={cn("h-8 text-xs", className)}
		/>
	);
}

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

function DialogSelectGroup({
	label,
	className,
	children,
	...props
}: React.ComponentProps<"fieldset"> & {
	label: string;
}) {
	return (
		<fieldset
			data-slot="dialog-select-group"
			className={cn("flex min-w-0 flex-col gap-1", className)}
			{...props}
		>
			<legend className="text-muted-foreground mb-1 px-3.5 pt-2 text-xs font-medium">
				{label}
			</legend>
			{children}
		</fieldset>
	);
}

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
				"hover:bg-muted cursor-pointer rounded-2xl transition-colors select-none",
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
				<CheckIcon className="text-primary ml-auto size-4 shrink-0" />
			)}
		</Item>
	);
}

function DialogSelectEmpty({
	className,
	children = m.dialog_select_empty_state(),
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-select-empty"
			className={cn(
				"text-muted-foreground flex flex-col items-center justify-center py-8 text-center text-sm",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

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
					<span className="text-muted-foreground px-2 text-sm">
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

export type { DialogSelectFilterOption };
export {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectFilter,
	DialogSelectFilters,
	DialogSelectGroup,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectPagination,
	DialogSelectSearch,
	DialogSelectTrigger,
};
