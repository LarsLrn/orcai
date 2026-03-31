const MAX_CHAT_TITLE_LENGTH = 80;

export const DEFAULT_CHAT_TITLE = "New Chat";

const isTextPart = (
	part: unknown,
): part is {
	type: "text";
	text: string;
} =>
	typeof part === "object" &&
	part !== null &&
	"type" in part &&
	part.type === "text" &&
	"text" in part &&
	typeof part.text === "string";

export const shouldGenerateChatTitle = (title: string | null | undefined) =>
	title == null || title.trim() === "" || title.trim() === DEFAULT_CHAT_TITLE;

export const getChatTitleSourceText = (message: { parts: unknown[] }) => {
	const text = message.parts
		.filter(isTextPart)
		.map((part) => part.text)
		.join(" ")
		.replaceAll(/\s+/g, " ")
		.trim();

	return text.length > 0 ? text : null;
};

export const buildChatTitlePrompt = (userMessageText: string) =>
	`Based on the following user request, generate a short, descriptive title (maximum ${MAX_CHAT_TITLE_LENGTH} characters). The title should capture the main topic or goal of the request. Return ONLY the title text, nothing else.

User request:
${userMessageText}`;

export const sanitizeGeneratedChatTitle = (title: string) => {
	const sanitized = title
		.trim()
		.replaceAll(/^["'`]+|["'`]+$/g, "")
		.replaceAll(/\s+/g, " ")
		.trim()
		.slice(0, MAX_CHAT_TITLE_LENGTH);

	return sanitized.length > 0 ? sanitized : null;
};
