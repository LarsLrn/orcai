import { type PublicationStatus, publicationStatusSchema } from "@orcai/schema";
import type { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";

const publicationStatusLabels: Record<PublicationStatus, () => string> = {
	draft: m.common_status_draft_label,
	ready: m.common_status_ready_label,
};

export const getPublicationStatusLabel = (status: PublicationStatus) =>
	publicationStatusLabels[status]();

export const getPublicationStatusOptions = () =>
	publicationStatusSchema.options.map((status) => ({
		value: status,
		label: getPublicationStatusLabel(status),
	}));

export const getPublicationStatusVariant = (
	status: PublicationStatus,
): React.ComponentProps<typeof Badge>["variant"] =>
	status === "ready" ? "success" : "outline";
