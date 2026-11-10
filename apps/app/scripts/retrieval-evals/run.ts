import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { agentModel, type EmbeddingConnection } from "@orcai/ai";
import {
	defaultBm25Config,
	EmbeddingGeneration,
	ensureCollection,
	GenerationWrite,
	prepareQueries,
	QdrantLive,
	QdrantService,
	retrievePassages,
	upsertPointsToQdrant,
} from "@orcai/qdrant";
import { S3Live } from "@orcai/s3/server";
import type { RetrievalMode } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { repositorySearchPolicy } from "@/lib/ai/tools/retrieval/search-repositories";
import { limitedFetch } from "../limited-fetch";
import { sha256 } from "./cache";
import {
	corpusFingerprint,
	type EvalDocument,
	loadCorpus,
	tessdata,
} from "./corpus";
import {
	answerable,
	type Found,
	type Outcome,
	outcomeOf,
	type Summary,
	summarize,
} from "./metrics";
import {
	assetIdOf,
	EVAL_BLOCK,
	type Extracted,
	embedCached,
	evalGeneration,
	extractDocument,
	type Header,
	pointsOf,
} from "./pipeline";
import { QUESTIONS } from "./questions";

/** The models beta indexes with, on Academic Cloud. */
const DEFAULT_EMBEDDING_MODEL = "e5-mistral-7b-instruct";
const DEFAULT_QUERY_PREFIX =
	"Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ";
const DEFAULT_VISION_MODEL = "gemma-4-31b-it";

const RESULTS = join(import.meta.dir, "results");

const { values: args } = parseArgs({
	options: {
		"chunk-sizes": {
			type: "string",
			default: "1000,2000",
		},
		limits: {
			type: "string",
			default: "6,12",
		},
		modes: {
			type: "string",
			default: "hybrid,dense,sparse",
		},
		headers: {
			type: "string",
			default: "heading",
		},
		stopwords: {
			type: "string",
		},
		questions: {
			type: "string",
		},
		"embedding-model": {
			type: "string",
			default: DEFAULT_EMBEDDING_MODEL,
		},
		"query-prefix": {
			type: "string",
			default: DEFAULT_QUERY_PREFIX,
		},
		"passage-prefix": {
			type: "string",
			default: "",
		},
		"vision-model": {
			type: "string",
			default: DEFAULT_VISION_MODEL,
		},
		/** As the workers image sets it. */
		"ocr-language": {
			type: "string",
			default: "eng+deu",
		},
		out: {
			type: "string",
		},
		compare: {
			type: "string",
		},
	},
});

const fail = (message: string): never => {
	console.error(message);
	process.exit(1);
};

// Kreuzberg's OCR reads the models' directory from the environment it started with.
const models = await tessdata();
if (process.env.TESSDATA_PREFIX !== models) {
	const { status } = spawnSync(process.execPath, process.argv.slice(1), {
		env: {
			...process.env,
			TESSDATA_PREFIX: models,
		},
		stdio: "inherit",
	});
	process.exit(status ?? 1);
}
// Read when extraction runs; the stack's own environment sets English only.
process.env.KREUZBERG_OCR_LANGUAGE = args["ocr-language"];

const list = (value: string) =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item !== "");

const chunkSizes = list(args["chunk-sizes"]).map(Number);
const limits = list(args.limits).map(Number);
const modes = list(args.modes) as RetrievalMode[];
const headers = list(args.headers) as Header[];
if (
	![
		...chunkSizes,
		...limits,
	].every((value) => Number.isInteger(value) && value > 0)
) {
	fail("--chunk-sizes and --limits take positive integers.");
}
if (
	!modes.every((mode) =>
		[
			"dense",
			"sparse",
			"hybrid",
		].includes(mode),
	)
) {
	fail("--modes takes dense, sparse and hybrid.");
}
if (
	!headers.every((header) =>
		[
			"none",
			"heading",
			"title",
		].includes(header),
	)
) {
	fail("--headers takes none, heading and title.");
}

