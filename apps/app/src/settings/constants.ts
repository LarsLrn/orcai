export const COOKIES = {
	ZED_TOKEN: {
		name: "zed_token",
		maxAge: 60, // seconds
	},
};

export const HEADERS = {
	X_ZED_TOKEN: "X-Zed-Token",
};

export const CHAT_ATTACHMENT_DOCUMENT_MIME_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH = 20_000;

export const CHAT_ATTACHMENT_LIMIT = 8;

export const CHAT_ATTACHMENT_ACCEPT =
	"image/*,application/pdf,text/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const RETRIEVAL_LIMITS = {
	maxSnippetResultsPerCall: 8,
	maxFullChunkFetches: 8,
	snippetLengthChars: 360,
} as const;

export const AUTHZ = {
	outboxInlineWaitMs: 25,
	outboxInlineWaitAttempts: 80,
	outboxRetryBaseDelayMs: 30_000,
	outboxProcessingStaleAfterMs: 5 * 60_000,
	outboxMaxAttempts: 20,
};
