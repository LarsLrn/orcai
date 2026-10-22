import { getDownloadUrl } from "@orcai/s3/server";
import { dataExportIdSchema, userIdSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import { auth } from "@/lib/auth/auth";
import { downloadableDataExport } from "@/lib/data-export/data-export";
import { runPromise } from "@/lib/effect/runtime";
import { recordRequestUser } from "@/lib/observability/request-span";

/** Sends the signed-in owner of a ready export to its archive. */
export const Route = createFileRoute("/api/data-exports/$dataExportId")({
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

				const dataExportId = dataExportIdSchema.safeParse(params.dataExportId);
				const url =
					dataExportId.success &&
					(await runPromise(
						Effect.gen(function* () {
							const archive = yield* downloadableDataExport(
								userIdSchema.parse(session.user.id),
								dataExportId.data,
							);
							if (!archive) {
								return undefined;
							}
							const day = (archive.completedAt ?? new Date())
								.toISOString()
								.slice(0, 10);
							return yield* getDownloadUrl({
								bucket: archive.bucket,
								key: archive.key,
								expiresIn: 300,
								filename: `orcai-data-export-${day}.zip`,
							});
						}),
					));

				return url
					? Response.redirect(url, 302)
					: new Response("Not Found", {
							status: 404,
						});
			},
		},
	},
});
