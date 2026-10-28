import type { ChatReadOnlyReason } from "@orcai/schema";
import { LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** Stands in for the composer of a chat the user can read but not continue. */
const ChatReadOnlyNotice = ({
	reason,
	organizationName,
	className,
}: {
	reason: ChatReadOnlyReason;
	organizationName: string;
	className?: string;
}) => (
	<div
		id="chat-read-only-notice"
		role="status"
		className={cn(
			"flex items-start gap-2.5 rounded-2xl bg-muted/60 px-4 py-3 text-sm",
			className,
		)}
	>
		<LockIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
		<p className="text-foreground">
			{reason === "bot-deleted"
				? m.chat_read_only_bot_deleted_title()
				: reason === "bot-unavailable"
					? m.chat_read_only_bot_unavailable_title()
					: reason === "not-member"
						? m.chat_read_only_not_member_title({
								organisation: organizationName,
							})
						: m.chat_read_only_other_organisation_title({
								organisation: organizationName,
							})}{" "}
			<span className="text-muted-foreground">
				{reason === "other-organization"
					? m.chat_read_only_other_organisation_description()
					: reason === "bot-unavailable"
						? m.chat_read_only_bot_unavailable_description()
						: m.chat_read_only_export_description()}
			</span>
		</p>
	</div>
);

export { ChatReadOnlyNotice };
