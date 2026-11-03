import { createFileRoute } from "@tanstack/react-router";
import { respondSignedIn } from "@/lib/auth/signed-in";
import { runPromise } from "@/lib/effect/runtime";
import { imageResponse } from "@/lib/images/images";

/** Streams a profile picture or organisation logo to any signed-in user. */
export const Route = createFileRoute("/api/images/$")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				runPromise(
					respondSignedIn(request, () =>
						imageResponse(
							`/api/images/${params._splat ?? ""}`,
							request.headers.get("If-None-Match"),
						),
					),
				),
		},
	},
});
