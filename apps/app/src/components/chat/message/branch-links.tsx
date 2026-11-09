import type { ChatBranchLink, ChatLink } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { GitBranchIcon } from "lucide-react";
import { useDisplayTime } from "@/hooks/use-display-time";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const BranchMark = ({ className }: { className?: string }) => (
	<GitBranchIcon
		role="img"
		aria-label={m.chat_branch_label()}
		className={cn("text-muted-foreground size-3.5 shrink-0", className)}
	/>
);

const BranchedFrom = ({ parentChat }: { parentChat: ChatLink }) => (
	<Link
		to="/app/chat/$chatId"
		params={{
			chatId: parentChat.id,
		}}
		className="text-muted-foreground hover:text-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 py-1 text-xs underline-offset-4 hover:underline"
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
const labelBranches = (
	branches: ChatBranchLink[],
	formatTimestamp: (value: Date) => string,
) => {
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
					? formatTimestamp(branch.createdAt)
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
}) => {
	const displayTime = useDisplayTime();

	return (
		<div
			className={cn(
				"text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 text-xs",
				className,
			)}
		>
			<span className="inline-flex items-center gap-1.5">
				<GitBranchIcon aria-hidden="true" className="size-3.5 shrink-0" />
				{m.chat_message_branches_label()}
			</span>
			{labelBranches(branches, displayTime.timestamp).map(
				({ branch, title, createdAt }) => (
					<Link
						key={branch.id}
						to="/app/chat/$chatId"
						params={{
							chatId: branch.id,
						}}
						title={createdAt ? `${title} (${createdAt})` : title}
						className="text-foreground flex max-w-full min-w-0 py-1 underline-offset-4 hover:underline sm:max-w-80"
					>
						<span className="truncate">{title}</span>
						{createdAt && (
							<span className="shrink-0 whitespace-pre"> ({createdAt})</span>
						)}
					</Link>
				),
			)}
		</div>
	);
};

export { BranchedFrom, BranchMark, MessageBranches };
