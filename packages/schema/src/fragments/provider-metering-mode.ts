import { providerMeteringModes } from "@orcai/core";
import { z } from "zod/v4";

export const providerMeteringModeSchema = z.enum(
	providerMeteringModes.map((mode) => mode.value),
);

export type ProviderMeteringMode = z.infer<typeof providerMeteringModeSchema>;
