import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";

export type StreamdownContentProps = ComponentProps<typeof Streamdown>;

const plugins = {
	cjk,
	code,
	math,
	mermaid,
};

// Streamdown puts markers inside and inlines item paragraphs, which runs loose items together.
export const StreamdownContent = ({
	className,
	...props
}: StreamdownContentProps) => (
	<Streamdown
		className={cn(
			"[&_li>p:not(:first-child)]:mt-2 [&_li>p]:block [&_ol]:list-outside [&_ol]:pl-6 [&_ul]:list-outside [&_ul]:pl-6",
			className,
		)}
		plugins={plugins}
		{...props}
	/>
);
