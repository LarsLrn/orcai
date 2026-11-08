import { useNavigate } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { PAGE_SIZES } from "@/lib/browse/data-table-search-params";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const PAGE_SIZE_OPTIONS = PAGE_SIZES.map((pageSize) => ({
	value: `${pageSize}`,
	label: `${pageSize}`,
}));

const pageSizeOptions = (pageSize: number) =>
	PAGE_SIZES.includes(pageSize)
		? PAGE_SIZE_OPTIONS
		: [
				...PAGE_SIZE_OPTIONS,
				{
					value: `${pageSize}`,
					label: `${pageSize}`,
				},
			];

/** The last page's index; an empty collection still has a first page. */
const lastPageIndex = (rowCount: number, pageSize: number) =>
	Math.max(Math.ceil(rowCount / pageSize) - 1, 0);

/**
 * Replaces a `pageIndex` search param past the last page, such as after
 * deleting the last row of the last page or editing the URL.
 */
const useClampedPageIndex = ({
	rowCount,
	pageIndex,
	pageSize,
}: {
	rowCount: number;
	pageIndex: number;
	pageSize: number;
}) => {
	const navigate = useNavigate();
	const last = lastPageIndex(rowCount, pageSize);

	useEffect(() => {
		if (pageIndex > last) {
			void navigate({
				to: ".",
				replace: true,
				search: (prev) => ({
					...prev,
					pageIndex: last,
				}),
			});
		}
	}, [
		pageIndex,
		last,
		navigate,
	]);
};

type PagerProps = {
	pageIndex: number;
	pageCount: number;
	onPageIndexChange: (pageIndex: number) => void;
	/** A page is loading: the buttons keep their place and focus but do nothing. */
	pending?: boolean;
	className?: string;
} & (
	| {
			/** Page size choice, page x of n, first and last. */
			variant?: "full";
			pageSize: number;
			onPageSizeChange: (pageSize: number) => void;
	  }
	| {
			/** Previous, x / n and next, for dialogs; hidden with a single page. */
			variant: "compact";
			pageSize?: never;
			onPageSizeChange?: never;
	  }
);

const Pager = ({
	pageIndex,
	pageCount,
	onPageIndexChange,
	pending = false,
	className,
	...rest
}: PagerProps) => {
	const canPrevious = pageIndex > 0;
	const canNext = pageIndex < pageCount - 1;
	const compact = rest.variant === "compact";
	// Focusable while disabled, so a keyboard user stays on the button they pressed.
	const button = (
		label: string,
		enabled: boolean,
		target: number,
		Icon: typeof ChevronLeft,
		edge = false,
	) => (
		<Button
			variant={compact ? "ghost" : "outline"}
			size="icon-sm"
			className={cn("aria-disabled:opacity-50", edge && "hidden lg:flex")}
			aria-label={label}
			disabled={!enabled || pending}
			focusableWhenDisabled={!enabled || pending || undefined}
			onClick={() => onPageIndexChange(target)}
		>
			<Icon />
		</Button>
	);
	const previous = button(
		m.common_pagination_previous_page_label(),
		canPrevious,
		pageIndex - 1,
		ChevronLeft,
	);
	const next = button(
		m.common_pagination_next_page_label(),
		canNext,
		pageIndex + 1,
		ChevronRight,
	);

	if (rest.variant === "compact") {
		if (pageCount <= 1) return null;
		return (
			<nav
				aria-label={m.common_pagination_label()}
				className={cn("flex items-center justify-center gap-1", className)}
			>
				{previous}
				<span className="text-muted-foreground px-2 text-sm tabular-nums">
					{pageIndex + 1} / {pageCount}
				</span>
				{next}
			</nav>
		);
	}

	return (
		<nav
			aria-label={m.common_pagination_label()}
			className={cn(
				"flex flex-wrap items-center gap-x-6 gap-y-2 lg:gap-x-8",
				className,
			)}
		>
			<div className="flex items-center space-x-2">
				<OptionPicker
					label={m.data_table_pagination_rows_per_page_label()}
					options={pageSizeOptions(rest.pageSize)}
					value={`${rest.pageSize}`}
					onChange={(value) => rest.onPageSizeChange(Number(value))}
					side="top"
					className="h-8 w-20"
				/>
			</div>
			<div className="flex items-center space-x-2">
				<div className="flex w-25 items-center justify-center text-sm font-medium">
					{m.data_table_pagination_position({
						page: pageIndex + 1,
						pageCount,
					})}
				</div>
				{button(
					m.common_pagination_first_page_label(),
					canPrevious,
					0,
					ChevronsLeft,
					true,
				)}
				{previous}
				{next}
				{button(
					m.common_pagination_last_page_label(),
					canNext,
					pageCount - 1,
					ChevronsRight,
					true,
				)}
			</div>
		</nav>
	);
};

export { lastPageIndex, Pager, useClampedPageIndex };
