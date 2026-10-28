import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HistoryIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Leads to the chats of organisations the user left, once there are any. */
const ChatHistoryLink = ({ className }: { className?: string }) => {
	const { data: history } = useQuery(
		orpc.chat.history.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 1,
			},
		}),
	);

	if (!history?.rowCount) {
		return null;
	}

	return (
		<Link
			to="/history"
			className={buttonVariants({
				variant: "link",
				className,
			})}
		>
			<HistoryIcon />
			{m.chat_history_link({
				count: history.rowCount,
			})}
		</Link>
	);
};

export { ChatHistoryLink };
