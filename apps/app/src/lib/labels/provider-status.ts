import type { BadgeItem } from "@/lib/labels/badge-item";
import { m } from "@/paraglide/messages";

export const providerStatusBadge = (enabled: boolean): BadgeItem =>
	enabled
		? {
				label: m.common_status_enabled_label(),
				variant: "success",
			}
		: {
				label: m.common_status_disabled_label(),
				variant: "secondary",
			};
