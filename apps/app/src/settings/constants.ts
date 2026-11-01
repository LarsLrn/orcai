import { UPLOAD_ROUTES } from "@orcai/s3";

export const COOKIES = {
	ZED_TOKEN: {
		name: "zed_token",
		maxAge: 60, // seconds
	},
};

export const HEADERS = {
	X_ZED_TOKEN: "X-Zed-Token",
};

export const CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH = 20_000;

/** The image bytes one turn sends the model, newest messages first. */
export const CHAT_ATTACHMENT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const CHAT_ATTACHMENT_ACCEPT =
	UPLOAD_ROUTES.chatAttachment.allowedMimePatterns.join(",");

/** The same types in the shape a drop zone takes. */
export const CHAT_ATTACHMENT_DROP_ACCEPT = Object.fromEntries(
	UPLOAD_ROUTES.chatAttachment.allowedMimePatterns.map((type) => [
		type,
		[],
	]),
);

export const RETRIEVAL_LIMITS = {
	maxSnippetResultsPerCall: 8,
	maxFullPassageFetches: 8,
} as const;

export const AUTHZ = {
	outboxInlineWaitMs: 25,
	outboxInlineWaitAttempts: 80,
	outboxRetryBaseDelayMs: 30_000,
	outboxDeliveryTimeoutMs: 10_000,
	outboxBlockedErrorAfterMs: 300_000,
	outboxMutationsPerEvent: 500,
};
