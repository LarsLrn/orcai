import { CompassIcon } from "lucide-react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { m } from "@/paraglide/messages";

/** Nothing listed yet: in the whole catalogue, or of one kind. */
export const CatalogueEmpty = ({
	title = m.catalogue_empty_title(),
}: {
	title?: string;
}) => (
	<Empty className="border border-dashed">
		<EmptyHeader>
			<EmptyMedia variant="icon">
				<CompassIcon />
			</EmptyMedia>
			<EmptyTitle>{title}</EmptyTitle>
			<EmptyDescription>{m.catalogue_empty_description()}</EmptyDescription>
		</EmptyHeader>
	</Empty>
);
