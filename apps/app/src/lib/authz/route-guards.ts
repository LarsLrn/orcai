import type {
	CapabilityEntityType,
	CapabilityFor,
	OrganizationCapability,
} from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const ensureOrganizationCapability = async ({
	queryClient,
	permission,
	redirectTo,
}: {
	queryClient: QueryClient;
	permission: OrganizationCapability;
	redirectTo?: string;
}) => {
	const result = await queryClient.ensureQueryData(
		orpc.authorization.organizationCapabilities.queryOptions({
			input: {
				permissions: [
					permission,
				],
			},
		}),
	);

	if (result.data.capabilities[permission]) {
		return;
	}

	if (redirectTo) {
		throw redirect({
			to: redirectTo,
		});
	}

	throw notFound();
};

export const ensureEntityCapability = async <
	Entity extends CapabilityEntityType,
>({
	queryClient,
	entityType,
	entityId,
	permission,
	redirectTo,
}: {
	queryClient: QueryClient;
	entityType: Entity;
	entityId: string;
	permission: CapabilityFor<Entity>;
	redirectTo?: string;
}) => {
	const result = await queryClient.ensureQueryData(
		orpc.authorization.check.queryOptions({
			input: {
				entityType,
				entityId,
				permission,
			},
		}),
	);

	if (result.data.allowed) {
		return;
	}

	if (redirectTo) {
		throw redirect({
			to: redirectTo,
		});
	}

	throw notFound();
};
