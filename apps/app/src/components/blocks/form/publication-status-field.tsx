import type { PublicationStatus } from "@orcai/schema";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Label } from "@/components/ui/label";
import { getPublicationStatusOptions } from "@/lib/presentation/publication-status";
import { m } from "@/paraglide/messages";

const PublicationStatusField = ({
	value,
	onChange,
	description,
}: {
	value: PublicationStatus;
	onChange: (status: PublicationStatus) => void;
	description?: string;
}) => (
	<div className="space-y-2">
		<Label htmlFor="publication-status">
			{m.blocks_publication_status_label()}
		</Label>
		<OptionPicker
			id="publication-status"
			options={getPublicationStatusOptions()}
			value={value}
			onChange={onChange}
			placeholder={m.blocks_publication_status_placeholder()}
		/>
		<p className="text-muted-foreground text-xs">
			{description ?? m.blocks_publication_status_description()}
		</p>
	</div>
);

export { PublicationStatusField };
