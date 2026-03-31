import { modelCapabilities } from "@orcai/core";
import { z } from "zod/v4";

export const modelCapabilitiesSchema = z.enum(
	modelCapabilities.map((cap) => cap.value),
);

export type ModelCapability = z.infer<typeof modelCapabilitiesSchema>;
