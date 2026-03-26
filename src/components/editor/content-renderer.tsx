import "./tiptap.css";

import type { JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/core";
import { render } from "katex";
import { useEffect, useMemo, useState } from "react";
import { extensions } from "./extensions";

const ContentRenderer = ({ content }: { content?: unknown }) => {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const html = useMemo(() => {
		if (!content || typeof content !== "object" || Array.isArray(content)) {
			return "";
		}

		try {
			return generateHTML(content as JSONContent, extensions);
		} catch {
			return "";
		}
	}, [
		content,
	]);

	useEffect(() => {
		if (!element) {
			return;
		}
		if (!html) {
			return;
		}

		element.querySelectorAll('[data-type="math"]').forEach((el) => {
			const latex = el.getAttribute("latex");
			if (!latex) {
				return;
			}
			render(latex, el as HTMLElement, {
				throwOnError: false,
			});
		});
	}, [
		element,
		html,
	]);

	return (
		<article
			ref={setElement}
			className="tiptap prose dark:prose-invert max-w-full focus:outline-none"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: <Required for rendering HTML content>
			dangerouslySetInnerHTML={{
				__html: html,
			}}
		/>
	);
};

export { ContentRenderer };
