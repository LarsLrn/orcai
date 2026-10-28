import { describe, expect, test } from "bun:test";
import { buckets } from "@orcai/core";
import * as Effect from "effect/Effect";
import { S3Live, type S3Service } from "../src/server";
import {
	sendGetBucketLifecycleConfigurationCommand,
	sendPutBucketLifecycleConfigurationCommand,
} from "../src/server/commands";
import { ensureUploadLifecycle } from "../src/server/upload-lifecycle";

const run = <A, E>(effect: Effect.Effect<A, E, S3Service>) =>
	Effect.runPromise(effect.pipe(Effect.provide(S3Live)));

const FOREIGN_RULE = {
	ID: "foreign-rule",
	Status: "Enabled",
	Filter: {
		Prefix: "foreign/",
	},
	Expiration: {
		Days: 30,
	},
} as const;

describe("ensureUploadLifecycle", () => {
	test("replaces the rules of an earlier release and keeps rules it does not own", async () => {
		const ruleIds = await run(
			Effect.gen(function* () {
				yield* ensureUploadLifecycle;
				const original = yield* sendGetBucketLifecycleConfigurationCommand({
					bucket: buckets.main.name,
				});

				return yield* Effect.gen(function* () {
					yield* sendPutBucketLifecycleConfigurationCommand({
						bucket: buckets.main.name,
						rules: [
							FOREIGN_RULE,
							{
								ID: "expire-data-exports",
								Status: "Enabled",
								Filter: {
									Prefix: "exports/",
								},
								Expiration: {
									Days: 1,
								},
							},
							{
								ID: "expire-staged-uploads",
								Status: "Enabled",
								Filter: {
									Prefix: "staging/",
								},
								Expiration: {
									Days: 7,
								},
							},
						],
					});

					yield* ensureUploadLifecycle;
					const config = yield* sendGetBucketLifecycleConfigurationCommand({
						bucket: buckets.main.name,
					});
					return (config.Rules ?? []).map((rule) => rule.ID).sort();
				}).pipe(
					// The bucket is shared with the rest of the tier.
					Effect.ensuring(
						sendPutBucketLifecycleConfigurationCommand({
							bucket: buckets.main.name,
							rules: original.Rules ?? [],
							transitionDefaultMinimumObjectSize:
								original.TransitionDefaultMinimumObjectSize,
						}).pipe(Effect.ignore),
					),
				);
			}),
		);

		expect(ruleIds).toEqual([
			"expire-staged-uploads",
			"foreign-rule",
		]);
	}, 30_000);
});
