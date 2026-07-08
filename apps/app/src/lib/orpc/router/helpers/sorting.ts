import { asc, desc, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

export type SortExpression = PgColumn | SQL;

type SortItem<TKey extends string> = {
	id: TKey;
	desc: boolean;
};

type BuildOrderByParams<TKey extends string> = {
	sort?: SortItem<TKey>[];
	allowlist: Record<TKey, SortExpression>;
	defaultOrder: SortExpression[];
	tieBreaker: {
		id: string;
		expression: SortExpression;
	};
};

export const buildOrderBy = <TKey extends string>({
	sort,
	allowlist,
	defaultOrder,
	tieBreaker,
}: BuildOrderByParams<TKey>) =>
	Effect.gen(function* () {
		const requestedSort = sort ?? [];

		if (requestedSort.length === 0) {
			return [
				...defaultOrder,
				asc(tieBreaker.expression),
			];
		}

		const usedSortIds = new Set<string>();
		const orderBy: SortExpression[] = [];

		for (const item of requestedSort) {
			const expression = allowlist[item.id];

			if (!expression) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: `Unsupported sort key: ${item.id}`,
						data: {
							sortKey: item.id,
							allowedSortKeys: Object.keys(allowlist),
						},
					}),
				);
			}

			usedSortIds.add(item.id);
			orderBy.push(item.desc ? desc(expression) : asc(expression));
		}

		if (!usedSortIds.has(tieBreaker.id)) {
			orderBy.push(asc(tieBreaker.expression));
		}

		return orderBy;
	});
