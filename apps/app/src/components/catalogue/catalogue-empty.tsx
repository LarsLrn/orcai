import { CompassIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { m } from "@/paraglide/messages";

/** Nothing listed yet: in the whole catalogue, or of one kind. */
export const CatalogueEmpty = ({
	title = m.catalogue_empty_title(),
}: {
	title?: string;
}) => (
	<Placeholder
		className="border"
		Icon={CompassIcon}
		title={title}
		description={m.catalogue_empty_description()}
	/>
);
