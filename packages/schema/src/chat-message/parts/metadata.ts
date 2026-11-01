import { docsMarkdownPath, safeExternalUrl } from "@orcai/core";
import { z } from "zod/v4";
import { assetIdSchema } from "../../asset/ref";
import { chatMessageAttachmentSchema } from "./attachment";

/** A cited asset: a passage of it, on `page` when the passage lies on one page. */
const assetCitationSchema = z.object({
	kind: z.literal("asset"),
	assetId: z.string(),
	title: z.string(),
	page: z.number().optional(),
});

/** A cited page of the OrcAI docs, by its path on the docs site. */
const docsCitationSchema = z.object({
	kind: z.literal("docs"),
	path: z.string().refine((path) => docsMarkdownPath(path)?.path === path),
	title: z.string(),
});

/** A cited web search result. */
const webCitationSchema = z.object({
	kind: z.literal("web"),
	url: z.string().refine((url) => safeExternalUrl(url) !== undefined),
	title: z.string(),
});

/** The source a `<cite ref>` of the reply names. */
export const chatMessageCitationSchema = z.discriminatedUnion("kind", [
	assetCitationSchema,
	docsCitationSchema,
	webCitationSchema,
]);

export type ChatMessageCitation = z.infer<typeof chatMessageCitationSchema>;

/** A file a `requestUpload` call lists. */
export const uploadedAssetSchema = z.object({
	id: assetIdSchema,
	title: z.string().min(1),
});

export type UploadedAsset = z.infer<typeof uploadedAssetSchema>;

/** How many files one `requestUpload` call lists at most. */
export const MAX_KEPT_UPLOADS = 100;

/** The files a waiting `requestUpload` call lists so far, and the zedToken of their newest upload. */
export const keptUploadsSchema = z.object({
	assets: z.array(uploadedAssetSchema).max(MAX_KEPT_UPLOADS),
	zedToken: z.string().optional(),
});

export type KeptUploads = z.infer<typeof keptUploadsSchema>;

export const chatMessageMetadataSchema = z.object({
	model: z.string().optional(),
	totalUsage: z
		.object({
			inputTokens: z.number().optional(),
			inputTokenDetails: z
				.object({
					noCacheTokens: z.number().optional(),
					cacheReadTokens: z.number().optional(),
					cacheWriteTokens: z.number().optional(),
				})
				.optional(),
			outputTokens: z.number().optional(),
			outputTokenDetails: z
				.object({
					textTokens: z.number().optional(),
					reasoningTokens: z.number().optional(),
				})
				.optional(),
			totalTokens: z.number().optional(),
		})
		.optional(),
	/** What the reply's last step took and wrote, so what its context held. */
	contextTokens: z.number().optional(),
	/** The context window of the reply's model, when known. */
	contextWindow: z.number().optional(),
	/** The estimate of the reply's prompt, which its context tokens calibrate. */
	contextEstimate: z.number().optional(),
	/** Older turns were left out of the reply's prompt to fit the context window. */
	historyTrimmed: z.boolean().optional(),
	siblingCount: z.number().optional(),
	siblingIndex: z.number().optional(),
	siblingIds: z.array(z.string()).optional(),
	/** A message's attachments while it is sent; stored messages keep them in `attachments`. */
	attachments: z.array(chatMessageAttachmentSchema).optional(),
	/** The newest zedToken of the turn that wrote the reply, for its continuation. */
	zedToken: z.string().optional(),
	/** When a running continuation claimed the reply (ISO string). */
	continuedAt: z.string().optional(),
	/** The turn used up its steps on a step that still called tools. */
	stepLimitReached: z.boolean().optional(),
	/** The turn stopped because its next step would not fit the context window. */
	contextLimitReached: z.boolean().optional(),
	/** The turn stopped because it ran into the time limit of a metered call. */
	timeLimitReached: z.boolean().optional(),
	/** The sources of the refs the reply cites; an entry that fails its kind's schema is dropped. */
	citations: z
		.record(z.string(), z.unknown())
		.transform((entries) =>
			Object.fromEntries(
				Object.entries(entries).flatMap(([ref, entry]) => {
					const parsed = chatMessageCitationSchema.safeParse(entry);

					return parsed.success
						? [
								[
									ref,
									parsed.data,
								] as const,
							]
						: [];
				}),
			),
		)
		.optional(),
	/** What each waiting `requestUpload` call lists so far, by call id. */
	uploads: z.record(z.string(), keptUploadsSchema).optional(),
});

export type ChatMessageMetadata = z.infer<typeof chatMessageMetadataSchema>;
