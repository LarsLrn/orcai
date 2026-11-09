import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../src/errors";
import { callSpiceDb } from "../src/service";

/** A token at SpiceDB's head revision, newer than every write that has returned. */
export const headZedToken = callSpiceDb("query", (spice) =>
	spice.checkPermission(
		v1.CheckPermissionRequest.create({
			consistency: v1.Consistency.create({
				requirement: {
					oneofKind: "fullyConsistent",
					fullyConsistent: true,
				},
			}),
			resource: v1.ObjectReference.create({
				objectType: "organization",
				objectId: "head-revision",
			}),
			permission: "read",
			subject: v1.SubjectReference.create({
				object: v1.ObjectReference.create({
					objectType: "user",
					objectId: "head-revision",
				}),
			}),
		}),
	),
).pipe(
	Effect.flatMap(({ checkedAt }) =>
		checkedAt
			? Effect.succeed(checkedAt.token)
			: Effect.fail(
					new SpiceDbError({
						operation: "query",
						cause: "SpiceDB answered without a zedToken",
					}),
				),
	),
);

/**
 * A zedToken covering every write the calls and `observe` have reported, for
 * calls that may return out of order. Tokens cannot be compared, so each
 * reported write is covered by a token from `head`, read after it. One head
 * read runs at a time, so each kept token is at least as new as the one
 * before; writes reported meanwhile share the next read, and a failed read
 * leaves the kept token as it was.
 */
export const zedTokenKeeper = (
	head: () => Promise<string>,
	initial?: string,
) => {
	let token = initial;
	let previous: Promise<unknown> = Promise.resolve();
	let waiting: Promise<void> | undefined;
	/** Covers the write `zedToken` stands for; rejects when the head read fails. */
	const observe = (zedToken: string | undefined) => {
		if (!zedToken) return Promise.resolve();
		if (waiting) return waiting;
		const read = previous
			.catch(() => undefined)
			.then(async () => {
				waiting = undefined;
				token = await head();
			});
		waiting = read;
		previous = read;
		return read;
	};
	const track = async <A>(
		call: () => Promise<A>,
		tokenOf: (result: A) => string | undefined,
	) => {
		const result = await call();
		await observe(tokenOf(result));
		return result;
	};
	return {
		read: () => token,
		observe,
		track,
	};
};

export type ZedTokenKeeper = ReturnType<typeof zedTokenKeeper>;
