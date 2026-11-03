import { getDownloadUrl } from "@orcai/s3/server";
import { dataExportIdSchema, userIdSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import { respondSignedIn } from "@/lib/auth/signed-in";
import { downloadableDataExport } from "@/lib/data-export/data-export";
import { runPromise } from "@/lib/effect/runtime";

const notFound = () =>
	new Response("Not Found", {
		status: 404,
	});

/** Sends the signed-in owner of a ready export to its archive. */
export const Route = createFileRoute("/api/data-exports/$dataExportId")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				runPromise(
					respondSignedIn(request, ({ user }) =>
						Effect.gen(function* () {
							const dataExportId = dataExportIdSchema.safeParse(
								params.dataExportId,
							);
							if (!dataExportId.success) {
								return notFound();
							}
							const archive = yield* downloadableDataExport(
								userIdSchema.parse(user.id),
								dataExportId.data,
							);
							if (!archive) {
								return notFound();
							}
							const day = (archive.completedAt ?? new Date())
								.toISOString()
								.slice(0, 10);
							const url = yield* getDownloadUrl({
								bucket: archive.bucket,
								key: archive.key,
								expiresIn: 300,
								filename: `orcai-data-export-${day}.zip`,
							});
							return Response.redirect(url, 302);
						}),
					),
				),
		},
	},
});
