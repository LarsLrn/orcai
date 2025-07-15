"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import supersub from "remark-supersub";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./code-block";

const components: Partial<Components> = {
	code: ({ node, className, children, ...props }) => {
		return (
			<CodeBlock node={node} className={className || ""} {...props}>
				{children}
			</CodeBlock>
		);
	},
	pre: ({ children }) => <>{children}</>,
	ol: ({ node, children, ...props }) => {
		return (
			<ol className="list-outside list-decimal marker:font-semibold" {...props}>
				{children}
			</ol>
		);
	},
	li: ({ node, children, ...props }) => {
		return (
			<li className="[&>p]:m-0" {...props}>
				{children}
			</li>
		);
	},
	ul: ({ node, children, ...props }) => {
		return (
			<ul className="marker:text-foreground" {...props}>
				{children}
			</ul>
		);
	},
	strong: ({ node, children, ...props }) => {
		return (
			<span className="font-semibold" {...props}>
				{children}
			</span>
		);
	},
	a: ({ node, children, ...props }) => {
		// Check if children is a string and matches cite: pattern
		const childText =
			Array.isArray(children) && typeof children[0] === "string"
				? children[0]
				: typeof children === "string"
					? children
					: null;
		if (childText?.startsWith("cite:")) {
			const docId = childText.replace("cite:", "");
			return (
				<Badge
					variant="secondary"
					className="mr-1 inline-flex size-4 items-center justify-center overflow-clip rounded-full font-bold text-xs"
				>
					{docId}
				</Badge>
			);
		}

		return (
			<a
				className="text-blue-500 hover:underline"
				target="_blank"
				rel="noreferrer"
				{...props}
			>
				{children}
			</a>
		);
	},
	h1: ({ node, children, ...props }) => {
		return (
			<h1 className="mt-6 mb-2 font-semibold text-3xl" {...props}>
				{children}
			</h1>
		);
	},
	h2: ({ node, children, ...props }) => {
		return (
			<h2 className="mt-6 mb-2 font-semibold text-2xl" {...props}>
				{children}
			</h2>
		);
	},
	h3: ({ node, children, ...props }) => {
		return (
			<h3 className="mt-6 mb-2 font-semibold text-xl" {...props}>
				{children}
			</h3>
		);
	},
	h4: ({ node, children, ...props }) => {
		return (
			<h4 className="mt-6 mb-2 font-semibold text-lg" {...props}>
				{children}
			</h4>
		);
	},
	h5: ({ node, children, ...props }) => {
		return (
			<h5 className="mt-6 mb-2 font-semibold text-base" {...props}>
				{children}
			</h5>
		);
	},
	h6: ({ node, children, ...props }) => {
		return (
			<h6 className="mt-6 mb-2 font-semibold text-sm" {...props}>
				{children}
			</h6>
		);
	},
};

const remarkPlugins = [remarkGfm, supersub, remarkMath];
const rehypePlugins = [rehypeKatex];

const NonMemoizedMarkdown = ({
	children,
	className,
}: {
	children: string;
	className?: string;
}) => {
	return (
		<div
			className={cn(
				"prose dark:prose-invert w-full max-w-full whitespace-normal",
				// Override prose styling for inline code to remove backticks
				"[&_code]:before:content-none [&_code]:after:content-none",
				className,
			)}
		>
			<ReactMarkdown
				remarkPlugins={remarkPlugins}
				rehypePlugins={rehypePlugins}
				components={components}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
};

const Markdown = memo(
	NonMemoizedMarkdown,
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

export { Markdown };
