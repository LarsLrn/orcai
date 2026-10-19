import type { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

export const getModelStatusLabel = (isDeprecated: boolean) =>
	isDeprecated
		? m.common_status_deprecated_label()
		: m.common_status_active_label();

export const getModelStatusVariant = (
	isDeprecated: boolean,
): React.ComponentProps<typeof Badge>["variant"] =>
	isDeprecated ? "warning" : "success";