/** BM25 stopwords as `none`, languages joined by `+`, or `indexing` for what indexing uses. */
const stopwordSets = list(args.stopwords ?? "indexing");
type Bm25Config = QdrantService["Service"]["bm25Config"];
const bm25For = (label: string): Bm25Config =>
	label === "indexing"
		? defaultBm25Config
		: {
				...defaultBm25Config,
				// Qdrant's own lists only, without the words indexing adds to them.
				stopwords: {
					languages: label === "none" ? [] : label.split("+"),
				} as Bm25Config["stopwords"],
			};

const endpoint = process.env.RETRIEVAL_EVALS_ENDPOINT;
const apiKey = process.env.RETRIEVAL_EVALS_API_KEY;
if (!endpoint || !apiKey) {
	fail("Set RETRIEVAL_EVALS_ENDPOINT and RETRIEVAL_EVALS_API_KEY.");
}
// Spaced evenly, 60 a minute also keeps under a limit of 10 in any 10 seconds.
const perMinute = Number(process.env.RETRIEVAL_EVALS_RPM ?? 60);
if (!(Number.isInteger(perMinute) && perMinute > 0)) {
	fail("RETRIEVAL_EVALS_RPM must be a positive integer.");
}
if (!process.env.QDRANT_URL) {
	fail(
		"Run it through `bun run stack exec --` so it reaches the stack's Qdrant.",
	);
}

const fetchLimited = limitedFetch(perMinute);
const connection: EmbeddingConnection = {
	baseUrl: endpoint as string,
	apiKey: apiKey as string,
	model: args["embedding-model"],
	fetch: fetchLimited,
};
const vision = {
	id: args["vision-model"],
	model: agentModel({
		kind: "openai-compatible",
		connection: {
			apiKey: apiKey as string,
			endpoint: endpoint as string,
			fetch: fetchLimited,
		},
		providerModelId: args["vision-model"],
	}),
};
const prefixes = args.questions ? list(args.questions) : undefined;
const questions = QUESTIONS.filter(
	({ id }) => !prefixes || prefixes.some((prefix) => id.startsWith(prefix)),
);

interface Config {
	chunkSize: number;
	header: Header;
	stopwords: string;
	mode: RetrievalMode;
	limit: number;
}

const configKey = (config: Config) =>
	`${config.chunkSize}/${config.header}/${config.stopwords}/${config.mode}/${config.limit}`;

interface Run {
	config: Config;
	summary: {
		all: Summary;
		de: Summary;
		en: Summary;
	};
	questions: (Outcome & {
		id: string;
		top: (Omit<Found, "text"> & {
			snippet: string;
		})[];
	})[];
}

interface Results {
	commit: string;
	/** Runs compare only with the same corpus, questions and metrics. */
	fingerprint: string;
	settings: {
		embeddingModel: string;
		queryPrefix: string;
		passagePrefix: string;
		visionModel: string;
		ocrLanguage: string;
	};
	corpus: {
		id: string;
		title: string;
		sha256: string;
		extractions: {
			chunkSize: number;
			milliseconds: number;
			passages: number;
			images: number;
			described: number;
		}[];
	}[];
	unanswerable: Record<number, string[]>;
	runs: Run[];
}

const qdrant = ManagedRuntime.make(QdrantLive);

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		QdrantService | EmbeddingGeneration | GenerationWrite
	>,
	collection: string,
	stopwords: string,
	dimensions: number,
) =>
	qdrant.runPromise(
		effect.pipe(
			Effect.updateService(QdrantService, (service) => ({
				...service,
				bm25Config: bm25For(stopwords),
			})),
			Effect.provideService(
				EmbeddingGeneration,
				evalGeneration({
					connection,
					queryPrefix: args["query-prefix"],
					passagePrefix: args["passage-prefix"],
					dimensions,
					collection,
				}),
			),
			Effect.provideService(GenerationWrite, {
				collection,
			}),
		),
	);

const commit = execFileSync("git", [
	"rev-parse",
	"--short",
	"HEAD",
])
	.toString()
	.trim();

const before = args.compare
	? (JSON.parse(readFileSync(args.compare, "utf8")) as Results)
	: undefined;
const fingerprint = sha256(
	JSON.stringify([
		corpusFingerprint(),
		questions,
		sha256(readFileSync(join(import.meta.dir, "metrics.ts"))),
	]),
);
if (before && before.fingerprint !== fingerprint) {
	fail(
		`${args.compare} ran on another corpus, question set or metrics, so its numbers do not compare with this run.`,
	);
}

