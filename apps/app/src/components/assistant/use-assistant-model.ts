import { skipToken, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

type AssistantModelAvailability = "loading" | "unset" | "set";

/** The active organisation's assistant model, read live like the turn does. */
const useAssistantModel = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization, status: organizationStatus } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);
	const modelId = organization?.data.assistantModelId ?? null;

	const { data: model } = useQuery(
		orpc.model.find.queryOptions({
			input: modelId
				? {
						id: modelId,
					}
				: skipToken,
		}),
	);
	const providerId = model?.data.providerId ?? null;

	const availability: AssistantModelAvailability =
		organizationStatus === "pending" ? "loading" : modelId ? "set" : "unset";

	return {
		availability,
		modelId,
		providerId,
		modelName: model?.data.name,
	};
};

export { type AssistantModelAvailability, useAssistantModel };
