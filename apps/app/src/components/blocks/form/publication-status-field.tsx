import type { PublicationStatus } from "@orcai/schema";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const PublicationStatusField = ({
	value,
	onChange,
	description = "Control whether this resource is still in draft or ready to be used in published experiences.",
}: {
	value: PublicationStatus;
	onChange: (status: PublicationStatus) => void;
	description?: string;
}) => (
	<div className="space-y-2">
		<Label htmlFor="publication-status">Publication Status</Label>
		<Select
			value={value}
			onValueChange={(nextValue) => onChange(nextValue as PublicationStatus)}
		>
			<SelectTrigger id="publication-status">
				<SelectValue placeholder="Select status" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="draft">Draft</SelectItem>
				<SelectItem value="ready">Ready</SelectItem>
			</SelectContent>
		</Select>
		<p className="text-muted-foreground text-xs">{description}</p>
	</div>
);

export { PublicationStatusField };
