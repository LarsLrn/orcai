import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ChatsList } from "./chats-list";

const ChatsPreview = () => {
	return (
		<div className="col-span-3 space-y-4">
			<div className="flex items-center justify-between">
				{/** TODO: Consider centralising ids used by next-step */}
				{/** biome-ignore lint/correctness/useUniqueElementIds: <Required for next-step to work properly> */}
				<h2 id="tour-history" className="font-semibold text-2xl tracking-tight">
					Your Recent Conversations
				</h2>
				<div className="flex items-center gap-2">
					<Link
						to={"/app/chat"}
						className={buttonVariants({ variant: "outline" })}
					>
						Show all
					</Link>
					<Link
						to="/app/chat/setup"
						className={buttonVariants({ size: "icon", variant: "outline" })}
					>
						<PlusIcon />
					</Link>
				</div>
			</div>
			<ChatsList limit={6} />
		</div>
	);
};

export { ChatsPreview };
