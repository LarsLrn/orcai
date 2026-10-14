import type { PublicationStatus } from "@orcai/schema";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
		<Select
			value={value}
			onValueChange={(nextValue) => onChange(nextValue as PublicationStatus)}
		>
			<SelectTrigger id="publication-status">
				<SelectValue placeholder={m.blocks_publication_status_placeholder()} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="draft">
					{m.blocks_publication_status_draft_option()}
				</SelectItem>
				<SelectItem value="ready">
					{m.blocks_publication_status_ready_option()}
				</SelectItem>
			</SelectContent>
		</Select>
		<p className="text-muted-foreground text-xs">
			{description ?? m.blocks_publication_status_description()}
		</p>
	</div>
);

export { PublicationStatusField };
