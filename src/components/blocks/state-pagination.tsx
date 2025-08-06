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
			return Array.from({ length: maxPages }, (_, i) => i);
		}

		const half = Math.floor(maxVisiblePages / 2);
		let start = Math.max(0, page - half);
		const end = Math.min(maxPages - 1, start + maxVisiblePages - 1);

		// Adjust start if we're near the end
		if (end - start + 1 < maxVisiblePages) {
			start = Math.max(0, end - maxVisiblePages + 1);
		}

		return Array.from({ length: end - start + 1 }, (_, i) => start + i);
	};

	const visiblePages = getVisiblePages();

	return (
		<div className="flex space-x-2">
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<Button
							variant="ghost"
							onClick={() => onPageChange(0)}
							disabled={page <= 0}
						>
							<ChevronsLeftIcon />
						</Button>
					</PaginationItem>
					<PaginationItem>
						<Button
							variant="ghost"
							onClick={() => onPageChange(page - 1)}
							disabled={page <= 0}
						>
							<ChevronLeftIcon />
						</Button>
					</PaginationItem>
					{visiblePages.map((pageIndex) => (
						<PaginationItem key={pageIndex}>
							<Button
								variant="ghost"
								onClick={() => onPageChange(pageIndex)}
								disabled={page === pageIndex}
							>
								{pageIndex + 1}
							</Button>
						</PaginationItem>
					))}
					<PaginationItem>
						<Button
							variant="ghost"
							onClick={() => onPageChange(page + 1)}
							disabled={page >= maxPages - 1}
						>
							<ChevronRightIcon />
						</Button>
					</PaginationItem>
					<PaginationItem>
						<Button
							variant="ghost"
							onClick={() => onPageChange(maxPages - 1)}
							disabled={page >= maxPages - 1}
						>
							<ChevronsRightIcon />
						</Button>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
};

export { StatePagination };
