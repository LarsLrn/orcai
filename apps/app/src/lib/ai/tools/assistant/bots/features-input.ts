import { type FeatureId, featuresSchema } from "@orcai/schema";
import { z } from "zod/v4";

const strictSettings = <Shape extends z.core.$ZodShape>(
	feature: z.ZodOptional<z.ZodObject<Shape>>,
) =>
	feature
		.unwrap()
		.strict()
		.optional()
		.meta(feature.meta() ?? {});

const { generativeUi, webSearch, questions } = featuresSchema.shape;

/** `featuresSchema` as a bot tool takes it: a misnamed feature or setting fails instead of being dropped. */
export const featuresInputSchema = z.strictObject({
	generativeUi: strictSettings(generativeUi),
	webSearch: strictSettings(webSearch),
	questions: strictSettings(questions),
} satisfies Record<FeatureId, z.ZodType>);
