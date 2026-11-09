import type { BadgeItem } from "@/lib/labels/badge-item";
import { m } from "@/paraglide/messages";

export const modelStatusBadge = (isDeprecated: boolean): BadgeItem =>
	isDeprecated
		? {
				label: m.common_status_deprecated_label(),
				variant: "warning",
			}
		: {
				label: m.common_status_active_label(),
				variant: "success",
			};
