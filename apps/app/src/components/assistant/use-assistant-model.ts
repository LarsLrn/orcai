import type { OrganizationId } from "@orcai/core";
import { ORPCError } from "@orpc/client";
import { type QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { quotaStatusQuery } from "@/components/quota/use-quota-status";
import {
	activeOrganizationQuery,
	useActiveOrganization,
} from "@/hooks/use-active-organization";
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

/** The active organisation's assistant model, read live like the turn does; the model is not read while disabled. */
const useAssistantModel = ({ enabled = true }: { enabled?: boolean } = {}) => {
	const { data: organization, status: organizationStatus } =
		useActiveOrganization();
	const modelId = organization?.data.assistantModelId ?? null;

	const { data: model, error: modelError } = useQuery(
		orpc.model.find.queryOptions({
			input:
				enabled && modelId
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

/**
 * Loads the organisation's assistant model, and its quota with `quota`, so
 * the server renders what `useAssistantModel` and the starters read.
 */
const loadAssistantModel = async (
	queryClient: QueryClient,
	organizationId: OrganizationId,
	{
		quota = false,
	}: {
		quota?: boolean;
	} = {},
) => {
	const { data: organization } = await queryClient.query(
		activeOrganizationQuery(organizationId),
	);
	if (!organization.assistantModelId) return;
	const { data: model } = await queryClient.query(
		orpc.model.find.queryOptions({
			input: {
				id: organization.assistantModelId,
			},
		}),
	);
	if (quota) {
		await queryClient.query(
			quotaStatusQuery({
				providerId: model.providerId,
				modelId: model.id,
			}),
		);
	}
};

export { assistantModelAvailability, loadAssistantModel, useAssistantModel };
