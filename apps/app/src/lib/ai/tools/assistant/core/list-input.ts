import { z } from "zod/v4";

/** Items per page of every Assistant list and find tool. */
export const LIST_PAGE_SIZE = 25;

export const listPageSchema = z
	.number()
	.int()
	.min(1)
	.default(1)
	.describe(
		"Page to return, from 1. Pass the previous output's nextPage to read on.",
	);

export const listQuerySchema = z
	.string()
	.trim()
	.max(100)
	.optional()
	.describe("Part of the name to search for, case-insensitive.");

/** The procedure paging for one page of a list tool. */
export const listPage = (page: number) => ({
	pageIndex: page - 1,
	pageSize: LIST_PAGE_SIZE,
});

/** The paging fields every list tool returns beside its items. */
export const listPaging = (page: number, total: number) => {
	const hasMore = page * LIST_PAGE_SIZE < total;

	return {
		total,
		hasMore,
		nextPage: hasMore ? page + 1 : null,
	};
};

/** Description sentence for the paging every list tool shares. */
export const PAGING_NOTE = `It returns ${LIST_PAGE_SIZE} matches per page, and every page carries the total, so the first page already tells how many there are. Call it again with nextPage while hasMore is true only when you need the matches themselves, such as for a full list. Before changing several matches, read every page first, because a change removes or reorders matches and later pages would then skip some.`;
