import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as FiberMap from "effect/FiberMap";
import * as Layer from "effect/Layer";
import type { setUpActiveCollection } from "./generation";

/**
 * Each index's running collection setup by collection prefix, so callers
 * join one, and a caller that stops waiting leaves it running. The runtime's
 * scope interrupts what still runs when it closes.
 */
export class CollectionSetups extends Context.Service<
	CollectionSetups,
	FiberMap.FiberMap<
		string,
		Effect.Success<ReturnType<typeof setUpActiveCollection>>,
		Effect.Error<ReturnType<typeof setUpActiveCollection>>
	>
>()("CollectionSetups") {}

export const CollectionSetupsLive = Layer.effect(
	CollectionSetups,
	FiberMap.make(),
);
