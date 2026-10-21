import * as Data from "effect/Data";

export class S3Error extends Data.TaggedError("S3Error")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

type S3LikeCause = {
	name?: string;
	code?: string;
	Code?: string;
	$metadata?: {
		httpStatusCode?: number;
	};
};

const isS3LikeCause = (cause: unknown): cause is S3LikeCause =>
	cause !== null && typeof cause === "object";

export const getS3StatusCode = (cause: unknown) =>
	isS3LikeCause(cause) ? cause.$metadata?.httpStatusCode : undefined;

export const getS3Code = (cause: unknown) => {
	if (!isS3LikeCause(cause)) {
		return undefined;
	}

	if (typeof cause.Code === "string") {
		return cause.Code;
	}

	if (typeof cause.code === "string") {
		return cause.code;
	}

	if (typeof cause.name === "string") {
		return cause.name;
	}

	return undefined;
};

/** Whether an S3 call failed because the object, upload or bucket does not exist. */
export const isS3NotFound = (error: S3Error) => {
	const statusCode = getS3StatusCode(error.cause);
	const code = getS3Code(error.cause);
	return (
		statusCode === 404 ||
		code === "NotFound" ||
		code === "NoSuchKey" ||
		code === "NoSuchUpload" ||
		code === "NoSuchBucket"
	);
};
