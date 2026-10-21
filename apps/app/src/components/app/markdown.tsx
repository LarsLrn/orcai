import {
	type HTMLAttributes,
	isValidElement,
	memo,
	type ReactNode,
} from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import supersub from "remark-supersub";
import {
	CodeBlock,
	CodeBlockContent,
	CodeBlockLine,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { cn } from "@/lib/utils";

const reactMarkdownPlugins = {
	rehypePlugins: [
		rehypeKatex,
	],
	remarkPlugins: [
		remarkGfm,
		supersub,
		remarkMath,
	],
};

const MarkdownCode = ({
	code,
	language,
}: {
	code: string;
	language: string;
}) => {
	const lines = useHighlightedCode(code, language);

	return (
		<CodeBlock>
			<CodeBlockContent>
				{lines.map((line, index) => (
					<CodeBlockLine key={index}>{line}</CodeBlockLine>
				))}
			</CodeBlockContent>
		</CodeBlock>
	);
};

const components: Options["components"] = {
	ol: ({ node, children, className, ...props }) => (
		<ol className={cn("ml-4 list-outside list-decimal", className)} {...props}>
			{children}
		</ol>
	),
	li: ({ node, children, className, ...props }) => (
		<li className={cn("py-1", className)} {...props}>
			{children}
		</li>
	),
	ul: ({ node, children, className, ...props }) => (
		<ul className={cn("ml-4 list-outside list-decimal", className)} {...props}>
			{children}
		</ul>
	),
	strong: ({ node, children, className, ...props }) => (
		<span className={cn("font-semibold", className)} {...props}>
			{children}
		</span>
	),
	a: ({ node, children, className, ...props }) => (
		<a
			className={cn("font-medium text-primary underline", className)}
			rel="noreferrer"
			target="_blank"
			{...props}
		>
			{children}
		</a>
	),
	h1: ({ node, children, className, ...props }) => (
		<h1
			className={cn("mt-6 mb-2 font-semibold text-3xl", className)}
			{...props}
		>
			{children}
		</h1>
	),
	h2: ({ node, children, className, ...props }) => (
		<h2
			className={cn("mt-6 mb-2 font-semibold text-2xl", className)}
			{...props}
		>
			{children}
		</h2>
	),
	h3: ({ node, children, className, ...props }) => (
		<h3 className={cn("mt-6 mb-2 font-semibold text-xl", className)} {...props}>
			{children}
		</h3>
	),
	h4: ({ node, children, className, ...props }) => (
		<h4 className={cn("mt-6 mb-2 font-semibold text-lg", className)} {...props}>
			{children}
		</h4>
	),
	h5: ({ node, children, className, ...props }) => (
		<h5
			className={cn("mt-6 mb-2 font-semibold text-base", className)}
			{...props}
		>
			{children}
		</h5>
	),
	h6: ({ node, children, className, ...props }) => (
		<h6 className={cn("mt-6 mb-2 font-semibold text-sm", className)} {...props}>
			{children}
		</h6>
	),
	code: ({ node, className, ...props }) => (
		<code
			className={cn(
				"rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
				className,
			)}
			{...props}
		/>
	),
	pre: ({ node, children, ...props }) => {
		if (
			!isValidElement<{
				className?: string;
				children?: ReactNode;
			}>(children)
		) {
			return <pre {...props}>{children}</pre>;
		}
		const { className, children: code } = children.props;

		return (
			<MarkdownCode
				code={String(code)}
				language={/language-(\w+)/.exec(className ?? "")?.[1] ?? "text"}
			/>
		);
	},
};

export const Markdown = memo(
	({
		children,
		className,
		...props
	}: {
		children: Options["children"];
		className?: string;
	} & HTMLAttributes<HTMLDivElement>) => {
		return (
			<div
				className={cn(
					"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
					className,
				)}
				{...props}
			>
				<ReactMarkdown {...reactMarkdownPlugins} components={components}>
					{children}
				</ReactMarkdown>
			</div>
		);
	},
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);
