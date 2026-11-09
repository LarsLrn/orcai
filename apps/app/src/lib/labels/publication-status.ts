import { type PublicationStatus, publicationStatusSchema } from "@orcai/schema";
import type { BadgeItem } from "@/lib/labels/badge-item";
import { m } from "@/paraglide/messages";

const publicationStatusLabels: Record<PublicationStatus, () => string> = {
	draft: m.common_status_draft_label,
	ready: m.common_status_ready_label,
};

export const getPublicationStatusOptions = () =>
	publicationStatusSchema.options.map((status) => ({
		value: status,
		label: publicationStatusLabels[status](),
	}));

export const publicationStatusBadge = (
	status: PublicationStatus,
): BadgeItem => ({
	label: publicationStatusLabels[status](),
	variant: status === "ready" ? "success" : "outline",
});
