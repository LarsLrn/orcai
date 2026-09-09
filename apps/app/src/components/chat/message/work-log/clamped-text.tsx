import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Plain text clamped to three lines, with a toggle once it overflows. */
export const ClampedText = ({
	children,
	className,
}: {
	children: string;
	className?: string;
}) => {
	const ref = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);

	useLayoutEffect(() => {
		const element = ref.current;

		if (!element || expanded) {
			return;
		}

		const measure = () =>
			setOverflows(element.scrollHeight > element.clientHeight + 1);
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		measure();

		return () => observer.disconnect();
	}, [
		expanded,
	]);

	return (
		<div className="min-w-0">
			<p
				ref={ref}
				className={cn(
					"wrap-anywhere whitespace-pre-wrap text-sm leading-relaxed",
					!expanded && "line-clamp-3",
					className,
				)}
			>
				{children}
			</p>
			{(overflows || expanded) && (
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
					className="mt-1 text-muted-foreground text-xs transition-colors duration-150 hover:text-foreground"
				>
					{expanded ? "Show less" : "Show more"}
				</button>
			)}
		</div>
	);
};
