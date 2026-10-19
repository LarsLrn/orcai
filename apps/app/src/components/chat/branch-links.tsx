import type { ChatBranchLink, ChatLink } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { GitBranchIcon } from "lucide-react";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const BranchMark = ({ className }: { className?: string }) => (
	<GitBranchIcon
		role="img"
		aria-label={m.chat_branch_label()}
		className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
	/>
);

const BranchedFrom = ({ parentChat }: { parentChat: ChatLink }) => (
	<Link
		to="/app/chat/$chatId"
		params={{
			chatId: parentChat.id,
		}}
		className="inline-flex min-w-0 max-w-full items-center gap-1.5 py-1 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
	>
		<GitBranchIcon aria-hidden="true" className="size-3.5 shrink-0" />
		<span className="truncate">
			{m.chat_branched_from_link({
				title: parentChat.title ?? m.chat_title_placeholder(),
			})}
		</span>
	</Link>
);

/** Branch titles repeat the parent's often, so equal ones carry their creation time. */
const labelBranches = (branches: ChatBranchLink[]) => {
	const titleOf = (branch: ChatBranchLink) =>
		branch.title ?? m.chat_title_placeholder();
	const counts = new Map<string, number>();
	for (const branch of branches) {
		const title = titleOf(branch);
		counts.set(title, (counts.get(title) ?? 0) + 1);
	}

	return branches.map((branch) => {
		const title = titleOf(branch);
		return {
			branch,
			title,
			createdAt:
				(counts.get(title) ?? 0) > 1 && branch.createdAt
					? formatDisplayTimestamp(branch.createdAt)
					: undefined,
		};
	});
};

const MessageBranches = ({
	branches,
	className,
}: {
	branches: ChatBranchLink[];
	className?: string;
}) => (
	<div
		className={cn(
			"flex min-w-0 flex-wrap items-center gap-x-3 text-muted-foreground text-xs",
			className,
		)}
	>
		<span className="inline-flex items-center gap-1.5">
			<GitBranchIcon aria-hidden="true" className="size-3.5 shrink-0" />
			{m.chat_message_branches_label()}
		</span>
		{labelBranches(branches).map(({ branch, title, createdAt }) => (
			<Link
				key={branch.id}
				to="/app/chat/$chatId"
				params={{
					chatId: branch.id,
				}}
				title={createdAt ? `${title} (${createdAt})` : title}
				className="flex min-w-0 max-w-full py-1 text-foreground underline-offset-4 hover:underline sm:max-w-80"
			>
				<span className="truncate">{title}</span>
				{createdAt && (
					<span className="shrink-0 whitespace-pre"> ({createdAt})</span>
				)}
			</Link>
		))}
	</div>
);

export { BranchedFrom, BranchMark, MessageBranches };
