import type { ModelProviderKind } from "@orcai/core";
import { languageTag } from "@orcai/schema";
import { Output } from "ai";
import { z } from "zod/v4";
import { jsonAnswerInstructions } from "./json-answer";

/** The output budget of one image description. */
export const IMAGE_DESCRIPTION_MAX_OUTPUT_TOKENS = 1024;

/** A summary of an image asset is at most this long. */
const MAX_IMAGE_SUMMARY_LENGTH = 300;

const describeImageRules = `- Describe the image in detail, and copy every piece of text in it word for word.
- Start with what the image is, such as "Bar chart of enrolments per year", rather than with a phrase about the image such as "The image shows".
- For a chart or graph, give its axes, its series and the values it shows.
- For a flowchart or diagram, give each step and how the steps connect.
- Use Markdown lists where the content is a list or a sequence.`;

const describeTableRules = `- The image is probably a table. Transcribe it as a list with one item per row, each value after its column header, such as "- Year: 2023, Refunds: 412", so that each row reads on its own. Then say in one or two sentences what the table covers.
- When the image holds no table, describe it by the rules above.`;

const TABLE_HINT = /\btable\b/i;

/** `hint` is what the extraction knows of the image; one naming a table asks for a transcription. */
const rulesFor = (hint: string | undefined) =>
	hint && TABLE_HINT.test(hint)
		? `${describeImageRules}\n${describeTableRules}`
		: describeImageRules;

const languageNames = new Intl.DisplayNames(
	[
		"en",
	],
	{
		type: "language",
	},
);

/** The language rule; `locale` is the uploader's, the default for images without text. */
const languageRule = (scope: string, locale: string) => {
	const language = languageNames.of(locale) ?? locale;
	return `Write ${scope} in ${language}, the uploader's language, so that they find the image in their own words. When the image holds text in another language, write in the language of that text instead.`;
};

/** Instructions for the searchable description of a figure in a document. */
export const figureDescriptionInstructions = ({
	hint,
	locale,
}: {
	hint?: string;
	locale: string;
}) =>
	[
		"You describe an image from a document so that people can find it by searching for its content. Answer with the description alone.",
		rulesFor(hint),
		languageRule("the description", locale),
	].join("\n");

/** What one call reads from an image asset: its searchable text and a metadata suggestion. */
const imageAssetDescriptionSchema = z.object({
	text: z
		.string()
		.min(1)
		.describe(
			'A description of the image for search, by the rules for "text".',
		),
	title: z
		.string()
		.min(1)
		.describe("A title for the image of at most 12 words."),
	description: z
		.string()
		.describe(
			`Two or three sentences on what the image shows, at most ${MAX_IMAGE_SUMMARY_LENGTH} characters.`,
		),
	language: z
		.string()
		.min(2)
		.describe(
			'The BCP 47 tag of the language you wrote in, such as "en" or "de".',
		),
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
		language: languageTag(output.language.trim()),
	},
});

/** Instructions for an image asset read by a model of `kind`. */
export const imageAssetDescriptionInstructions = ({
	kind,
	hint,
	locale,
}: {
	kind: ModelProviderKind;
	hint?: string;
	locale: string;
}) =>
	[
		"You describe an image uploaded as a file of its own, so that people can find it by searching for its content and see what it shows.",
		jsonAnswerInstructions(kind, imageAssetDescriptionSchema),
		`Rules for "text":\n${rulesFor(hint)}`,
		languageRule("every field", locale),
	]
		.filter(Boolean)
		.join("\n\n");
