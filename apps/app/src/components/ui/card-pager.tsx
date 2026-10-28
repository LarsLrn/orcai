import { paginationInputSchema } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod/v4";
import { DEFAULT_PAGE_SIZE, Pager } from "@/components/ui/pager";

/** Search params of a library page with a published and a draft grid. */
export const libraryPagingSchema = paginationInputSchema.extend({
	draftPageIndex: z.coerce.number().min(0).default(0),
});

export const libraryPagingDefaults = {
	pageIndex: 0,
	pageSize: DEFAULT_PAGE_SIZE,
	draftPageIndex: 0,
};

/**
 * Replaces a page index past the last page, such as after deleting the last
 * card of the last page or editing the URL. Runs whether or not the grid is
 * rendered, so an empty collection is normalized too.
 */
export const useClampedPageIndex = ({
	rowCount,
	pageIndex,
	pageSize,
	indexKey = "pageIndex",
}: {
	rowCount: number;
	pageIndex: number;
	pageSize: number;
	indexKey?: "pageIndex" | "draftPageIndex";
}) => {
	const navigate = useNavigate();
	const lastPageIndex = Math.max(Math.ceil(rowCount / pageSize) - 1, 0);

	useEffect(() => {
		if (pageIndex > lastPageIndex) {
			void navigate({
				to: ".",
				replace: true,
				search: (prev) => ({
					...prev,
					[indexKey]: lastPageIndex,
				}),
			});
		}
	}, [
		pageIndex,
		lastPageIndex,
		indexKey,
		navigate,
	]);
};

/**
 * Pager under a card grid. `indexKey` is the search param holding the page
 * of this grid; the page size is shared by every grid of the route.
 */
export const CardPager = ({
	rowCount,
	pageIndex,
	pageSize,
	indexKey = "pageIndex",
}: {
	rowCount: number;
	pageIndex: number;
	pageSize: number;
	indexKey?: "pageIndex" | "draftPageIndex";
}) => {
	const navigate = useNavigate();
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
				onPageIndexChange={(next) =>
					void navigate({
						to: ".",
						search: (prev) => ({
							...prev,
							[indexKey]: next,
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
							...("draftPageIndex" in prev
								? {
										draftPageIndex: 0,
									}
								: {}),
						}),
					})
				}
			/>
		</div>
	);
};
