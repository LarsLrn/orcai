import type { ModelId, ProviderId } from "@orcai/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

/** The pool covering the user for a model; idle until both ids are known. */
const useQuotaStatus = ({
	providerId,
	modelId,
}: {
	providerId: ProviderId | null | undefined;
	modelId: ModelId | null | undefined;
}) =>
	useQuery(
		orpc.quota.status.queryOptions({
			input:
				providerId && modelId
					? {
							providerId,
							modelId,
						}
					: skipToken,
		}),
	);

export { useQuotaStatus };
