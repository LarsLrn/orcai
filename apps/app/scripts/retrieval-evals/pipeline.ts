import {
	type AgentModel,
	callRequest,
	countTokens,
	type EmbeddingConnection,
	embedValues,
	figureCall,
} from "@orcai/ai";
import type { AssetId, BlockId } from "@orcai/core";
import {
	createExtractionArtifact,
	extract,
	getExtractionProfileConfig,
} from "@orcai/process";
import { EmbeddingGeneration } from "@orcai/qdrant";
import { generateText } from "ai";
import * as Effect from "effect/Effect";
import { answerStore, sha256 } from "./cache";
import type { EvalDocument } from "./corpus";

type ExtractedImage = NonNullable<
	Parameters<typeof createExtractionArtifact>[0]["result"]["images"]
>[number];

/*
 * Passages as the workers build them in processing (process-asset-job.ts) and
 * indexing (vectorize-asset-job.ts), without storage. Keep them in step.
 */

/** What the embedded text of a passage starts with: nothing, its heading path as indexing adds it, or the document title before that. */
export type Header = "none" | "heading" | "title";

/** A fixed UUID of version 4's shape, as point payloads require, for `name`. */
const stableUuid = (name: string) => {
	const hex = sha256(`retrieval-evals/${name}`);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Number.parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const EVAL_BLOCK = stableUuid("repository") as BlockId;
export const assetIdOf = (document: string) =>
	stableUuid(`asset/${document}`) as AssetId;

/** A passage of a document as indexing builds it, before it is embedded. */
export interface Passage {
	document: string;
	source: "text" | "image";
	text: string;
	heading?: string;
	pageStart?: number;
	pageEnd?: number;
	depth: number;
	tokens: number;
	/** Set for figures, with the format of the stored image. */
	format?: string;
}

/** A document extracted at one chunk size, with its figures described. */
export interface Extracted {
	document: EvalDocument;
	passages: Passage[];
	milliseconds: number;
	imageCount: number;
	describedCount: number;
}

const validPage = (value: number | null | undefined) =>
	typeof value === "number" && Number.isInteger(value) && value >= 1
		? value
		: undefined;

/** The figures processing keeps: none 200 px or smaller on a side, and each distinct image once. */
const keptFigures = (images: readonly ExtractedImage[]) => {
	const seen = new Set<string>();
	return images.filter((image) => {
		if (
			typeof image.width === "number" &&
			typeof image.height === "number" &&
			(image.width <= 200 || image.height <= 200)
		) {
			return false;
		}
		const digest = sha256(image.data);
		if (seen.has(digest)) return false;
		seen.add(digest);
		return true;
	});
};

const mediaType = (format: string) => {
	const normalized = format.toLowerCase();
	return normalized === "jpg" ? "image/jpeg" : `image/${normalized}`;
};

const descriptions = answerStore<string | null>("descriptions");

/** The figure description processing stores, from the same call; one call per distinct image, prompt and model. */
const describe = (
	vision: {
		id: string;
		model: AgentModel;
	},
	image: ExtractedImage,
	locale: string,
) =>
	Effect.gen(function* () {
		const call = figureCall(vision.model.kind, {
			data: image.data,
			mediaType: mediaType(image.format),
			hint: image.description ?? undefined,
			locale,
		});
		const key = sha256(
			JSON.stringify([
				vision.id,
				call.instructions,
				sha256(image.data),
			]),
		);
		const known = descriptions.get(key);
		if (known !== undefined) return known;
		const answer = yield* Effect.tryPromise(() =>
			generateText(callRequest(vision.model.language, call)),
		).pipe(Effect.option);
		// Processing skips a figure whose description failed; the next run tries it again.
		if (answer._tag === "None") return null;
		const described = answer.value.text.trim() || null;
		descriptions.set(key, described);
		return described;
	});

export const extractDocument = (params: {
	document: EvalDocument;
	chunkSize: number;
	vision: {
		id: string;
		model: AgentModel;
	};
}) =>
	Effect.gen(function* () {
		const { document, chunkSize } = params;
		const profile = getExtractionProfileConfig("asset-heavy");
		const started = performance.now();
		const result = yield* extract(
			{
				kind: "bytes",
				data: document.data,
				mimeType: document.mimeType,
			},
			{
				config: {
					useCache: false,
					chunking: {
						...profile.chunking,
						maxChars: chunkSize,
						maxOverlap: chunkSize / 5,
					},
				},
			},
		);
		const milliseconds = performance.now() - started;
		const artifact = createExtractionArtifact({
			result,
		});
		const figures = keptFigures(result.images ?? []);
		const described = yield* Effect.forEach(
			figures,
			(image) =>
				describe(params.vision, image, document.language).pipe(
					Effect.map((text) => ({
						image,
						text,
					})),
				),
			{
				concurrency: 2,
			},
		);

		const chunks = [
			...artifact.chunks,
		].sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
		const content = artifact.content.trim();
		const textPassages: Passage[] =
			chunks.length > 0
				? chunks.map((chunk) => {
						const headings = chunk.metadata.headingContext?.headings ?? [];
						const pageStart = validPage(chunk.metadata.firstPage);
						return {
							document: document.id,
							source: "text",
							text: chunk.content,
							heading:
								headings.length > 0
									? headings.map((heading) => heading.text.trim()).join(" > ")
									: undefined,
							pageStart,
							pageEnd: validPage(chunk.metadata.lastPage) ?? pageStart,
							depth: headings.at(-1)?.level ?? 0,
							tokens: chunk.metadata.tokenCount ?? countTokens(chunk.content),
						};
					})
				: content
					? [
							{
								document: document.id,
								source: "text",
								text: content,
								depth: 0,
								tokens: countTokens(content),
							},
						]
					: [];
		const figurePassages = described.flatMap(({ image, text }) =>
			text
				? [
						{
							document: document.id,
							source: "image" as const,
							text,
							pageStart: validPage(image.pageNumber),
							pageEnd: validPage(image.pageNumber),
							depth: 0,
							tokens: countTokens(text),
							format: image.format.toLowerCase(),
						},
					]
				: [],
		);

		return {
			document,
			passages: [
				...textPassages,
				...figurePassages,
			],
			milliseconds,
			imageCount: result.images?.length ?? 0,
			describedCount: figurePassages.length,
		} satisfies Extracted;
	});

/** The text a passage is embedded as, and the text BM25 indexes. */
const indexedTexts = (passage: Passage, title: string, header: Header) => {
	const withHeading = passage.heading
		? `${passage.heading}\n\n${passage.text}`
		: passage.text;
	const lexical = header === "none" ? passage.text : withHeading;
	if (header !== "title") {
		return {
			embedded: lexical,
			lexical,
		};
	}
	return {
		embedded: `${[
			title,
			passage.heading,
		]
			.filter(Boolean)
			.join("\n")}\n\n${passage.text}`,
		lexical,
	};
};

/** The points of one document as indexing writes them, already served. */
export const pointsOf = (
	extracted: Extracted,
	header: Header,
	vectors: readonly number[][],
) =>
	extracted.passages.map((passage, index) => {
		const { embedded, lexical } = indexedTexts(
			passage,
			extracted.document.title,
			header,
		);
		const assetId = assetIdOf(passage.document);
		return {
			id: stableUuid(`point/${assetId}/${index}`),
			vector: vectors[index],
			payload: {
				asset_id: assetId,
				block_id: EVAL_BLOCK,
				text: passage.text,
				lexical_text: lexical !== passage.text ? lexical : undefined,
				chunkPageStart: passage.pageStart,
				chunkPageEnd: passage.pageEnd,
				depth: passage.depth,
				tokens: passage.tokens,
				chunk_index: index,
				chunkCount: extracted.passages.length,
				createdAt: new Date(0).toISOString(),
				index_attempt: 1,
				published: true,
				...(passage.source === "image"
					? {
							source: "image" as const,
							file_reference: `${passage.document}/image-${index}.${passage.format}`,
						}
					: {
							source: "text" as const,
						}),
			},
			embedded,
		};
	});

const vectors = answerStore<string>("embeddings");

const pack = (vector: number[]) =>
	Buffer.from(new Float32Array(vector).buffer).toString("base64");
const unpack = (packed: string) => {
	const bytes = Buffer.from(packed, "base64");
	return Array.from(
		new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4),
	);
};

