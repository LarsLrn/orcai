import { z } from "zod/v4";

export const LOCALES = [
	"en",
	"de",
] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;
