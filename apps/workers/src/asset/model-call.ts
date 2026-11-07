import {
	type AiError,
	aiFailure,
	type CallOutput,
	type CallSpec,
	failedReply,
	generateTextWithQuota,
	type ResolvedModel,
} from "@orcai/ai";
import type { OrganizationId, UserId } from "@orcai/core";
import { AssetPipelineError } from "@orcai/preparation";
import * as Effect from "effect/Effect";
import { summarizeErrorCause } from "@/asset/error-summary";

/** Whether `model` is there and reads images. */
export const readsImages = (
	model: ResolvedModel | undefined,
): model is ResolvedModel => model?.capabilities.includes("image") === true;

/** An image the asset's utility model cannot read, which an admin fixes by picking one that can. */
export const cannotReadImages = () =>
	new AssetPipelineError({
		failure: "unsupported",
		cause: new Error("The utility model cannot read images"),
	});

const modelCallFailure = (
	error: AiError,
	maxOutputTokens: number | undefined,
) =>
	new AssetPipelineError({
		failure: aiFailure(error),
		cause: {
			...summarizeErrorCause(error),
			...failedReply(error),
			maxOutputTokens,
		},
	});

/**
 * One call of the asset organisation's utility model, metered against the
 * uploader. A refused quota fails the asset with `quota`; a failed call fails
 * it with the model's failure and what its reply said.
 */
export const assetModelCall = <OUTPUT extends CallOutput>({
	appRequestId,
	owner,
	model,
	call,
}: {
	appRequestId: string;
	owner: {
		organizationId: OrganizationId;
		userId: UserId;
	};
	model: ResolvedModel;
	call: CallSpec<OUTPUT>;
}) =>
	generateTextWithQuota({
		appRequestId,
		organizationId: owner.organizationId,
		userId: owner.userId,
		providerId: model.providerId,
		modelId: model.modelId,
		model: model.language,
		call,
	}).pipe(
		Effect.catchTags({
			QuotaDeniedError: (denied) =>
				Effect.fail(
					new AssetPipelineError({
						failure: "quota",
						cause: denied,
					}),
				),
			AiError: (error) =>
				Effect.fail(modelCallFailure(error, call.maxOutputTokens)),
		}),
	);
