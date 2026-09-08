/** Standalone mock inference server on `E2E_INFERENCE_PORT`, the first `webServer` entry. */
import { startInferenceMock } from "./server";

const port = Number.parseInt(process.env.E2E_INFERENCE_PORT ?? "", 10);

if (!Number.isInteger(port) || port <= 0) {
	throw new Error(
		"E2E_INFERENCE_PORT must be a port number. The app has to know the mock's URL before it starts, so this entry does not take an ephemeral port.",
	);
}

const dimensions = Number.parseInt(process.env.EMBEDDING_DIMENSIONS ?? "", 10);

const mock = await startInferenceMock({
	port,
	embeddingDimensions: Number.isInteger(dimensions) ? dimensions : undefined,
});

process.stdout.write(`Mock inference server on ${mock.url}\n`);

for (const signal of [
	"SIGINT",
	"SIGTERM",
] as const) {
	process.once(signal, () => {
		void mock.close().then(() => {
			process.exit(0);
		});
	});
}
