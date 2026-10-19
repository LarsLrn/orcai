import type { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

export const getProviderStatusLabel = (enabled: boolean) =>
	enabled ? m.common_status_enabled_label() : m.common_status_disabled_label();

export const getProviderStatusVariant = (
	enabled: boolean,
): React.ComponentProps<typeof Badge>["variant"] =>
	enabled ? "success" : "secondary";
