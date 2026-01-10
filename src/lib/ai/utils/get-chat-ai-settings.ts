import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { decryptApiKey } from "@/lib/encryption";
import { client } from "@/lib/orpc/orpc";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

export const getChatAiSettings = async ({
	templateBlock,
}: {
	templateBlock: TemplateBlock;
}) => {
	const baseProvider = await client.provider.find({
		slug: templateBlock.config.provider,
	});

	const organizationProviderSettings = await client.organizationProvider.find({
		providerSlug: templateBlock.config.provider,
	});

	const provider = createOpenAICompatible({
		baseURL: baseProvider.data.endpoint ?? "", // TODO: Fix?
		apiKey: decryptApiKey(organizationProviderSettings.data.apiKeyEncrypted),
		name: baseProvider.data.slug,
		includeUsage: true,
	});

	const model = wrapLanguageModel({
		model: provider(templateBlock.config.model),
		middleware: [
			devToolsMiddleware(),
			extractReasoningMiddleware({ tagName: "think" }),
		],
	});

	return { provider, model };
};
