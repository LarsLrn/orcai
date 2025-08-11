import { trace } from "@opentelemetry/api";
import { ORPCError, onError, ValidationError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
	BatchHandlerPlugin,
	StrictGetMethodPlugin,
} from "@orpc/server/plugins";
import { createServerFileRoute } from "@tanstack/react-start/server";
import { z } from "zod/v4";
import { router } from "@/lib/orpc/router";

const handler = new RPCHandler(router, {
	clientInterceptors: [
		onError((error) => {
			if (
				error instanceof ORPCError &&
				error.code === "BAD_REQUEST" &&
				error.cause instanceof ValidationError
			) {
				const zodError = new z.ZodError(
					error.cause.issues as z.core.$ZodIssue[],
				);

				throw new ORPCError("INPUT_VALIDATION_FAILED", {
					status: 422,
					message: z.prettifyError(zodError),
					data: z.flattenError(zodError),
					cause: error.cause,
				});
			}

			if (
				error instanceof ORPCError &&
				error.code === "INTERNAL_SERVER_ERROR" &&
				error.cause instanceof ValidationError
			) {
				const zodError = new z.ZodError(
					error.cause.issues as z.core.$ZodIssue[],
				);

				throw new ORPCError("OUTPUT_VALIDATION_FAILED", {
					status: 422,
					message: z.prettifyError(zodError),
					data: z.flattenError(zodError),
					cause: error.cause,
				});
			}
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
		({ request, next }) => {
			const span = trace.getActiveSpan();

			request.signal?.addEventListener("abort", () => {
				span?.addEvent("aborted", { reason: String(request.signal?.reason) });
			});

			return next();
		},
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
