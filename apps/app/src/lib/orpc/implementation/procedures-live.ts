import { createEffectClient } from "@orpc/effect";
import { createRouterClient } from "@orpc/server";
import * as Layer from "effect/Layer";
import { router } from "@/lib/orpc/router";
import type { ORPCContext } from "./os";
import { Procedures } from "./procedures";

// Typed by hand: the router's type depends on the app's services, which include this layer.
export const ProceduresLive: Layer.Layer<Procedures> = Layer.sync(
	Procedures,
	() =>
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
);