const corpus = await loadCorpus();
const titleOf = new Map(
	corpus.map(({ id, title }) => [
		id,
		title,
	]),
);
const documentOf = new Map(
	corpus.map(({ id }) => [
		assetIdOf(id),
		id,
	]),
);
for (const question of questions) {
	if (!question.sources.every(({ document }) => titleOf.has(document))) {
		fail(`${question.id} names a document the corpus lacks.`);
	}
}

const extractions = new Map<number, Extracted[]>();
for (const chunkSize of chunkSizes) {
	extractions.set(
		chunkSize,
		await Effect.runPromise(
			Effect.forEach(
				corpus,
				(document: EvalDocument) =>
					extractDocument({
						document,
						chunkSize,
						vision,
					}),
				{
					concurrency: 2,
				},
			).pipe(Effect.provide(S3Live)),
		),
	);
	console.error(`extracted the corpus at ${chunkSize} characters`);
}

/** Questions no passage answers at a chunk size: extraction lost the answer, so no ranking can find it. */
const unanswerable = Object.fromEntries(
	[
		...extractions,
	].map(([chunkSize, extracted]) => {
		const passages = extracted.flatMap(({ passages }) =>
			passages.map(
				(passage): Found => ({
					document: passage.document,
					source: passage.source,
					text: passage.text,
					pageStart: passage.pageStart,
					pageEnd: passage.pageEnd,
				}),
			),
		);
		return [
			chunkSize,
			questions
				.filter(({ sources }) => !answerable(passages, sources))
				.map(({ id }) => id),
		];
	}),
);

const runs: Run[] = [];
const queryVectors = await Effect.runPromise(
	embedCached(
		connection,
		questions.map(({ question }) => question),
		args["query-prefix"],
	),
);
const dimensions = queryVectors[0]?.length ?? 0;

for (const [chunkSize, extracted] of extractions) {
	for (const header of headers) {
		const passageVectors = await Effect.runPromise(
			Effect.forEach(extracted, (document) =>
				embedCached(
					connection,
					pointsOf(document, header, []).map(({ embedded }) => embedded),
					args["passage-prefix"],
				),
			),
		);
		const points = extracted.flatMap((document, index) =>
			pointsOf(document, header, passageVectors[index]).map(
				({ embedded: _, ...point }) => point,
			),
		);
		for (const stopwords of stopwordSets) {
			const collection = `retrieval-evals-${sha256(`${process.pid}/${chunkSize}/${header}/${stopwords}`).slice(0, 16)}`;
			const within = <A, E>(
				effect: Effect.Effect<
					A,
					E,
					QdrantService | EmbeddingGeneration | GenerationWrite
				>,
			) => run(effect, collection, stopwords, dimensions);
			try {
				await within(
					QdrantService.use(({ client }) =>
						ensureCollection(client, collection, dimensions),
					),
				);
				await within(
					upsertPointsToQdrant({
						points,
					}),
				);
				// Answers once every queued update is applied, so searches see every point.
				await within(
					QdrantService.use(({ client }) =>
						Effect.promise(() =>
							client.delete(collection, {
								wait: true,
								filter: {
									must: [
										{
											has_id: [],
										},
									],
								},
							}),
						),
					),
				);
				for (const mode of modes) {
					const prepared = await within(
						prepareQueries(
							questions.map(({ question }) => ({
								queries: [
									question,
								],
								retrievalMode: mode,
							})),
						),
					);
					for (const limit of limits) {
						const config = {
							chunkSize,
							header,
							stopwords,
							mode,
							limit,
						};
						const outcomes = await within(
							Effect.forEach(
								questions,
								(question, index) =>
									retrievePassages({
										queries: prepared[index],
										scope: {
											blockId: EVAL_BLOCK,
											assetIds: corpus.map(({ id }) => assetIdOf(id)),
										},
										policy: repositorySearchPolicy(
											{
												retrievalMode: mode,
											},
											limit,
										),
									}).pipe(
										Effect.map(({ data }) => {
											const found = data.map(
												(point): Found => ({
													document:
														documentOf.get(point.payload.asset_id) ?? "",
													source: point.payload.source,
													text: point.payload.text,
													pageStart: point.payload.chunkPageStart,
													pageEnd: point.payload.chunkPageEnd,
												}),
											);
											return {
												id: question.id,
												language: question.language,
												...outcomeOf(found, question.sources),
												top: found.slice(0, 3).map(({ text, ...rest }) => ({
													...rest,
													snippet: text.slice(0, 160),
												})),
											};
										}),
									),
								{
									concurrency: 8,
								},
							),
						);
						runs.push({
							config,
							summary: {
								all: summarize(outcomes),
								de: summarize(
									outcomes.filter(({ language }) => language === "de"),
								),
								en: summarize(
									outcomes.filter(({ language }) => language === "en"),
								),
							},
							questions: outcomes.map(({ language: _, ...outcome }) => outcome),
						});
						console.error(`searched ${configKey(config)}`);
					}
				}
			} finally {
				await within(
					QdrantService.use(({ client }) =>
						Effect.promise(() => client.deleteCollection(collection)),
					),
				).catch(() => undefined);
			}
		}
	}
}

