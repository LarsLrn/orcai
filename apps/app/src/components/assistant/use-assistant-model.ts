import { ORPCError } from "@orpc/client";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

type AssistantModelAvailability = "loading" | "unset" | "set";

/** Unset also when the organisation still names a model that is gone; other failures keep it set. */
const assistantModelAvailability = ({
	organizationStatus,
	modelId,
	modelMissing,
}: {
	organizationStatus: "pending" | "error" | "success";
	modelId: string | null;
	modelMissing: boolean;
}): AssistantModelAvailability =>
	organizationStatus === "pending"
		? "loading"
		: !modelId || modelMissing
			? "unset"
			: "set";

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

	const { data: model, error: modelError } = useQuery(
		orpc.model.find.queryOptions({
			input: modelId
				? {
						id: modelId,
					}
				: skipToken,
		}),
	);
	const providerId = model?.data.providerId ?? null;

	const availability = assistantModelAvailability({
		organizationStatus,
		modelId,
		modelMissing:
			modelError instanceof ORPCError && modelError.code === "NOT_FOUND",
	});

	return {
		availability,
		modelId,
		providerId,
		modelName: model?.data.name,
	};
};

export {
	type AssistantModelAvailability,
	assistantModelAvailability,
	useAssistantModel,
};
