import { FileTextIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import type { getPassagesTool } from "./get-passages";
import { passageSources, passagesOutputSchema } from "./outputs";

export const getPassagesInputSchema = z.strictObject({
	passages: z
		.array(z.string())
		.min(1)
		.max(RETRIEVAL_LIMITS.maxFullPassageFetches)
		.describe("Refs of passages from earlier results, such as kgol9ts."),
	neighbours: z.coerce
		.number()
		.int()
		.min(0)
		.max(2)
		.default(1)
		.describe("How many passages to read before and after each one."),
});

export const getPassages = declareTool<typeof getPassagesTool>()({
	kind: "read",
	inputSchema: getPassagesInputSchema,
	icon: FileTextIcon,
	name: m.chat_work_log_tool_get_passages_name,
	active: m.chat_work_log_tool_get_passages_active,
	sources: (output) =>
		passageSources(passagesOutputSchema.safeParse(output).data?.passages ?? []),
});
