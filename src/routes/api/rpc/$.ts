import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
	BatchHandlerPlugin,
	StrictGetMethodPlugin,
} from "@orpc/server/plugins";
import { createServerFileRoute } from "@tanstack/react-start/server";
import { router } from "@/lib/orpc/router";

const handler = new RPCHandler(router, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
	plugins: [new BatchHandlerPlugin(), new StrictGetMethodPlugin()],
});

async function handle({ request }: { request: Request }) {
	const { response } = await handler.handle(request, {
		prefix: "/api/rpc",
		context: {}, // Provide initial context if needed
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const ServerRoute = createServerFileRoute("/api/rpc/$").methods({
	HEAD: handle,
	GET: handle,
	POST: handle,
	PUT: handle,
	PATCH: handle,
	DELETE: handle,
});