const results: Results = {
	commit,
	fingerprint,
	settings: {
		embeddingModel: connection.model,
		queryPrefix: args["query-prefix"],
		passagePrefix: args["passage-prefix"],
		visionModel: vision.id,
		ocrLanguage: args["ocr-language"],
	},
	corpus: corpus.map((document) => ({
		id: document.id,
		title: document.title,
		sha256: sha256(document.data),
		extractions: [
			...extractions,
		].map(([chunkSize, extracted]) => {
			const found = extracted.find(
				(entry) => entry.document.id === document.id,
			);
			return {
				chunkSize,
				milliseconds: Math.round(found?.milliseconds ?? 0),
				passages: found?.passages.length ?? 0,
				images: found?.imageCount ?? 0,
				described: found?.describedCount ?? 0,
			};
		}),
	})),
	unanswerable,
	runs,
};
const out =
	args.out ??
	join(RESULTS, `${new Date().toISOString().slice(0, 19)}-${commit}.json`);
mkdirSync(RESULTS, {
	recursive: true,
});
writeFileSync(out, JSON.stringify(results, null, "\t"));
await qdrant.dispose();

const percent = (value: number) => `${Math.round(value * 100)}%`;
const decimal = (value: number) => value.toFixed(2);
const beforeRuns = new Map(
	before?.runs.map((entry) => [
		configKey(entry.config),
		entry,
	]),
);
const cell = (
	entry: Run,
	read: (run: Run) => number,
	format: (value: number) => string,
) => {
	const earlier = beforeRuns.get(configKey(entry.config));
	return earlier
		? `${format(read(earlier))} → ${format(read(entry))}`
		: format(read(entry));
};

console.log(
	[
		`Retrieval evals at ${commit}${before ? `, compared with ${before.commit}` : ""}: ${questions.length} questions over ${corpus.length} documents.`,
		"",
		"| Chunk | Header | Stopwords | Mode | Results | Hit@1 | Hit@3 | Hit@results | MRR | Page@1 | Exact page@1 | MRR de | MRR en |",
		"| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
		...runs.map(
			(entry) =>
				`| ${entry.config.chunkSize} | ${entry.config.header} | ${entry.config.stopwords} | ${entry.config.mode} | ${entry.config.limit} | ${cell(entry, (r) => r.summary.all.hitAt1, percent)} | ${cell(entry, (r) => r.summary.all.hitAt3, percent)} | ${cell(entry, (r) => r.summary.all.hitAtLimit, percent)} | ${cell(entry, (r) => r.summary.all.mrr, decimal)} | ${cell(entry, (r) => r.summary.all.pageAt1, percent)} | ${cell(entry, (r) => r.summary.all.pageExactAt1, percent)} | ${cell(entry, (r) => r.summary.de.mrr, decimal)} | ${cell(entry, (r) => r.summary.en.mrr, decimal)} |`,
		),
		"",
		...Object.entries(unanswerable)
			.filter(([, ids]) => ids.length > 0)
			.map(
				([chunkSize, ids]) =>
					`No passage at ${chunkSize} characters holds the answer to ${ids.join(", ")}.`,
			),

		`Results: ${out}`,
	].join("\n"),
);
