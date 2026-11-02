import { EncryptionKeyLive } from "@orcai/ai";
import { DrizzleLive } from "@orcai/db";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { configureEmbeddings, embeddingSettings } from "../src/generation";
import { QdrantLive } from "../src/service";

// The dev stack's embedding setting, unless an admin already saved one. No
// inference endpoint ships with the stack; change it on the Settings page.
const program = Effect.gen(function* () {
	if (yield* embeddingSettings) return;
	yield* configureEmbeddings({
		baseUrl: "http://127.0.0.1:11434/v1",
		apiKey: "dev-openai-compatible-key",
		model: "baai/bge-m3",
		dimensions: 1024,
	});
	yield* Effect.logInfo("Seeded the dev embedding setting");
});

await Effect.runPromise(
	program.pipe(
		Effect.provide(Layer.mergeAll(DrizzleLive, QdrantLive, EncryptionKeyLive)),
	),
);
