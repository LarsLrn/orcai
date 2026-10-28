import type { ModelId, ProviderId } from "@orcai/core";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { orpc } from "@/lib/orpc/orpc";

/** The longest delay `setTimeout` keeps; a later reset is checked again then. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Lets the server open the next period before the status is read again. */
const RESET_GRACE_MS = 2_000;

/** The pool covering the user for a model, read again when its period resets; idle until both ids are known. */
const useQuotaStatus = ({
	providerId,
	modelId,
}: {
	providerId: ProviderId | null | undefined;
	modelId: ModelId | null | undefined;
}) => {
	const queryClient = useQueryClient();
	const options = orpc.quota.status.queryOptions({
		input:
			providerId && modelId
				? {
						providerId,
						modelId,
					}
				: skipToken,
	});
	const query = useQuery(options);
	const resetsAt = query.data?.data.pool?.periodEndsAt.getTime();
	const { dataUpdatedAt } = query;

	useEffect(() => {
		if (resetsAt === undefined || !providerId || !modelId) return;
		// A response that still saw the old period after its reset waits once more.
		const checkAt = Math.max(resetsAt, dataUpdatedAt) + RESET_GRACE_MS;
		const timeout = setTimeout(
			() => {
				void queryClient.invalidateQueries({
					queryKey: orpc.quota.status.queryKey({
						input: {
							providerId,
							modelId,
						},
					}),
					exact: true,
				});
			},
			Math.min(Math.max(checkAt - Date.now(), 0), MAX_TIMEOUT_MS),
		);
		return () => clearTimeout(timeout);
	}, [
		resetsAt,
		dataUpdatedAt,
		providerId,
		modelId,
		queryClient,
	]);

	return query;
};

export { useQuotaStatus };
