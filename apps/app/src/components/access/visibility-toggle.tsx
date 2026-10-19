import type { ResourceVisibility } from "@orcai/schema";
import { GlobeIcon, LockIcon } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { m } from "@/paraglide/messages";

type VisibilityToggleProps = {
	visibility: ResourceVisibility;
	disabled?: boolean;
	onChange: (visibility: ResourceVisibility) => void;
};

const VisibilityToggle = ({
	visibility,
	disabled,
	onChange,
}: VisibilityToggleProps) => {
	const isPublic = visibility === "public";
	const id = useId();

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-4">
				<div>
					<Label htmlFor={id}>{m.access_visibility_label()}</Label>
					<p id={`${id}-description`} className="text-muted-foreground text-xs">
						{isPublic
							? m.access_visibility_description_public()
							: m.access_visibility_description_private()}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant={isPublic ? "default" : "outline"}>
						{isPublic ? (
							<GlobeIcon className="mr-1 h-3 w-3" />
						) : (
							<LockIcon className="mr-1 h-3 w-3" />
						)}
						{isPublic
							? m.access_visibility_badge_public()
							: m.access_visibility_badge_private()}
					</Badge>
					<Switch
						id={id}
						aria-describedby={`${id}-description`}
						checked={isPublic}
						disabled={disabled}
						onCheckedChange={(checked) =>
							onChange(checked ? "public" : "private")
						}
					/>
				</div>
			</div>
		</div>
	);
};

export { VisibilityToggle };
