import "./tiptap.css";

import { renderToString } from "katex";
import { useEffect, useState } from "react";

const ContentRenderer = ({ html }: { html?: string }) => {
	const [element, setElement] = useState<HTMLElement | null>(null);

	useEffect(() => {
		if (!element) {
			return;
		}

		element.querySelectorAll('[data-type="math"]').forEach((el) => {
			const latex = el.getAttribute("latex");
			if (!latex) {
				return;
			}
			el.innerHTML = renderToString(latex, {
				throwOnError: false,
			});
		});
	}, [
		element,
	]);

	return (
		<article
			ref={setElement}
			className="tiptap prose dark:prose-invert max-w-full focus:outline-none"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: <Required for rendering HTML content>
			dangerouslySetInnerHTML={{
				__html: html ?? "",
			}}
		/>
	);
};

export { ContentRenderer };
