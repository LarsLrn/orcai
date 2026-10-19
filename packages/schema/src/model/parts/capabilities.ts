import { modelCapabilities } from "@orcai/core";
import { z } from "zod/v4";

export const modelCapabilitiesSchema = z.enum(modelCapabilities);

export type ModelCapability = z.infer<typeof modelCapabilitiesSchema>;
