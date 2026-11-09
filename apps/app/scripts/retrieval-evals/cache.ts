import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Outside the repository, shared by every checkout, so fetched documents and model answers are paid for once. */
export const CACHE =
	process.env.RETRIEVAL_EVALS_CACHE ??
	join(homedir(), ".cache/orcai/retrieval-evals");

export const sha256 = (data: string | Uint8Array) =>
	createHash("sha256").update(data).digest("hex");

/** A file pinned by its digest, fetched once and checked on every read; a cached copy with another digest is fetched again. */
export const pinnedFile = async (params: {
	url: string;
	sha256: string;
	path: string;
}) => {
	const path = join(CACHE, params.path);
	if (existsSync(path)) {
		const cached = new Uint8Array(readFileSync(path));
		if (sha256(cached) === params.sha256) return cached;
	}
	const response = await fetch(params.url);
	if (!response.ok) {
		throw new Error(`Fetching ${params.url} failed: ${response.status}`);
	}
	const data = new Uint8Array(await response.arrayBuffer());
	const digest = sha256(data);
	if (digest !== params.sha256) {
		throw new Error(
			`${params.url} has sha256 ${digest}, the manifest pins ${params.sha256}`,
		);
	}
	mkdirSync(dirname(path), {
		recursive: true,
	});
	writeFileSync(`${path}.part`, data);
	renameSync(`${path}.part`, path);
	return data;
};

/** Answers by key in an append-only file: a run adds what it computed, so a stopped run keeps its work. */
export const answerStore = <T>(name: string) => {
	const path = join(CACHE, `${name}.jsonl`);
	const answers = new Map<string, T>();
	if (existsSync(path)) {
		for (const line of readFileSync(path, "utf8").split("\n")) {
			if (line === "") continue;
			const { key, value } = JSON.parse(line) as {
				key: string;
				value: T;
			};
			answers.set(key, value);
		}
	}
	return {
		get: (key: string) => answers.get(key),
		set: (key: string, value: T) => {
			mkdirSync(dirname(path), {
				recursive: true,
			});
			appendFileSync(
				path,
				`${JSON.stringify({
					key,
					value,
				})}\n`,
			);
			answers.set(key, value);
		},
	};
};
