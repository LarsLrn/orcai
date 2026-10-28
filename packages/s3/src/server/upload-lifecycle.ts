import type { LifecycleRule } from "@aws-sdk/client-s3";
import { buckets } from "@orcai/core";
import * as Effect from "effect/Effect";
import { UPLOAD_STAGING_PREFIX } from "../shared/upload-policy";
import {
	sendGetBucketLifecycleConfigurationCommand,
	sendPutBucketLifecycleConfigurationCommand,
} from "./commands";
import { getS3Code } from "./errors";
import { createBucketIfNotExists } from "./upload-validation";

/** Staged uploads no asset was created from, and abandoned multipart uploads. */
export const UPLOAD_LIFECYCLE_RULES = [
	{
		ID: "expire-staged-uploads",
		Status: "Enabled",
		Filter: {
			Prefix: UPLOAD_STAGING_PREFIX,
		},
		Expiration: {
			Days: 1,
		},
		AbortIncompleteMultipartUpload: {
			DaysAfterInitiation: 1,
		},
	},
] as const satisfies LifecycleRule[];

const RETIRED_RULE_IDS = [
	"expire-data-exports",
] as const;

const MANAGED_RULE_IDS = new Set<string>([
	...UPLOAD_LIFECYCLE_RULES.map((rule) => rule.ID),
	...RETIRED_RULE_IDS,
]);

/** Idempotent: puts these rules on the uploads bucket, drops retired ones and keeps any other rule. */
export const ensureUploadLifecycle = Effect.gen(function* () {
	yield* createBucketIfNotExists(buckets.main.name);
	const current = yield* sendGetBucketLifecycleConfigurationCommand({
		bucket: buckets.main.name,
	}).pipe(
		Effect.catchIf(
			(error) => getS3Code(error.cause) === "NoSuchLifecycleConfiguration",
			() => Effect.succeed(undefined),
		),
	);

	yield* sendPutBucketLifecycleConfigurationCommand({
		bucket: buckets.main.name,
		rules: [
			...(current?.Rules ?? []).filter(
				(rule) => !rule.ID || !MANAGED_RULE_IDS.has(rule.ID),
			),
			...UPLOAD_LIFECYCLE_RULES,
		],
		transitionDefaultMinimumObjectSize:
			current?.TransitionDefaultMinimumObjectSize,
	});
});
