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

export const CHAT_ATTACHMENT_LIMIT = 8;

export const CHAT_ATTACHMENT_ACCEPT =
	UPLOAD_ROUTES.chatAttachment.allowedMimePatterns.join(",");

export const RETRIEVAL_LIMITS = {
	maxSnippetResultsPerCall: 8,
	maxFullChunkFetches: 8,
	snippetLengthChars: 360,
} as const;

export const AUTHZ = {
	outboxInlineWaitMs: 25,
	outboxInlineWaitAttempts: 80,
	outboxRetryBaseDelayMs: 30_000,
	outboxDeliveryTimeoutMs: 10_000,
	outboxBlockedErrorAfterMs: 300_000,
	outboxMutationsPerEvent: 500,
};
