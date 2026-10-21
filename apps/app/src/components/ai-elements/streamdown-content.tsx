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
const quotePrefix = /^(?: {0,3}>[ \t]?)+/;
const listMarker = /^([ \t]*(?:[-*+]|\d{1,9}[.)]))([ \t]+)\S/;
const blockBoundary =
	/^(?:#{1,6}(?:[ \t]|$)|([-*_])(?:[ \t]*\1){2,}[ \t]*$|=+[ \t]*$|`{3,}|~{3,})/;
// Columns `text` spans when it starts at column `start`, with tabs advancing to the next multiple of four.
const widthOf = (text: string, start = 0) => {
	let column = start;
	for (const char of text) column += char === "\t" ? 4 - (column % 4) : 1;
	return column - start;
};
const indentOf = (text: string, start = 0) =>
	widthOf(/^[ \t]*/.exec(text)?.[0] ?? "", start);
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
	let afterBlank = true;
	// Content indents of the open list items, outermost first.
	const lists: number[] = [];
	let indentedCode = false;
	let quoteDepth = 0;
	const flush = () => {
		if (prose.length > 0) output.push(rewriteProse(prose.join("\n")));
		prose = [];
	};
	for (const line of lines) {
		const quote = quotePrefix.exec(line)?.[0] ?? "";
		// Block structure is read inside the quotes; a change of quote depth starts a new container.
		const body = line.slice(quote.length);
		const blank = body.trim() === "";
		if (fence) {
			output.push(line);
			const closing = fenceClose.exec(line)?.[1];
			if (closing?.[0] === fence[0] && closing.length >= fence.length) {
				fence = undefined;
				afterBlank = true;
			}
			continue;
		}
		const depth = quote.split(">").length - 1;
		if (depth !== quoteDepth) {
			quoteDepth = depth;
			lists.length = 0;
			indentedCode = false;
			afterBlank = true;
		}
		const origin = widthOf(quote);
		const lineIndent = indentOf(body, origin);
		const relativeIndent = lineIndent - (lists.at(-1) ?? 0);
		const boundary = relativeIndent < 4 && blockBoundary.test(body.trimStart());
		if (!blank && (afterBlank || boundary)) {
			while ((lists.at(-1) ?? 0) > lineIndent) lists.pop();
		}
		const codeIndent = (lists.at(-1) ?? 0) + 4;
		if (indentedCode && (blank || lineIndent >= codeIndent)) {
			output.push(line);
			afterBlank = blank;
			continue;
		}
		indentedCode = false;
		if (!blank && afterBlank && lineIndent >= codeIndent) {
			flush();
			output.push(line);
			indentedCode = true;
			continue;
		}
		const marker = blank ? null : listMarker.exec(body);
		if (marker && lineIndent < codeIndent && !boundary) {
			while ((lists.at(-1) ?? 0) > lineIndent) lists.pop();
			const markerEnd = widthOf(marker[1], origin);
			const gap = widthOf(marker[1] + marker[2], origin) - markerEnd;
			lists.push(gap > 4 ? markerEnd + 1 : markerEnd + gap);
		}
		afterBlank = blank || boundary;
		fence = lineIndent < codeIndent ? fenceOpen.exec(line)?.[1] : undefined;
		if (fence) {
			flush();
			output.push(line);
		} else {
			prose.push(line);
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
