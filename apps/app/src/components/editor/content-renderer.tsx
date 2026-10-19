import "./tiptap.css";

import type { JSONContent } from "@tiptap/core";
import { getHTMLFromFragment, getSchema, isNodeEmpty } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { render } from "katex";
import { useEffect, useMemo, useState } from "react";
import { extensions } from "./extensions";

const schema = getSchema(extensions);

const toDocument = (content: unknown) => {
	if (!content || typeof content !== "object" || Array.isArray(content)) {
		return null;
	}

	try {
		return Node.fromJSON(schema, content as JSONContent);
	} catch {
		return null;
	}
};

/** Whether stored editor content renders nothing, such as `{}` or an empty paragraph. */
const isContentEmpty = (content: unknown) => {
	const doc = toDocument(content);

	return !doc || isNodeEmpty(doc);
};

const ContentRenderer = ({ content }: { content?: unknown }) => {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const html = useMemo(() => {
		const doc = toDocument(content);

		return doc ? getHTMLFromFragment(doc.content, schema) : "";
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
			dangerouslySetInnerHTML={{
				__html: html,
			}}
		/>
	);
};

export { ContentRenderer, isContentEmpty };
