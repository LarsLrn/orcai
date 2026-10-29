import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DEFAULT_PAGE_SIZE, Pager } from "@/components/ui/pager";

/**
 * Replaces a page index past the last page, such as after deleting the last
 * card of the last page or editing the URL. Runs whether or not the grid is
 * rendered, so an empty collection is normalized too.
 */
export const useClampedPageIndex = ({
	rowCount,
	pageIndex,
	pageSize,
}: {
	rowCount: number;
	pageIndex: number;
	pageSize: number;
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
					pageIndex: lastPageIndex,
				}),
			});
		}
	}, [
		pageIndex,
		lastPageIndex,
		navigate,
	]);
};

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
