import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/auth";
import { runPromise } from "@/lib/effect/runtime";
import { imageResponse } from "@/lib/images/images";
import { recordRequestUser } from "@/lib/observability/request-span";

/** Streams a profile picture or organisation logo to any signed-in user. */
export const Route = createFileRoute("/api/images/$")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session) {
					return new Response("Unauthorized", {
						status: 401,
					});
				}
				recordRequestUser(session.user.id);

				return runPromise(
					imageResponse(
						`/api/images/${params._splat ?? ""}`,
						request.headers.get("If-None-Match"),
					),
				);
			},
		},
	},
});
