import { afterAll, describe, expect, test } from "bun:test";
import { trace } from "@opentelemetry/api";
import { rejection } from "@orcai/testing";
import { serve } from "bun";

type ExportedSpan = {
	name: string;
	spanId: string;
	parentSpanId?: string;
	attributes: {
		key: string;
		value: {
			stringValue?: string;
		};
	}[];
};

/** Spans the app's OTLP exporter sends, as the collector receives them. */
const received: ExportedSpan[] = [];
const collector = serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch: async (request) => {
		if (new URL(request.url).pathname !== "/v1/traces")
			return new Response("{}");
		const body = (await request.json()) as {
			resourceSpans: {
				scopeSpans: {
					spans: ExportedSpan[];
				}[];
			}[];
		};
		for (const { scopeSpans } of body.resourceSpans)
			for (const { spans } of scopeSpans) received.push(...spans);
		return new Response("{}");
	},
});
afterAll(() => collector.stop(true));

// The app's observability layer reads the endpoint when its module loads.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = collector.url.origin;
const { BetterAuth } = await import("@/lib/auth/better-auth");
const { appIntegration, TIMEOUT } = await import(
	"@/lib/testing/app-integration"
);
if (endpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint;

const { run } = appIntegration();

const statementOf = (span: ExportedSpan) =>
	span.attributes.find(({ key }) => key === "db.query.text")?.value
		.stringValue ?? "";

describe("Better Auth callbacks", () => {
	test(
		"a callback's query is exported under Better Auth's hook span",
		async () => {
			const auth = await run(BetterAuth);

			const refused = await rejection(
				auth.api.signUpEmail({
					body: {
						email: `uninvited-${crypto.randomUUID()}@example.test`,
						password: "a-password-long-enough",
						name: "Uninvited",
					},
				}),
			);
			await (
				trace.getTracerProvider() as unknown as {
					getDelegate: () => {
						forceFlush: () => Promise<void>;
					};
				}
			)
				.getDelegate()
				.forceFlush();

			expect(refused).toMatchObject({
				body: {
					code: "INVITATION_REQUIRED",
				},
			});
			const query = received.find((span) =>
				statementOf(span).includes('"invitation"'),
			);
			const hook = received.find((span) => span.spanId === query?.parentSpanId);

			expect(hook?.name).toBe("db create.before user");
		},
		TIMEOUT,
	);
});
