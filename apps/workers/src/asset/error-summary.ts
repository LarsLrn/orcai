import { type AiError, aiFailure, failedReply } from "@orcai/ai";
import { PgBossError } from "@orcai/pg-boss";
import { AssetPipelineError } from "@/asset/pipeline-attempt";

const MAX_ERROR_MESSAGE_LENGTH = 320;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object";

const compactObject = (value: Record<string, unknown>) =>
	Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
	);

const stringField = (value: unknown) =>
	typeof value === "string" ? value : undefined;

const numberField = (value: unknown) =>
	typeof value === "number" ? value : undefined;

const getStatusCode = (value: Record<string, unknown>) => {
	if (numberField(value.status) !== undefined) {
		return value.status;
	}
	if (numberField(value.statusCode) !== undefined) {
		return value.statusCode;
	}
	if (
		isRecord(value.$metadata) &&
		numberField(value.$metadata.httpStatusCode) !== undefined
	) {
		return value.$metadata.httpStatusCode;
	}
	return undefined;
};

const sanitizeMessage = (value: unknown) => {
	if (typeof value !== "string") return undefined;
	if (value.startsWith("data:")) {
		return `[redacted-data-url:${value.length} chars]`;
	}
	if (value.length > MAX_ERROR_MESSAGE_LENGTH) {
		return `${value.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...[truncated ${value.length - MAX_ERROR_MESSAGE_LENGTH} chars]`;
	}
	return value;
};

/** An error's identifying fields, with long messages and data URLs cut. */
export const summarizeErrorCause = (
	cause: unknown,
): Record<string, unknown> => {
	if (typeof cause === "string") {
		return {
			message: sanitizeMessage(cause),
		};
	}

	if (cause instanceof Error) {
		const details = cause as Error & Record<string, unknown>;
		const nested = isRecord(details.cause) ? details.cause : undefined;
		return compactObject({
			name: cause.name,
			tag: stringField(details._tag),
			code: stringField(details.code),
			message: sanitizeMessage(cause.message),
			operation: stringField(details.operation),
			step: stringField(details.step),
			queue: stringField(details.queue),
			stage: stringField(details.stage),
			fileName: stringField(details.fileName),
			fileType: stringField(details.fileType),
			decodedBytes: numberField(details.decodedBytes),
			statusCode: getStatusCode(details),
			causeName: nested ? stringField(nested.name) : undefined,
			causeTag: nested ? stringField(nested._tag) : undefined,
			causeCode: nested ? stringField(nested.code) : undefined,
			causeMessage: nested ? sanitizeMessage(nested.message) : undefined,
			causeStatusCode: nested ? getStatusCode(nested) : undefined,
		});
	}

	if (!isRecord(cause)) {
		return {
			value: String(cause),
		};
	}

	const nested = isRecord(cause.cause) ? cause.cause : undefined;
	return compactObject({
		name: stringField(cause.name),
		tag: stringField(cause._tag),
		code: stringField(cause.code),
		message:
			sanitizeMessage(cause.message) ??
			(nested ? sanitizeMessage(nested.message) : undefined),
		operation: stringField(cause.operation),
		step: stringField(cause.step),
		queue: stringField(cause.queue),
		stage: stringField(cause.stage),
		fileName: stringField(cause.fileName),
		fileType: stringField(cause.fileType),
		decodedBytes: numberField(cause.decodedBytes),
		statusCode: getStatusCode(cause),
		causeName: nested ? stringField(nested.name) : undefined,
		causeTag: nested ? stringField(nested._tag) : undefined,
		causeCode: nested ? stringField(nested.code) : undefined,
		causeMessage: nested ? sanitizeMessage(nested.message) : undefined,
		causeStatusCode: nested ? getStatusCode(nested) : undefined,
	});
};

export const toSanitizedPgBossRunError = (cause: unknown) =>
	new PgBossError({
		operation: "run",
		cause: summarizeErrorCause(cause),
	});

/** A failed model call as the asset's failure, with what its reply says for the log. */
export const modelCallFailure = (error: AiError, maxOutputTokens: number) =>
	new AssetPipelineError({
		failure: aiFailure(error),
		cause: {
			...summarizeErrorCause(error),
			...failedReply(error),
			maxOutputTokens,
		},
	});
