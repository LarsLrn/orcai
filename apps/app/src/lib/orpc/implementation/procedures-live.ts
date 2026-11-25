import { createEffectClient } from "@orpc/effect";
import { createRouterClient } from "@orpc/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { ORPCContext } from "./os";
import { Procedures } from "./procedures";

// The router imports code that calls procedures, so it loads when the layer builds.
export const ProceduresLive: Layer.Layer<Procedures> = Layer.effect(
	Procedures,
	Effect.promise(() => import("@/lib/orpc/router")).pipe(
		Effect.map(({ router }) =>
			createEffectClient(
				createRouterClient(router, {
					context: (context: ORPCContext) => context,
					interceptors: [
						// An assistant turn keeps what its calls wrote, for the client to refresh.
						({ context, path, input, next }) => {
							const turnWrites = context.meta?.turnWrites;
							if (!turnWrites) return next();
							return next().then((output) => {
								turnWrites.record(path, input, output);
								return output;
							});
						},
					],
				}),
			),
		),
	),
);
