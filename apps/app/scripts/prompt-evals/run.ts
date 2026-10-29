import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { assistantCases } from "./cases/assistant";
import { backgroundCases } from "./cases/background";
import type { EvalCase } from "./cases/case";
import { chatCases } from "./cases/chat";
import type { CodeCheck, JudgedCheck } from "./checks";
import { judge, openRouterModel, type Transcript } from "./harness";

const CASES: EvalCase[] = [
	...assistantCases,
	...chatCases,
	...backgroundCases,
];

/** A Claude, a GPT and a small open-weight model, the kind a self-hosted instance runs. */
const DEFAULT_MODELS = [
	"anthropic/claude-haiku-5.5",
	"openai/gpt-6-luna",
	"google/gemma-4-26b-a4b-it",
];

/** Grades what code cannot; it must differ from every model under test. */
const DEFAULT_JUDGE = "google/gemini-3.6-flash";

const KEY_FILE = join(homedir(), ".config/orcai/openrouter.env");

const RESULTS = join(import.meta.dir, "results");

interface Sample {
	case: string;
	model: string;
	sample: number;
	pass: boolean;
	failed: string[];
	error?: string;
	/** The judge's verdicts, with its reasons. */
	judged: {
		check: string;
		verdict: string;
	}[];
	text: string;
	calls: Transcript["calls"];
	stop: string;
}

interface Run {
	commit: string;
	models: string[];
	samples: Sample[];
	cost: Record<string, number>;
}

const { values: args } = parseArgs({
	options: {
		models: {
			type: "string",
		},
		samples: {
			type: "string",
			default: "3",
		},
		cases: {
			type: "string",
		},
		concurrency: {
			type: "string",
			default: "6",
		},
		out: {
			type: "string",
		},
		compare: {
			type: "string",
		},
		judge: {
			type: "string",
			default: DEFAULT_JUDGE,
		},
	},
});

const apiKey = (() => {
	if (process.env.OPENROUTER_API_KEY) {
		return process.env.OPENROUTER_API_KEY;
	}
	try {
		return /^OPENROUTER_API_KEY=["']?([^"'\s]+)/m.exec(
			readFileSync(KEY_FILE, "utf8"),
		)?.[1];
	} catch {
		return undefined;
	}
})();

if (!apiKey) {
	console.error(`Set OPENROUTER_API_KEY or put it in ${KEY_FILE}.`);
	process.exit(1);
}

const before = args.compare
	? (JSON.parse(readFileSync(args.compare, "utf8")) as Run)
	: undefined;

const commit = execFileSync("git", [
	"rev-parse",
	"--short",
	"HEAD",
])
	.toString()
	.trim();
const modelIds = args.models?.split(",") ?? DEFAULT_MODELS;
const sampleCount = Number(args.samples);
const cases = CASES.filter(({ id }) => !args.cases || id.includes(args.cases));
const cost: Record<string, number> = Object.fromEntries(
	modelIds.map((id) => [
		id,
		0,
	]),
);
if (modelIds.includes(args.judge)) {
	console.error(`The judge ${args.judge} must not be a model under test.`);
	process.exit(1);
}
const judgeModel = openRouterModel(args.judge, apiKey, (spent) => {
	cost[`${args.judge} (judge)`] = (cost[`${args.judge} (judge)`] ?? 0) + spent;
});
const models = modelIds.map((id) =>
	openRouterModel(id, apiKey, (spent) => {
		cost[id] = (cost[id] ?? 0) + spent;
	}),
);

const jobs = cases.flatMap((evalCase) =>
	models.flatMap((model) =>
		Array.from(
			{
				length: sampleCount,
			},
			(_, sample) => async (): Promise<Sample> => {
				const base = {
					case: evalCase.id,
					model: model.id,
					sample,
				};
				try {
					const transcript = await evalCase.run(model);
					const failed = evalCase.checks
						.filter((check): check is CodeCheck => "pass" in check)
						.filter((check) => !check.pass(transcript))
						.map(({ name }) => name);
					// The judge only grades runs the code checks pass.
					const verdicts =
						failed.length === 0
							? await Promise.all(
									evalCase.checks
										.filter((check): check is JudgedCheck => "rubric" in check)
										.map(async ({ name, rubric }) => ({
											name,
											...(await judge(judgeModel, rubric, transcript.text)),
										})),
								)
							: [];
					failed.push(
						...verdicts.filter(({ pass }) => !pass).map(({ name }) => name),
					);
					return {
						...base,
						pass: failed.length === 0,
						failed,
						judged: verdicts.map(({ name, reason }) => ({
							check: name,
							verdict: reason,
						})),
						text: transcript.text,
						calls: transcript.calls,
						stop: transcript.stop,
					};
				} catch (error) {
					return {
						...base,
						pass: false,
						failed: [
							"run",
						],
						error: error instanceof Error ? error.message : String(error),
						judged: [],
						// What the model wrote when no object could be read from it.
						text:
							error instanceof Error && "text" in error
								? String(error.text)
								: "",
						calls: [],
						stop: "error",
					};
				}
			},
		),
	),
);

