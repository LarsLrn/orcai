import { afterEach, expect, test } from "bun:test";
import { type AddressInfo, createServer, type Server } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { EmailLive, EmailService } from "../src";

let server: Server | undefined;
afterEach(() => server?.close());

/** An SMTP server that takes a message and accepts it, or never answers its final dot. */
const smtpSink = async ({ stall }: { stall: boolean }) => {
	const messageReceived = Promise.withResolvers<void>();
	const messageConnectionClosed = Promise.withResolvers<void>();
	server = createServer((socket) => {
		let buffered = "";
		let inData = false;
		let sawMessage = false;
		socket.on("close", () => {
			if (sawMessage) messageConnectionClosed.resolve();
		});
		socket.on("data", (chunk) => {
			buffered += chunk.toString();
			for (
				let end = buffered.indexOf("\r\n");
				end >= 0;
				end = buffered.indexOf("\r\n")
			) {
				const line = buffered.slice(0, end);
				buffered = buffered.slice(end + 2);
				if (inData) {
					if (line === ".") {
						sawMessage = true;
						inData = false;
						messageReceived.resolve();
						if (!stall) socket.write("250 queued as sink-1\r\n");
					}
				} else if (/^DATA/i.test(line)) {
					inData = true;
					socket.write("354 go ahead\r\n");
				} else socket.write("250 ok\r\n");
			}
		});
		socket.write("220 sink ESMTP\r\n");
	});
	await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
	return {
		port: (server.address() as AddressInfo).port,
		messageReceived: messageReceived.promise,
		messageConnectionClosed: messageConnectionClosed.promise,
	};
};

const sendThrough = (port: number) =>
	Effect.gen(function* () {
		const email = yield* EmailService;
		return yield* email.send({
			to: "user@example.test",
			subject: "Subject",
			text: "Text",
			html: "<p>Text</p>",
		});
	}).pipe(
		Effect.provide(EmailLive),
		Effect.provideService(
			ConfigProvider.ConfigProvider,
			ConfigProvider.fromUnknown({
				SMTP_HOST: "127.0.0.1",
				SMTP_PORT: String(port),
				SMTP_SECURE: false,
				SMTP_FROM: "orcai@example.test",
			}),
		),
	);

test("a send delivers over SMTP", async () => {
	const sink = await smtpSink({
		stall: false,
	});
	expect(await Effect.runPromise(sendThrough(sink.port))).toMatchObject({
		channel: "smtp",
	});
});

test("an interrupted send closes its SMTP connection", async () => {
	const sink = await smtpSink({
		stall: true,
	});
	const sender = Effect.runFork(sendThrough(sink.port));
	await sink.messageReceived;
	await Effect.runPromise(Fiber.interrupt(sender));
	expect(
		await Promise.race([
			sink.messageConnectionClosed.then(() => "closed"),
			sleep(1000, "open"),
		]),
	).toBe("closed");
});
