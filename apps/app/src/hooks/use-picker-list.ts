import {
	hashKey,
	type QueryKey,
	type UseQueryOptions,
	useQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { lastPageIndex } from "@/components/ui/pager";

type PickerPage<TItem> = {
	data: TItem[];
	rowCount: number;
};

type PickerPageInput = {
	pageIndex: number;
	pageSize: number;
	/** The debounced, trimmed search; undefined when empty. */
	search: string | undefined;
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * A picker's searchable, paged list. A new search or filter starts on the
 * first page, the pager keeps the list's count while another of its pages
 * loads, a page past the end moves to the last one, and a closed picker
 * (`open` false) forgets its search and page. Rows of another page or search
 * are not shown while the next one is typed or read.
 */
export const usePickerList = <TItem, TError, TQueryKey extends QueryKey>({
	pageSize,
	open = true,
	queryOptions,
}: {
	pageSize: number;
	open?: boolean;
	queryOptions: (
		input: PickerPageInput,
	) => UseQueryOptions<PickerPage<TItem>, TError, PickerPage<TItem>, TQueryKey>;
}) => {
	const [search, setSearchValue] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useDebounceValue(
		search,
		SEARCH_DEBOUNCE_MS,
	);
	const query = debouncedSearch.trim() || undefined;
	// The list without its page: a new search or filter is another list.
	const listKey = hashKey(
		queryOptions({
			pageIndex: 0,
			pageSize,
			search: query,
		}).queryKey,
	);

	const [paged, setPaged] = useState({
		listKey,
		pageIndex: 0,
	});
	const [counted, setCounted] = useState({
		listKey,
		rowCount: -1,
	});
	const rowCount = counted.listKey === listKey ? counted.rowCount : -1;
	const storedPageIndex = paged.listKey === listKey ? paged.pageIndex : 0;
	const pageIndex =
		rowCount < 0
			? storedPageIndex
			: Math.min(storedPageIndex, lastPageIndex(rowCount, pageSize));
	if (pageIndex !== paged.pageIndex || paged.listKey !== listKey) {
		setPaged({
			listKey,
			pageIndex,
		});
	}

	const options = queryOptions({
		pageIndex,
		pageSize,
		search: query,
	});
	const list = useQuery({
		...options,
		enabled: open ? options.enabled : false,
	});
	// Placeholder data is another page's or another search's.
	const page = list.isPlaceholderData ? undefined : list.data;
	if (
		page !== undefined &&
		(counted.listKey !== listKey || counted.rowCount !== page.rowCount)
	) {
		setCounted({
			listKey,
			rowCount: page.rowCount,
		});
	}

	useEffect(() => {
		if (open) return;
		setSearchValue("");
		setDebouncedSearch("");
		setDebouncedSearch.flush();
		setPaged((current) => ({
			...current,
			pageIndex: 0,
		}));
	}, [
		open,
		setDebouncedSearch,
	]);

	const setSearch = useCallback((value: string) => {
		setSearchValue(value);
		setPaged((current) => ({
			...current,
			pageIndex: 0,
		}));
	}, []);
	const loading =
		search.trim() !== debouncedSearch.trim() ||
		list.isLoading ||
		list.isPlaceholderData;

	return {
		search,
		setSearch,
		/** The debounced search the list was read with. */
		query,
		list,
		rows: list.isError ? [] : (page?.data ?? []),
		/** Debouncing a search or reading a page that is not cached yet. */
		loading,
		pager: {
			pageIndex,
			pageCount: rowCount < 0 ? 0 : Math.ceil(rowCount / pageSize),
			onPageIndexChange: (next: number) =>
				setPaged({
					listKey,
					pageIndex: next,
				}),
			pending: loading,
		},
	};
};
