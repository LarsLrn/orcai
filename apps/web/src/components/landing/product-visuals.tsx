import type { Screenshot } from "@/components/landing/content";
import { cn } from "@/lib/cn";

export const ProductScreenshot = ({
	screenshot,
	priority = false,
	className,
}: {
	screenshot: Screenshot;
	priority?: boolean;
	className?: string;
}) => {
	const imageProps = {
		width: screenshot.width,
		height: screenshot.height,
		// Lazy loading skips the variant the theme hides.
		loading: "lazy",
		fetchPriority: priority ? "high" : "auto",
		decoding: "async",
		className: "h-auto w-full",
	} as const;

	return (
		<div
			className={cn(
				"overflow-hidden rounded-2xl border border-landing-border bg-landing-surface shadow-landing-foreground/5 shadow-xl",
				className,
			)}
		>
			<img
				{...imageProps}
				src={screenshot.light}
				alt={screenshot.alt}
				className={cn(imageProps.className, "dark:hidden")}
			/>
			<img
				{...imageProps}
				src={screenshot.dark}
				alt={screenshot.alt}
				className={cn(imageProps.className, "hidden dark:block")}
			/>
		</div>
	);
};
