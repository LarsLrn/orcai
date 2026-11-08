/** Standalone mock inference server on `E2E_INFERENCE_PORT`, the first `webServer` entry. */
import { startInferenceMock } from "@orcai/ai/testing";

const port = Number.parseInt(process.env.E2E_INFERENCE_PORT ?? "", 10);

if (!Number.isInteger(port) || port <= 0) {
	throw new Error(
		"E2E_INFERENCE_PORT must be a port number. The setup project saves the mock's URL as the embedding endpoint, so this entry does not take an ephemeral port.",
	);
}

const mock = await startInferenceMock({
	port,
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
