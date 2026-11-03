import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { createTurnZedToken } from "./zed-token";

describe("createTurnZedToken", () => {
	const save = (zedToken?: string) =>
		Effect.succeed({
			data: {},
			...(zedToken
				? {
						meta: {
							zedToken,
						},
					}
				: {}),
		});

	test("each call reads at the newest token of the turn", async () => {
		const turn = createTurnZedToken("request-token");
		const seen: (string | undefined)[] = [];
		const call = (written?: string) =>
			turn.run((zedToken) => {
				seen.push(zedToken);
				return save(written);
			});

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* call("after-save");
				yield* call();
				yield* call();
			}),
		);

		expect(seen).toEqual([
			"request-token",
			"after-save",
			"after-save",
		]);
		expect(turn.current()).toBe("after-save");
	});

	test("concurrent calls run one at a time, so a slow write cannot roll the token back", async () => {
		const turn = createTurnZedToken("request-token");
		const seen: (string | undefined)[] = [];
		const slowSave = (written: string, delay: number) =>
			turn.run((zedToken) =>
				Effect.sync(() => seen.push(zedToken)).pipe(
					Effect.andThen(Effect.sleep(delay)),
					Effect.andThen(save(written)),
				),
			);

		await Effect.runPromise(
			Effect.all(
				[
					slowSave("first-save", 20),
					slowSave("second-save", 0),
				],
				{
					concurrency: "unbounded",
				},
			),
		);

		expect(seen).toEqual([
			"request-token",
			"first-save",
		]);
		expect(turn.current()).toBe("second-save");
	});
});
