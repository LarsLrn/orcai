import "./tiptap.css";

import type { JSONContent } from "@tiptap/core";
import { getSchema, isNodeEmpty } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { descriptionExtensions, extensions } from "./extensions";
import { renderMathToString } from "./extensions/math";
import { YOUTUBE_IFRAME_CLASS, youtubeEmbedUrl } from "./extensions/youtube";

type Extensions = typeof extensions | typeof descriptionExtensions;

const blockSchema = getSchema(extensions);
const descriptionSchema = getSchema(descriptionExtensions);

const toDocument = (content: unknown, from: Extensions = extensions) => {
	if (!content || typeof content !== "object" || Array.isArray(content)) {
		return null;
	}

	try {
		return Node.fromJSON(
			from === descriptionExtensions ? descriptionSchema : blockSchema,
			content as JSONContent,
		);
	} catch {
		return null;
	}
};

/** Whether stored editor content renders nothing, such as `{}` or an empty paragraph. */
const isContentEmpty = (content: unknown, from?: Extensions) => {
	const doc = toDocument(content, from);

	return !doc || isNodeEmpty(doc);
};

/** Renders stored editor content; content with nodes `extensions` lacks renders nothing. */
const ContentRenderer = ({
	content,
	extensions: rendererExtensions = extensions,
	className,
}: {
	content?: unknown;
	extensions?: Extensions;
	className?: string;
}) => {
	const rendered = useMemo(() => {
		const doc = toDocument(content, rendererExtensions);

		return doc
			? renderToReactElement({
					content: doc,
					extensions: rendererExtensions,
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
										className={YOUTUBE_IFRAME_CLASS}
										src={
											youtubeEmbedUrl(node.attrs.src, node.attrs.start) ??
											undefined
										}
										allowFullScreen
									/>
								</div>
							),
						},
					},
				})
			: null;
	}, [
		content,
		rendererExtensions,
	]);

	return (
		<article
			className={cn(
				"tiptap prose dark:prose-invert max-w-full focus:outline-none",
				className,
			)}
		>
			{rendered}
		</article>
	);
};

export { ContentRenderer, isContentEmpty };