const samples: Sample[] = [];
const worker = async () => {
	for (let job = jobs.shift(); job; job = jobs.shift()) {
		const sample = await job();
		samples.push(sample);
		console.error(
			`${sample.pass ? "pass" : "FAIL"} ${sample.case} ${sample.model} #${sample.sample}${sample.pass ? "" : `: ${sample.error ?? sample.failed.join("; ")} (stop: ${sample.stop})`}`,
		);
	}
};
await Promise.all(
	Array.from(
		{
			length: Number(args.concurrency),
		},
		worker,
	),
);

const run: Run = {
	commit,
	models: modelIds,
	samples,
	cost,
};
const out =
	args.out ??
	join(RESULTS, `${new Date().toISOString().slice(0, 19)}-${commit}.json`);
mkdirSync(RESULTS, {
	recursive: true,
});
writeFileSync(out, JSON.stringify(run, null, "\t"));

const rate = (from: Sample[]) =>
	from.length === 0
		? "-"
		: `${from.filter(({ pass }) => pass).length}/${from.length}`;

const percent = (from: Sample[]) =>
	from.length === 0
		? "-"
		: `${Math.round((100 * from.filter(({ pass }) => pass).length) / from.length)}%`;

const cell = (
	format: (from: Sample[]) => string,
	select: (sample: Sample) => boolean,
) => {
	const after = format(samples.filter(select));
	return before ? `${format(before.samples.filter(select))} → ${after}` : after;
};

const ids = new Set<string>(cases.map(({ id }) => id));
const beforeIds = new Set(before?.samples.map((sample) => sample.case));
const onlyNow = before
	? [
			...ids,
		].filter((id) => !beforeIds.has(id))
	: [];
const onlyBefore = [
	...beforeIds,
].filter((id) => !ids.has(id));

/** Totals compare the cases both runs hold. */
const inBoth = (sample: Sample) =>
	ids.has(sample.case) && (!before || beforeIds.has(sample.case));

const areas = [
	...new Set(cases.map(({ id }) => id.split("/")[0])),
];
const rows = [
	`| Case | ${modelIds.join(" | ")} |`,
	`| --- |${modelIds.map(() => " --- |").join("")}`,
	...cases.map(
		({ id }) =>
			`| ${id} | ${modelIds.map((model) => cell(rate, (sample) => sample.case === id && sample.model === model)).join(" | ")} |`,
	),
	...areas.map(
		(area) =>
			`| **${area}** | ${modelIds.map((model) => cell(percent, (sample) => inBoth(sample) && sample.case.startsWith(`${area}/`) && sample.model === model)).join(" | ")} |`,
	),
	`| **all** | ${modelIds.map((model) => cell(percent, (sample) => inBoth(sample) && sample.model === model)).join(" | ")} |`,
];
const total = Object.values(cost).reduce((sum, spent) => sum + spent, 0);

console.log(
	[
		`Prompt evals at ${commit}${before ? `, compared with ${before.commit}` : ""}: ${cases.length} cases, ${sampleCount} samples per model.`,
		"",
		...rows,
		"",
		...(onlyNow.length > 0
			? [
					`Not in ${before?.commit}, left out of the totals: ${onlyNow.join(", ")}.`,
				]
			: []),
		...(onlyBefore.length > 0
			? [
					`Only in ${before?.commit}, left out: ${onlyBefore.join(", ")}.`,
				]
			: []),
		`Cost: ${Object.entries(cost)
			.map(([id, spent]) => `${id} $${spent.toFixed(4)}`)
			.join(", ")}, total $${total.toFixed(4)}.`,
		`Samples: ${out}`,
	].join("\n"),
);
