import { Output } from "ai";
import { z } from "zod/v4";

/** The output budget of one image description. */
export const IMAGE_DESCRIPTION_MAX_OUTPUT_TOKENS = 1024;

/** A summary of an image asset is at most this long. */
const MAX_IMAGE_SUMMARY_LENGTH = 300;

const describeImageRules = `- Describe the image in detail. If it contains text, include the text.
- Do not begin with "The image shows" or similar phrases.
- Use markdown formatting where appropriate, such as bullet points or numbered lists.
- If the image is a chart or graph, include the data it contains.
- If the image is a flowchart, include the steps and how the items relate.`;

const describeTableRules = `- Transcribe the information in the table in a structured format, but not as a markdown table.
- Describe the table in detail, including the headers and any relevant data.
- Do not begin with "The image shows" or similar phrases.
- If the image does not contain a table, describe what it shows instead, following the rules above.`;

const TABLE_HINT = /\btable\b/i;

const rulesFor = (hint: string | undefined) =>
	hint && TABLE_HINT.test(hint) ? describeTableRules : describeImageRules;

/**
 * Instructions for the searchable description of a figure in a document.
 * `hint` is what the extraction knows of the image; one naming a table asks
 * for a transcription.
 */
export const figureDescriptionInstructions = (hint?: string) =>
	`You describe an image so it can be found by searching for its content. Answer with the description only.
${rulesFor(hint)}`;

/** What one call reads from an image asset: its searchable text and a metadata suggestion. */
const imageAssetDescriptionSchema = z.object({
	text: z.string().min(1),
	title: z.string().min(1),
	description: z.string(),
	language: z.string().min(2),
});

export const imageAssetDescriptionOutput = Output.object({
	schema: imageAssetDescriptionSchema,
});

/** An image asset's search text and metadata suggestion, trimmed, the description cut to length. */
export const readImageAssetDescription = (
	output: z.infer<typeof imageAssetDescriptionSchema>,
) => ({
	text: output.text.trim(),
	suggestion: {
		title: output.title.trim(),
		description: output.description.trim().slice(0, MAX_IMAGE_SUMMARY_LENGTH),
		language: output.language.trim(),
	},
});

/** Instructions for an image asset; the fields are spelled out for providers that only take JSON mode. */
export const imageAssetDescriptionInstructions = (hint?: string) =>
	`You describe an image uploaded to a document library. Answer with one JSON object with exactly these fields:
- "text": a description for search, following the rules below.
- "title": a short title for the image, at most 12 words.
- "description": two or three sentences saying what the image shows, at most ${MAX_IMAGE_SUMMARY_LENGTH} characters.
- "language": the BCP 47 tag of the language you wrote in, such as "en" or "de".
Write every field in the language of the text in the image; without text in the image, write in English.

Rules for "text":
${rulesFor(hint)}`;
