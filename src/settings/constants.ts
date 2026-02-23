export const COOKIES = {
	ZED_TOKEN: {
		name: "zed_token",
		expires: 1, // days
	},
};

export const HEADERS = {
	X_ZED_TOKEN: "X-Zed-Token",
};

export const DOCLING_DEFAULT_TIMEOUT = 15 * 60 * 1000;

export const CHAT_ATTACHMENT_DOCUMENT_MIME_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const CHAT_ATTACHMENT_MAX_ATTACHMENT_TEXT_LENGTH = 20_000;

export const CHAT_ATTACHMENT_LIMIT = 8;

export const CHAT_ATTACHMENT_ACCEPT =
	"image/*,application/pdf,text/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";
