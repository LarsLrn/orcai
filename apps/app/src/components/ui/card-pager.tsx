import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Pager } from "@/components/ui/pager";
import { DEFAULT_PAGE_SIZE } from "@/lib/browse/data-table-search-params";

/** Pager under a card grid, paging through the `pageIndex` and `pageSize` search params. */
export const CardPager = ({
	rowCount,
	pageIndex,
	pageSize,
}: {
	rowCount: number;
	pageIndex: number;
	pageSize: number;
}) => {
	const navigate = useNavigate();
	// Until a navigation lands, the shown page is stale: paging from it skips pages.
	const navigating = useRouterState({
		select: (state) => state.isLoading,
	});
	const pageCount = Math.ceil(rowCount / pageSize);

	if (pageCount <= 1 && rowCount <= DEFAULT_PAGE_SIZE && pageIndex === 0) {
		return null;
	}

	return (
		<div className="flex justify-end">
			<Pager
				pageIndex={pageIndex}
				pageSize={pageSize}
				pageCount={pageCount}
				pending={navigating}
				onPageIndexChange={(next) =>
					void navigate({
						to: ".",
						search: (prev) => ({
							...prev,
							pageIndex: next,
						}),
					})
				}
				onPageSizeChange={(next) =>
					void navigate({
						to: ".",
						search: (prev) => ({
							...prev,
							pageSize: next,
							pageIndex: 0,
						}),
					})
				}
			/>
		</div>
	);
};
