import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { plugin } from "bun";

// Route modules pull in the whole app; the generated tree only needs their ids and paths.
plugin({
	name: "bare-route-modules",
	setup(build) {
		build.onLoad(
			{
				filter: /\/src\/routes\/.+\.tsx?$/,
			},
			({ path }) => ({
				loader: "ts",
				contents: path.endsWith("/__root.tsx")
					? `import { createRootRoute } from "@tanstack/react-router"; export const Route = createRootRoute();`
					: `import { createFileRoute } from "@tanstack/react-router"; export const Route = createFileRoute()({});`,
			}),
		);
	},
});

const { routeTree } = await import("@/routeTree.gen");
const { loggablePath, requestSpanName, resolveRequestRoute } = await import(
	"./request-route"
);

const router = createRouter({
	routeTree,
	context: {
		queryClient: new QueryClient(),
	},
});

const spanNameFor = (method: string, pathname: string) =>
	requestSpanName(method, resolveRequestRoute(router, pathname));

describe("request span names", () => {
	test("page routes use their template", () => {
		expect(spanNameFor("GET", "/")).toBe("GET /");
		expect(spanNameFor("GET", "/login")).toBe("GET /login");
		expect(spanNameFor("GET", "/app/chat/0b7c")).toBe("GET /app/chat/$chatId/");
		expect(spanNameFor("GET", "/app/hub/bots/42")).toBe(
			"GET /app/hub/bots/$botId/",
		);
		expect(spanNameFor("GET", "/app/models/7/edit")).toBe(
			"GET /app/models/$modelId/edit",
		);
	});

	test("rpc calls carry the procedure path", () => {
		expect(spanNameFor("POST", "/api/rpc/chat/list")).toBe(
			"POST /api/rpc/chat/list",
		);
		expect(spanNameFor("POST", "/api/rpc/ai/chat")).toBe(
			"POST /api/rpc/ai/chat",
		);
	});

	test("rpc calls to unknown procedures keep the template", () => {
		expect(spanNameFor("POST", "/api/rpc/chat")).toBe("POST /api/rpc/$");
		expect(spanNameFor("GET", "/api/rpc/wp-admin/setup.php")).toBe(
			"GET /api/rpc/$",
		);
	});

	test("auth requests keep the template", () => {
		expect(spanNameFor("GET", "/api/auth/get-session")).toBe("GET /api/auth/$");
		expect(spanNameFor("GET", "/api/auth/reset-password/s3cr3t-token")).toBe(
			"GET /api/auth/$",
		);
	});

	test("auth paths stay out of the span attributes", () => {
		const authPath = "/api/auth/reset-password/s3cr3t-token";
		expect(
			loggablePath(resolveRequestRoute(router, authPath), authPath),
		).toBeUndefined();
		expect(loggablePath(resolveRequestRoute(router, "/login"), "/login")).toBe(
			"/login",
		);
	});

	test("unmatched paths never expose the raw path", () => {
		expect(spanNameFor("GET", "/wp-login.php")).toBe("GET (unmatched)");
		expect(spanNameFor("QUERY", "/nope/1234")).toBe("QUERY (unmatched)");
		expect(spanNameFor("BREW", "/nope/1234")).toBe("_OTHER (unmatched)");
	});
});
