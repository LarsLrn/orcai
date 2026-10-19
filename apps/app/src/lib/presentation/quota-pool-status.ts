import type { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

export const getQuotaPoolStatusLabel = (isActive: boolean) =>
	isActive ? m.common_status_active_label() : m.common_status_inactive_label();

export const getQuotaPoolStatusVariant = (
	isActive: boolean,
): React.ComponentProps<typeof Badge>["variant"] =>
	isActive ? "success" : "secondary";
