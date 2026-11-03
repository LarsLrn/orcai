import { asc, desc, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type SortExpression = PgColumn | SQL;

/** The requested sort through the allowlist, else the default order; the tie-breaker keeps pages stable. */
export const buildOrderBy = <TKey extends string>({
	sort = [],
	allowlist,
	defaultOrder,
	tieBreaker,
}: {
	sort?: {
		id: TKey;
		desc: boolean;
	}[];
	allowlist: Record<TKey, SortExpression>;
	defaultOrder: SortExpression[];
	tieBreaker: {
		id: string;
		expression: SortExpression;
	};
}): SortExpression[] => {
	if (sort.length === 0) {
		return [
			...defaultOrder,
			asc(tieBreaker.expression),
		];
	}

	const orderBy = sort.map((item) =>
		item.desc ? desc(allowlist[item.id]) : asc(allowlist[item.id]),
	);

	return sort.some((item) => item.id === tieBreaker.id)
		? orderBy
		: [
				...orderBy,
				asc(tieBreaker.expression),
			];
};
