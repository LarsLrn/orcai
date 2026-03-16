import { z } from "zod/v4";
import { providerMeteringModes } from "@/lib/ai/providers";

export const providerMeteringModeSchema = z.enum(
	providerMeteringModes.map((mode) => mode.value),
);

export type ProviderMeteringMode = z.infer<typeof providerMeteringModeSchema>;
