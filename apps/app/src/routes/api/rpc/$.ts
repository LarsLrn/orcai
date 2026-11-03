import { RPCHandler } from "@orpc/server/fetch";
import {
	GetMethodCsrfProtectionHandlerPlugin,
	ResponseCompressionHandlerPlugin,
} from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";
import {
	serveUnder,
	sharedHandlerOptions,
} from "@/lib/orpc/implementation/handler";
import { router } from "@/lib/orpc/router";

const shared = sharedHandlerOptions();

const handler = new RPCHandler(router, {
	...shared,
	plugins: [
		...shared.plugins,
		new ResponseCompressionHandlerPlugin(),
		new GetMethodCsrfProtectionHandlerPlugin(),
	],
});

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: serveUnder(handler, "/api/rpc"),
		},
	},
});
