import { z } from "zod/v4";
import { modelCapabilities } from "@/lib/ai/providers";

export const modelCapabilitiesSchema = z.enum(
	modelCapabilities.map((cap) => cap.value),
);

export type ModelCapability = z.infer<typeof modelCapabilitiesSchema>;
