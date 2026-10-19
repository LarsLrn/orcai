import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

export type CompletionGate = {
	/** Base URL ending in `/v1`, ready for a provider `endpoint`. */
	url: string;
	/** Chat completion requests waiting for the gate to open. */
	held: () => number;
	/** Requests the app closed before their response ended. */
	abandoned: () => number;
	/** Let every waiting and later completion through. */
	open: () => void;
	/** Hold completions again from the next request on. */
	close: () => void;
	stop: () => Promise<void>;
};

const HOP_HEADERS = new Set([
	"connection",
	"content-encoding",
	"content-length",
	"transfer-encoding",
]);

const readBody = async (request: IncomingMessage): Promise<Buffer> => {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks);
};

/**
 * A proxy in front of the inference mock that holds chat completions until
 * the spec opens it, so a spec controls when a reply finishes.
 */
export const startCompletionGate = async (
	target: string,
): Promise<CompletionGate> => {
	const origin = new URL(target).origin;
	let isOpen = true;
	let waiting: (() => void)[] = [];
	let abandoned = 0;

	const server = createServer(async (request, response) => {
		response.on("close", () => {
			if (!response.writableEnded) abandoned += 1;
		});
		const body = await readBody(request);
		const path = request.url ?? "/";

		if (
			request.method === "POST" &&
			path.startsWith("/v1/chat/completions") &&
			!isOpen
		) {
			await new Promise<void>((resolve) => waiting.push(resolve));
			if (response.destroyed) return;
		}

		const upstream = await fetch(`${origin}${path}`, {
			method: request.method,
			headers: Object.fromEntries(
				Object.entries(request.headers).flatMap(([name, value]) =>
					typeof value === "string" && name !== "host"
						? [
								[
									name,
									value,
								],
							]
						: [],
				),
			),
			body: request.method === "GET" ? undefined : body,
		});

		response.writeHead(
			upstream.status,
			Object.fromEntries(
				[
					...upstream.headers,
				].filter(([name]) => !HOP_HEADERS.has(name)),
			),
		);
		if (upstream.body) {
			for await (const chunk of upstream.body) response.write(chunk);
		}
		response.end();
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${port}/v1`,
		held: () => waiting.length,
		abandoned: () => abandoned,
		open: () => {
			isOpen = true;
			for (const release of waiting) release();
			waiting = [];
		},
		close: () => {
			isOpen = false;
		},
		stop: () =>
			new Promise<void>((resolve, reject) => {
				server.closeAllConnections();
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};
};