/** Vectors for `values` after `prefix`, each embedded once per model and prefix. */
export const embedCached = (
	connection: EmbeddingConnection,
	values: readonly string[],
	prefix: string,
) =>
	Effect.gen(function* () {
		const keyOf = (value: string) =>
			sha256(
				JSON.stringify([
					connection.model,
					prefix,
					value,
				]),
			);
		const missing = [
			...new Set(values.filter((value) => !vectors.get(keyOf(value)))),
		];
		if (missing.length > 0) {
			const embedded = yield* embedValues(connection, missing, prefix);
			missing.forEach((value, index) => {
				vectors.set(keyOf(value), pack(embedded[index]));
			});
		}
		return values.map((value) => unpack(vectors.get(keyOf(value)) ?? ""));
	});

/** The generation searches run on: a collection of the eval's own, embedding with the cache. */
export const evalGeneration = (params: {
	connection: EmbeddingConnection;
	queryPrefix: string;
	passagePrefix: string;
	dimensions: number;
	collection: string;
}) =>
	EmbeddingGeneration.of({
		generation: 0,
		model: params.connection.model,
		dimensions: params.dimensions,
		collection: params.collection,
		embedQueries: (queries) =>
			embedCached(params.connection, queries, params.queryPrefix),
		embedPassages: (passages) =>
			embedCached(params.connection, passages, params.passagePrefix),
	});
