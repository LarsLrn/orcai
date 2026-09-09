import { getInitial } from "@orcai/core";
import type { GroupMemberRow } from "@orcai/schema";
import { Trash2Icon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MemberRow = ({
	member,
	canRemove,
	disabled,
	onRemove,
}: {
	member: GroupMemberRow;
	canRemove?: boolean;
	disabled?: boolean;
	onRemove: () => void;
}) => (
	<div className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
		<div className="flex min-w-0 items-center gap-3">
			<Avatar size="sm">
				<AvatarImage src={member.user.image ?? undefined} />
				<AvatarFallback>{getInitial(member.user.name)}</AvatarFallback>
			</Avatar>
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<p className="truncate font-medium text-sm">{member.user.name}</p>
					<Badge variant="outline">
						{member.source === "implicit" ? "Implicit" : "Explicit"}
					</Badge>
				</div>
				{member.user.email && (
					<p className="truncate text-muted-foreground text-xs">
						{member.user.email}
					</p>
				)}
			</div>
		</div>

		{canRemove && member.source === "explicit" && (
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onRemove}
					disabled={disabled}
					className="text-destructive"
				>
					<Trash2Icon className="h-4 w-4" />
					<span className="sr-only">Remove member</span>
				</Button>
			</div>
		)}
	</div>
);

export { MemberRow };
