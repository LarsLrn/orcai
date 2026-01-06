import { type ComponentProps, memo } from "react";
import type { Components } from "react-markdown";
import { Streamdown } from "streamdown";
import { components } from "@/components/app/markdown";
import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

const componentsWithoutCode = Object.fromEntries(
	Object.entries(components ?? {}).filter(([key]) => key !== "code"),
) as Components;

export const Response = memo(
	({ className, ...props }: ResponseProps) => (
		<Streamdown
			components={componentsWithoutCode}
			className={cn(
				"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
