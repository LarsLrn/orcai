import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

interface CodeBlockProps {
	node: any;
	className: string;
	children: any;
}

const CodeBlock = ({ node, className, children, ...props }: CodeBlockProps) => {
	const [copied, setCopied] = useState(false);
	const [, copy] = useCopyToClipboard();
	const { theme } = useTheme();

	const match = /language-(\w+)/.exec(className || "");
	const language = match ? match[1] : "";
	const codeContent = String(children).replace(/\n$/, "");
	const isInline = !match;

	const handleCopy = async () => {
		try {
			await copy(codeContent);
			setCopied(true);
			toast.success("Code copied to clipboard!");
			setTimeout(() => setCopied(false), 2000);
		} catch (_error) {
			toast.error("Failed to copy code");
		}
	};

	if (isInline) {
		return (
			<code
				className="rounded-md bg-zinc-200 px-1.5 py-0.5 font-normal dark:bg-zinc-700"
				style={{
					fontFamily:
						"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
				}}
				{...props}
			>
				{codeContent}
			</code>
		);
	}

	return (
		<div className="not-prose my-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
			<div className="flex items-center justify-between bg-secondary/10 px-4 py-2 dark:bg-zinc-800">
				<span className="font-medium text-sm text-zinc-600 dark:text-zinc-400">
					{language || "text"}
				</span>
				<button
					onClick={handleCopy}
					className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-primary/10 dark:text-zinc-400 dark:hover:bg-zinc-700"
					type="button"
				>
					{copied ? (
						<>
							<Check className="h-3 w-3" />
							Copied
						</>
					) : (
						<>
							<Copy className="h-3 w-3" />
							Copy
						</>
					)}
				</button>
			</div>

			<div className="overflow-x-auto bg-transparent">
				<SyntaxHighlighter
					language={language}
					style={theme === "dark" ? oneDark : oneLight}
					customStyle={{
						margin: 0,
						padding: "1rem",
						fontSize: "0.875rem",
						lineHeight: "1.5",
					}}
					codeTagProps={{
						style: {
							fontFamily:
								"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
						},
					}}
					{...props}
				>
					{codeContent}
				</SyntaxHighlighter>
			</div>
		</div>
	);
};

export { CodeBlock };
