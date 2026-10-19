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

const fenceOpen =
	/^(?:[ \t]*>[ \t]?)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}(?=[^`]*$)|~{3,})/;
const fenceClose = /^(?:[ \t]*>[ \t]?)*[ \t]*(`{3,}|~{3,})[ \t]*$/;
const containerPrefix =
	/^((?:[ \t]*>[ \t]?)*)([ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?)/;
const blankLine = /\n[ \t]*\n/g;
const backticks = /`+/g;

const paragraphEnd = (text: string, from: number) => {
	blankLine.lastIndex = from;
	return blankLine.exec(text)?.index ?? text.length;
};

// An unclosed span is completed while streaming, so it stays code to the paragraph end.
const codeSpanEnd = (text: string, from: number, run: number) => {
	const end = paragraphEnd(text, from);
	backticks.lastIndex = from;
	for (
		let match = backticks.exec(text);
		match && match.index < end;
		match = backticks.exec(text)
	) {
		if (match[0].length === run) return match.index + run;
	}
	return end;
};

// Index of the backslash in `\<closer>`, skipping escaped pairs such as `\\`.
const findCloser = (text: string, from: number, closer: string) => {
	const end = paragraphEnd(text, from);
	for (let index = from; index < end - 1; index++) {
		if (text[index] !== "\\") continue;
		if (text[index + 1] === closer) return index;
		index++;
	}
	return -1;
};

const rewriteDisplay = (text: string, start: number, close: number) => {
	const lineStart = text.lastIndexOf("\n", start - 1) + 1;
	const [container = "", quote = "", marker = ""] =
		containerPrefix.exec(text.slice(lineStart, start)) ?? [];
	const prefix = quote + " ".repeat(marker.length);
	const opensLine = lineStart + container.length === start;
	const rest = text.slice(close + 2);
	const closesLine = /^[ \t]*(?:\n|$)/.test(rest);
	// A body on its own lines already carries the container prefix.
	const inner = text
		.slice(start + 2, close)
		.replace(/^[ \t]*\n/, "")
		.replace(/\n[ \t>]*$/, "")
		.trimEnd();
	const body =
		prefix && inner.startsWith(prefix) ? inner : prefix + inner.trim();
	return {
		before: opensLine ? "" : "\n",
		block: `${opensLine ? "" : prefix}$$\n${body}\n${prefix}$$${closesLine ? "" : `\n${prefix}`}`,
		skip: closesLine ? 0 : rest.length - rest.trimStart().length,
	};
};

const rewriteProse = (text: string) => {
	let output = "";
	let index = 0;
	while (index < text.length) {
		const char = text[index];
		if (char === "`") {
			let run = 1;
			while (text[index + run] === "`") run++;
			const next = codeSpanEnd(text, index + run, run);
			output += text.slice(index, next);
			index = next;
		} else if (char === "$" && text[index + 1] === "$") {
			const close = text.indexOf("$$", index + 2);
			const next = close === -1 ? text.length : close + 2;
			output += text.slice(index, next);
			index = next;
		} else if (char === "\\") {
			const opener = text[index + 1];
			const closer = opener === "(" ? ")" : opener === "[" ? "]" : undefined;
			const close = closer ? findCloser(text, index + 2, closer) : -1;
			if (close === -1 || !text.slice(index + 2, close).trim()) {
				output += text.slice(index, index + 2);
				index += 2;
			} else if (opener === "(") {
				output += `$$${text.slice(index + 2, close)}$$`;
				index = close + 2;
			} else {
				const { before, block, skip } = rewriteDisplay(text, index, close);
				output = before ? output.replace(/[ \t]*$/, before) : output;
				output += block;
				index = close + 2 + skip;
			}
		} else {
			output += char;
			index++;
		}
	}
	return output;
};

// remark-math only knows dollar delimiters, so LaTeX `\(…\)` and `\[…\]` outside code become `$$` math.
export const normaliseMathDelimiters = (markdown: string) => {
	if (!markdown.includes("\\(") && !markdown.includes("\\[")) return markdown;
	const lines = markdown.split("\n");
	const output: string[] = [];
	let prose: string[] = [];
	let fence: string | undefined;
	const flush = () => {
		if (prose.length > 0) output.push(rewriteProse(prose.join("\n")));
		prose = [];
	};
	for (const line of lines) {
		if (fence) {
			output.push(line);
			const closing = fenceClose.exec(line)?.[1];
			if (closing?.[0] === fence[0] && closing.length >= fence.length) {
				fence = undefined;
			}
		} else {
			fence = fenceOpen.exec(line)?.[1];
			if (fence) {
				flush();
				output.push(line);
			} else {
				prose.push(line);
			}
		}
	}
	flush();
	return output.join("\n");
};

// Streamdown puts markers inside and inlines item paragraphs, which runs loose items together.
export const StreamdownContent = ({
	className,
	children,
	...props
}: StreamdownContentProps) => (
	<Streamdown
		className={cn(
			"[&_li>p:not(:first-child)]:mt-2 [&_li>p]:block [&_ol]:list-outside [&_ol]:pl-6 [&_ul]:list-outside [&_ul]:pl-6",
			"[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
			className,
		)}
		plugins={plugins}
		{...props}
	>
		{typeof children === "string"
			? normaliseMathDelimiters(children)
			: children}
	</Streamdown>
);
