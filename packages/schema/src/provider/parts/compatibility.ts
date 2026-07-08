import { providerCompatibilities } from "@orcai/core";
import { z } from "zod/v4";

export const providerCompatibilitySchema = z.enum(
	providerCompatibilities.map((comp) => comp.value),
);

export type ProviderCompatibility = z.infer<typeof providerCompatibilitySchema>;
