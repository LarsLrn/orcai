import * as Resource from "@effect/opentelemetry/Resource";
import * as Tracer from "@effect/opentelemetry/Tracer";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { otelResource } from "@/lib/observability/resource-config";

const NodeSdkLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const resource = yield* Resource.Resource;

		const sdk = new NodeSDK({
			resource: resource.merge(otelResource),
			instrumentations: [
				getNodeAutoInstrumentations(),
				new ORPCInstrumentation(),
				new PinoInstrumentation(),
			],
		});

		yield* Effect.addFinalizer(() => Effect.promise(() => sdk.shutdown()));

		sdk.start();
	}),
);

export const TracerLive = Tracer.layerGlobal.pipe(
	Layer.provide(NodeSdkLive),
	Layer.provide(
		Resource.layer({
			serviceName: "my-service",
		}),
	),
);
