import type { Model, Provider } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/lib/orpc/orpc";

type ChatModelAvailability = "loading" | "ready" | "none";

/** First chat-capable model on an enabled provider. */
const useDefaultChatModel = () => {
	const { data: providersResult, status: providersStatus } = useQuery(
		orpc.provider.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
				filters: {
					enabled: true,
				},
			},
		}),
	);

	const { data: modelsResult, status: modelsStatus } = useQuery(
		orpc.model.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 20,
				filters: {
					capabilities: [
						"text",
						"tool-calling",
					],
				},
			},
		}),
	);

	const match = useMemo(() => {
		const providers = providersResult?.data ?? [];
		const models = modelsResult?.data ?? [];
		for (const model of models) {
			const provider = providers.find((p) => p.id === model.providerId);
			if (provider) {
				return {
					model: model as Model,
					provider: provider as Provider,
				};
			}
		}
		return null;
	}, [
		providersResult,
		modelsResult,
	]);

	const availability: ChatModelAvailability =
		providersStatus === "pending" || modelsStatus === "pending"
			? "loading"
			: match
				? "ready"
				: "none";

	return {
		availability,
		defaultModel: match?.model ?? null,
		defaultProvider: match?.provider ?? null,
	};
};

export { type ChatModelAvailability, useDefaultChatModel };
