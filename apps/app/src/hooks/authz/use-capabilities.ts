import type {
	CapabilityEntityType,
	CapabilityFor,
	EntityCapabilities,
	OrganizationCapability,
} from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
	capabilitySets,
	emptyCapabilities,
	hasCapability,
} from "@/lib/authz/capabilities";

export { filterByCapabilities } from "@/lib/authz/capability-filter";

import { orpc } from "@/lib/orpc/orpc";

type CapabilityRequirement<Entity extends CapabilityEntityType> = {
	entityType: Entity;
	entityId: string | undefined;
	permission: CapabilityFor<Entity>;
};

export const useOrganizationCapabilities = (
	permissions?: readonly OrganizationCapability[],
) =>
	useQuery(
		orpc.authorization.organizationCapabilities.queryOptions({
			input: {
				permissions: permissions
					? [
							...permissions,
						]
					: undefined,
			},
		}),
	);

export const useCapabilities = <Entity extends CapabilityEntityType>(
	requirement: CapabilityRequirement<Entity> | undefined,
) =>
	useQuery(
		orpc.authorization.check.queryOptions({
			input:
				requirement?.entityId && requirement.permission
					? {
							entityType: requirement.entityType,
							entityId: requirement.entityId,
							permission: requirement.permission,
						}
					: skipToken,
		}),
	);

export const useResourceCapabilities = <Entity extends CapabilityEntityType>(
	entityType: Entity,
	entityId: string | undefined,
	permissions?: readonly CapabilityFor<Entity>[],
) =>
	useQuery(
		orpc.authorization.checkMany.queryOptions({
			input: entityId
				? {
						entityType,
						entityIds: [
							entityId,
						],
						permissions: [
							...(permissions ?? capabilitySets[entityType]),
						],
					}
				: skipToken,
		}),
	);

export const getResourceCapabilities = <Entity extends CapabilityEntityType>(
	entityType: Entity,
	entityId: string,
	data:
		| {
				data?: {
					entities?: Record<string, Record<string, boolean>>;
				};
		  }
		| undefined,
) =>
	(data?.data?.entities?.[entityId] ??
		emptyCapabilities(entityType)) as EntityCapabilities<Entity>;

type CapabilityGateProps<Entity extends CapabilityEntityType> = {
	capabilities: Partial<Record<CapabilityFor<Entity>, boolean>> | undefined;
	permission: CapabilityFor<Entity>;
	children: ReactNode;
};

export const CapabilityGate = <Entity extends CapabilityEntityType>({
	capabilities,
	permission,
	children,
}: CapabilityGateProps<Entity>) =>
	hasCapability(capabilities, permission) ? children : null;
