import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { DoclingError } from "@/lib/effect/utils/errors";
import { DOCLING_DEFAULT_TIMEOUT } from "@/settings/constants";
import type { SaiaDoclingData } from "@/types/docling";
import { AppConfigService } from "./config";

export type DoclingConvertParams = {
	document: Uint8Array;
	filename: string;
	extractTablesAsImages?: boolean;
	timeout?: number;
};

export class DoclingService extends Context.Tag("DoclingService")<
	DoclingService,
	{
		readonly convertDocument: (
			params: DoclingConvertParams,
		) => Effect.Effect<SaiaDoclingData, DoclingError>;
	}
>() {}

const convertDocument = ({
	baseUrl,
	apiKey,
	params,
}: {
	baseUrl: string;
	apiKey: string;
	params: DoclingConvertParams;
}) =>
	Effect.gen(function* () {
		const timeout = params.timeout ?? DOCLING_DEFAULT_TIMEOUT;
		const doclingApi = `${baseUrl}/documents/convert`;

		return yield* Effect.tryPromise({
			try: (signal) => {
				const formData = new FormData();
				const fileBlob = new Blob([Buffer.from(params.document)]);
				formData.append("document", fileBlob, params.filename);

				const searchParams = new URLSearchParams({
					response_type: "json",
					extract_tables_as_images: String(
						params.extractTablesAsImages ?? false,
					),
				});

				return fetch(`${doclingApi}?${searchParams}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
					},
					body: formData,
					signal,
				});
			},
			catch: (cause) =>
				new DoclingError({
					operation: "docling.convertDocument.fetch",
					cause,
				}),
		}).pipe(
			Effect.timeoutFail({
				duration: timeout,
				onTimeout: () =>
					new DoclingError({
						operation: "docling.convertDocument.fetch",
						cause: new Error(`Docling request timed out after ${timeout}ms`),
					}),
			}),
			Effect.flatMap((response) => {
				if (!response.ok) {
					return Effect.fail(
						new DoclingError({
							operation: "docling.convertDocument.response",
							cause: new Error(
								`Docling request failed: ${response.status} ${response.statusText}`,
							),
						}),
					);
				}

				return Effect.tryPromise({
					try: async () => (await response.json()) as SaiaDoclingData,
					catch: (cause) =>
						new DoclingError({
							operation: "docling.convertDocument.parse",
							cause,
						}),
				});
			}),
		);
	});

export const DoclingLive = Layer.effect(
	DoclingService,
	Effect.gen(function* () {
		const { config } = yield* AppConfigService;

		return {
			convertDocument: (params: DoclingConvertParams) =>
				convertDocument({
					baseUrl: config.ai.baseUrl,
					apiKey: config.ai.apiKey,
					params,
				}),
		};
	}),
);
