import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
} from "@/components/ui/pagination";
import { m } from "@/paraglide/messages";

const StatePagination = ({
	maxPages,
	page,
	onPageChange,
	maxVisiblePages = 3,
}: {
	maxPages: number;
	page: number;
	onPageChange: (page: number) => void;
	maxVisiblePages?: number;
}) => {
	// Calculate which pages to show
	const getVisiblePages = () => {
		if (maxPages <= maxVisiblePages) {
			// Show all pages if total pages is less than or equal to max visible
			return Array.from(
				{
					length: maxPages,
				},
				(_, i) => i,
			);
		}

		const half = Math.floor(maxVisiblePages / 2);
		let start = Math.max(0, page - half);
		const end = Math.min(maxPages - 1, start + maxVisiblePages - 1);

		// Adjust start if we're near the end
		if (end - start + 1 < maxVisiblePages) {
			start = Math.max(0, end - maxVisiblePages + 1);
		}

		return Array.from(
			{
				length: end - start + 1,
			},
			(_, i) => start + i,
		);
	};

	const visiblePages = getVisiblePages();

	return (
		<div className="flex space-x-2">
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<Button
							variant="ghost"
							aria-label={m.state_pagination_first_page_aria_label()}
							onClick={() => onPageChange(0)}
							disabled={page <= 0}
						>
							<ChevronsLeftIcon aria-hidden="true" />
						</Button>
					</PaginationItem>
					<PaginationItem>
						<Button
							variant="ghost"
							aria-label={m.state_pagination_previous_page_aria_label()}
							onClick={() => onPageChange(page - 1)}
							disabled={page <= 0}
						>
							<ChevronLeftIcon aria-hidden="true" />
						</Button>
					</PaginationItem>
					{visiblePages.map((pageIndex) => (
						<PaginationItem key={pageIndex}>
							<Button
								variant="ghost"
								onClick={() => onPageChange(pageIndex)}
								disabled={page === pageIndex}
								aria-current={page === pageIndex ? "page" : undefined}
							>
								{pageIndex + 1}
							</Button>
						</PaginationItem>
					))}
					<PaginationItem>
						<Button
							variant="ghost"
							aria-label={m.state_pagination_next_page_aria_label()}
							onClick={() => onPageChange(page + 1)}
							disabled={page >= maxPages - 1}
						>
							<ChevronRightIcon aria-hidden="true" />
						</Button>
					</PaginationItem>
					<PaginationItem>
						<Button
							variant="ghost"
							aria-label={m.state_pagination_last_page_aria_label()}
							onClick={() => onPageChange(maxPages - 1)}
							disabled={page >= maxPages - 1}
						>
							<ChevronsRightIcon aria-hidden="true" />
						</Button>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
};

export { StatePagination };
