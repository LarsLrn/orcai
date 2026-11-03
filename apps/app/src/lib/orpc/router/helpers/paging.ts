import { DB } from "@orcai/db";
import { count, type Subquery } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { SortExpression } from "./sorting";

/** A select not yet ordered, limited or offset; drizzle's builders change in place. */
type Unpaged<Row, E, R> = Effect.Effect<Row[], E, R> & {
	as: (alias: string) => Subquery;
	orderBy: (...columns: SortExpression[]) => unknown;
	limit: (limit: number) => unknown;
	offset: (offset: number) => unknown;
};

/** One page of `query` in `orderBy`, and how many rows it has in all. */
export const pageOf = <Row, E, R>(
	query: Unpaged<Row, E, R>,
	page: {
		pageIndex: number;
		pageSize: number;
	},
	orderBy: readonly SortExpression[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const counted = db
			.select({
				count: count(),
			})
			.from(query.as("counted"));
		query.orderBy(...orderBy);
		query.limit(page.pageSize);
		query.offset(page.pageIndex * page.pageSize);
		const [data, [total]] = yield* Effect.all(
			[
				query,
				counted,
			],
			{
				concurrency: "unbounded",
			},
		);
		return {
			data,
			rowCount: total.count,
		};
	});
