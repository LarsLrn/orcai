import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";

/** A Qdrant client call, its rejection a `QdrantError` named for `operation`. */
export const qdrantCall = <A>(operation: string, call: () => Promise<A>) =>
	Effect.tryPromise({
		try: call,
		catch: (cause) =>
			new QdrantError({
				operation,
				cause,
			}),
	});
