import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { m } from "@/paraglide/messages";

const PAGE_SIZES = [
	20,
	30,
	50,
	100,
	200,
];

const PAGE_SIZE_OPTIONS = PAGE_SIZES.map((pageSize) => ({
	value: `${pageSize}`,
	label: `${pageSize}`,
}));

const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

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

const Pager = ({
	pageIndex,
	pageSize,
	pageCount,
	onPageIndexChange,
	onPageSizeChange,
}: {
	pageIndex: number;
	pageSize: number;
	pageCount: number;
	onPageIndexChange: (pageIndex: number) => void;
	onPageSizeChange: (pageSize: number) => void;
}) => {
	const canPrevious = pageIndex > 0;
	const canNext = pageIndex < pageCount - 1;

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:gap-x-8">
			<div className="flex items-center space-x-2">
				<p className="whitespace-nowrap font-medium text-sm">
					{m.data_table_pagination_rows_per_page_label()}
				</p>
				<OptionPicker
					options={pageSizeOptions(pageSize)}
					value={`${pageSize}`}
					onChange={(value) => onPageSizeChange(Number(value))}
					side="top"
					className="h-8 w-20"
				/>
			</div>
			<div className="flex items-center space-x-2">
				<div className="flex w-25 items-center justify-center font-medium text-sm">
					{m.data_table_pagination_position({
						page: pageIndex + 1,
						pageCount,
					})}
				</div>
				<Button
					variant="outline"
					className="hidden h-8 w-8 p-0 lg:flex"
					onClick={() => onPageIndexChange(0)}
					disabled={!canPrevious}
				>
					<span className="sr-only">
						{m.common_pagination_first_page_label()}
					</span>
					<ChevronsLeft />
				</Button>
				<Button
					variant="outline"
					className="h-8 w-8 p-0"
					onClick={() => onPageIndexChange(pageIndex - 1)}
					disabled={!canPrevious}
				>
					<span className="sr-only">
						{m.common_pagination_previous_page_label()}
					</span>
					<ChevronLeft />
				</Button>
				<Button
					variant="outline"
					className="h-8 w-8 p-0"
					onClick={() => onPageIndexChange(pageIndex + 1)}
					disabled={!canNext}
				>
					<span className="sr-only">
						{m.common_pagination_next_page_label()}
					</span>
					<ChevronRight />
				</Button>
				<Button
					variant="outline"
					className="hidden h-8 w-8 p-0 lg:flex"
					onClick={() => onPageIndexChange(pageCount - 1)}
					disabled={!canNext}
				>
					<span className="sr-only">
						{m.common_pagination_last_page_label()}
					</span>
					<ChevronsRight />
				</Button>
			</div>
		</div>
	);
};

export { DEFAULT_PAGE_SIZE, Pager };
