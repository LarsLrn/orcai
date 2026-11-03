import type { dbSchema } from "@orcai/db";

const MIN_TOKEN_RESERVATION = 512;

/** The output a call reserves without a cap of its own or a known model maximum. */
const DEFAULT_OUTPUT_TOKENS = 4_096;

/** Providers bill an image by its size; this covers a large one. */
const FILE_PART_TOKENS = 1_600;

/** The estimate of a value sent as text: four characters per token. */
export const charTokens = (value: unknown) =>
	Math.ceil((JSON.stringify(value)?.length ?? 0) / 4);

const isFilePart = (part: unknown) =>
	typeof part === "object" &&
	part !== null &&
	"type" in part &&
	(part.type === "file" || part.type === "image");

const partsTokens = (parts: readonly unknown[]) =>
	parts.reduce<number>(
		(sum, part) =>
			sum + (isFilePart(part) ? FILE_PART_TOKENS : charTokens(part)),
		0,
	);

const messageTokens = (message: unknown) => {
	if (typeof message === "object" && message !== null) {
		if ("parts" in message && Array.isArray(message.parts)) {
			return partsTokens(message.parts);
		}
		if ("content" in message) {
			return Array.isArray(message.content)
				? partsTokens(message.content)
				: charTokens(message.content);
		}
	}
	return charTokens(message);
};

/**
 * The estimate of what messages send: UI messages by their parts, model
 * messages by their content, each file at the cost of a large image, and
 * anything else as text.
 */
export const promptTokens = (messages: readonly unknown[]) =>
	messages.reduce<number>((sum, message) => sum + messageTokens(message), 0);

/**
 * What a call reserves for one provider request: requests mode its requests,
 * tokens mode its input and its output cap, else the model's maximum output.
 */
export const reservationAmount = (params: {
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	maxRequests: number;
	inputTokens: number;
	maxOutputTokens: number | undefined;
}) =>
	params.meteringMode === "requests"
		? params.maxRequests
		: Math.max(
				MIN_TOKEN_RESERVATION,
				params.inputTokens + (params.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS),
			);
