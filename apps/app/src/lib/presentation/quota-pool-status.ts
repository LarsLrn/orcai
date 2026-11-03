import type { BadgeItem } from "@/lib/presentation/badge-item";
import { m } from "@/paraglide/messages";

export const quotaPoolStatusBadge = (isActive: boolean): BadgeItem =>
	isActive
		? {
				label: m.common_status_active_label(),
				variant: "success",
			}
		: {
				label: m.common_status_inactive_label(),
				variant: "secondary",
			};
