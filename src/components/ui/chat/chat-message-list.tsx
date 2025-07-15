import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/components/ui/chat/hooks/useAutoScroll";
import { cn } from "@/lib/utils";

interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
	smooth?: boolean;
	debounceTime?: number;
}

const ChatMessageList = ({
	className,
	children,
	smooth = false,
	debounceTime = 300,
	...props
}: ChatMessageListProps) => {
	const { scrollRef, isAtBottom, scrollToBottom, disableAutoScroll } =
		useAutoScroll({
			smooth,
			content: children,
		});

	// Add debounced version of isAtBottom
	const [debouncedIsAtBottom, setDebouncedIsAtBottom] = useState(isAtBottom);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedIsAtBottom(isAtBottom);
		}, debounceTime);

		return () => clearTimeout(timer);
	}, [isAtBottom, debounceTime]);

	return (
		<div
			className={cn(
				"relative flex h-full w-full flex-col overflow-y-auto",
				className,
			)}
		>
			<div
				className="flex h-full w-full flex-col overflow-y-auto p-4 pb-0"
				ref={scrollRef}
				onWheel={disableAutoScroll}
				onTouchMove={disableAutoScroll}
				{...props}
			>
				<div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
					{children}
				</div>
			</div>

			{!debouncedIsAtBottom && (
				<>
					<div className="pointer-events-none absolute right-0 bottom-0 left-0 h-24 bg-gradient-to-t from-background to-transparent" />
					<Button
						onClick={scrollToBottom}
						size="icon"
						variant="outline"
						className="-translate-x-1/2 absolute bottom-4 left-1/2 z-10 inline-flex h-10 w-10 transform rounded-full shadow-md"
						aria-label="Scroll to bottom"
					>
						<ArrowDown className="h-4 w-4" />
					</Button>
				</>
			)}
		</div>
	);
};

export { ChatMessageList };
