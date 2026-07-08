import type { CapabilityEntityType, CapabilityFor } from "@orcai/schema";
import { hasCapability } from "@/lib/authz/capabilities";

export const filterByCapabilities = <
	TItem,
	Entity extends CapabilityEntityType,
>(
	items: readonly TItem[],
	capabilities: Partial<Record<CapabilityFor<Entity>, boolean>> | undefined,
	getPermission: (item: TItem) => CapabilityFor<Entity> | undefined,
) =>
	items.filter((item) => {
		const permission = getPermission(item);
		return !permission || hasCapability(capabilities, permission);
	});
