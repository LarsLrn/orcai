import { createFileRoute } from "@tanstack/react-router";
import * as Context from "effect/Context";
import { BetterAuth } from "@/lib/auth/better-auth";
import { runtime } from "@/lib/effect/runtime";

const handle = async (request: Request) =>
	Context.get(await runtime.context(), BetterAuth).handler(request);

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handle(request),
			POST: ({ request }) => handle(request),
		},
	},
});
