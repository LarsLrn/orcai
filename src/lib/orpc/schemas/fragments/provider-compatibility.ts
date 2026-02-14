import { z } from "zod/v4";
import { providerCompatibilities } from "@/lib/ai/providers";

export const providerCompatibilitySchema = z.enum(
	providerCompatibilities.map((comp) => comp.value),
);

export type ProviderCompatibility = z.infer<typeof providerCompatibilitySchema>;
