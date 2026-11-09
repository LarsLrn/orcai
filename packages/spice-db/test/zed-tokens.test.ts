import { describe, expect, test } from "bun:test";
import { zedTokenKeeper } from "./zed-tokens";

type Step = {
	run: () => void;
	done: boolean;
	/** Steps that are possible only after this one. */
	unlocks?: Step[];
	/** Steps this one rules out. */
	excludes?: Step[];
	locked?: boolean;
};

/** Lets every promise the last step started run as far as it can. */
const settle = async () => {
	for (let turn = 0; turn < 10; turn++) await Promise.resolve();
};

const revision = (token: string | undefined) => Number(token ?? 0);

/**
 * From revision 1, two calls that write revisions 2 and 4 and an observed
 * revision 3. SpiceDB takes each head read's snapshot at some point after it
 * is asked, so taking the snapshot, answering with it and failing are
 * separate steps.
 */
const scenario = () => {
	let revealed = 1;
	const reveal = (written: number) => {
		revealed = Math.max(revealed, written);
	};
	const heads: Step[] = [];
	const keeper = zedTokenKeeper(() => {
		const read = Promise.withResolvers<string>();
		let snapshot = 0;
		const answer: Step = {
			done: false,
			locked: true,
			run: () => read.resolve(String(snapshot)),
		};
		const fail: Step = {
			done: false,
			run: () => read.reject(new Error("SpiceDB is unavailable")),
		};
		const take: Step = {
			done: false,
			run: () => {
				snapshot = revealed;
			},
			unlocks: [
				answer,
			],
		};
		fail.excludes = [
			take,
			answer,
		];
		heads.push(take, answer, fail);
		return read.promise;
	}, "1");
	/** The revisions whose call or observation reported success. */
	const covered: number[] = [];
	const report = (written: number, reported: Promise<unknown>) => {
		reported.then(
			() => covered.push(written),
			() => undefined,
		);
	};
	const call = (written: number): Step => {
		const returned = Promise.withResolvers<string>();
		report(
			written,
			keeper.track(
				() => returned.promise,
				(token) => token,
			),
		);
		return {
			done: false,
			run: () => {
				reveal(written);
				returned.resolve(String(written));
			},
		};
	};
	const writes: Step[] = [
		call(2),
		call(4),
		{
			done: false,
			run: () => {
				reveal(3);
				report(3, keeper.observe("3"));
			},
		},
	];
	return {
		keeper,
		covered,
		open: () =>
			[
				...writes,
				...heads,
			].filter((step) => !step.done && !step.locked),
		take: (step: Step) => {
			step.done = true;
			for (const unlocked of step.unlocks ?? []) unlocked.locked = false;
			for (const excluded of step.excludes ?? []) excluded.done = true;
			step.run();
		},
	};
};

/**
 * Every order of the writes and of each head read's snapshot, answer or
 * failure. After every step the kept token covers every write reported as
 * kept and is no older than before.
 */
const interleavings = async (path: number[] = []): Promise<string[]> => {
	const run = scenario();
	let lowest = revision(run.keeper.read());
	for (const index of path) {
		const step = run.open()[index];
		if (!step) throw new Error("unreachable step");
		run.take(step);
		await settle();
		const kept = revision(run.keeper.read());
		if (kept < lowest)
			return [
				`${path.join(",")}: went back to ${kept}`,
			];
		const missed = run.covered.filter((written) => written > kept);
		if (missed.length > 0)
			return [
				`${path.join(",")}: kept ${kept}, missed ${missed.join(",")}`,
			];
		lowest = kept;
	}
	const open = run.open();
	const failures = [];
	for (let index = 0; index < open.length; index++) {
		failures.push(
			...(await interleavings([
				...path,
				index,
			])),
		);
	}
	return failures;
};

/** A keeper whose head reads answer only when the test says so. */
const scriptedHeads = (initial?: string) => {
	const answers: ReturnType<typeof Promise.withResolvers<string>>[] = [];
	const keeper = zedTokenKeeper(() => {
		const answer = Promise.withResolvers<string>();
		answers.push(answer);
		return answer.promise;
	}, initial);
	return {
		keeper,
		answers,
	};
};

describe("zedTokenKeeper", () => {
	test("covers every write reported as kept and never goes back, in any order and with failed head reads", async () => {
		expect(await interleavings()).toEqual([]);
	});

	test("with every head read answering, every write is reported and the newest kept", async () => {
		const run = scenario();
		for (let step = run.open()[0]; step; step = run.open()[0]) {
			run.take(step);
			await settle();
		}

		expect(
			[
				...run.covered,
			].sort(),
		).toEqual([
			2,
			3,
			4,
		]);
		expect(run.keeper.read()).toBe("4");
	});

	test("writes reported while a head read runs share the one after it", async () => {
		const { keeper, answers } = scriptedHeads();
		const first = keeper.observe("1");
		await settle();
		const second = keeper.observe("2");
		const third = keeper.observe("3");
		expect(answers).toHaveLength(1);

		answers[0]?.resolve("1");
		await first;
		await settle();
		expect(answers).toHaveLength(2);
		answers[1]?.resolve("3");
		await Promise.all([
			second,
			third,
		]);

		expect(keeper.read()).toBe("3");
	});

	test("a failed head read keeps the token and lets the next one run", async () => {
		const { keeper, answers } = scriptedHeads("1");
		const failed = keeper.observe("2");
		await settle();
		answers[0]?.reject(new Error("SpiceDB is unavailable"));
		await expect(failed).rejects.toThrow("SpiceDB is unavailable");
		expect(keeper.read()).toBe("1");

		const next = keeper.observe("3");
		await settle();
		answers[1]?.resolve("3");
		await next;

		expect(keeper.read()).toBe("3");
	});
});
