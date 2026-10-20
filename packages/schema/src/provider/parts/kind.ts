import { providerKinds } from "@orcai/core";
import { z } from "zod/v4";

export const providerKindSchema = z.enum(
	providerKinds.map((entry) => entry.kind),
);
