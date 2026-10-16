import "./tiptap.css";

import type { JSONContent } from "@tiptap/core";
import { getSchema, isNodeEmpty } from "@tiptap/core";
import { getEmbedUrlFromYoutubeUrl } from "@tiptap/extension-youtube";
import { Node } from "@tiptap/pm/model";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { useMemo } from "react";
import { m } from "@/paraglide/messages";
import { extensions, TiptapYoutube } from "./extensions";
import { renderMathToString } from "./extensions/math";

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
	const rendered = useMemo(() => {
		const doc = toDocument(content);

		return doc
			? renderToReactElement({
					content: doc,
					extensions,
					options: {
						nodeMapping: {
							math: ({ node }) => (
								<span
									data-type="math"
									dangerouslySetInnerHTML={{
										__html: renderMathToString(node.attrs.latex),
									}}
								/>
							),
							youtube: ({ node }) => (
								<div data-youtube-video="">
									<iframe
										title={m.editor_youtube_title()}
										className={TiptapYoutube.options.HTMLAttributes.class}
										src={
											getEmbedUrlFromYoutubeUrl({
												...TiptapYoutube.options,
												url: node.attrs.src,
												startAt: node.attrs.start || 0,
											}) ?? undefined
										}
										width={node.attrs.width}
										height={node.attrs.height}
										allowFullScreen={TiptapYoutube.options.allowFullscreen}
									/>
								</div>
							),
						},
					},
				})
			: null;
	}, [
		content,
	]);

	return (
		<article className="tiptap prose dark:prose-invert max-w-full focus:outline-none">
			{rendered}
		</article>
	);
};

export { ContentRenderer, isContentEmpty };
