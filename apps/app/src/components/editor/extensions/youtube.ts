import { nodePasteRule } from "@tiptap/core";
import { Youtube } from "@tiptap/extension-youtube";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const VIDEO_ID = /^[\w-]{11}$/;

const videoId = (url: URL) => {
	const host = url.hostname.replace(/^(www|m|music)\./, "");
	const [first, second] = url.pathname.split("/").filter(Boolean);

	if (host === "youtu.be") {
		return first;
	}
	if (host === "youtube.com") {
		if (first === "watch") {
			return url.searchParams.get("v");
		}
		if (
			first &&
			[
				"embed",
				"shorts",
				"live",
				"v",
			].includes(first)
		) {
			return second;
		}
	}
	if (host === "youtube-nocookie.com" && first === "embed") {
		return second;
	}
	return null;
};

/** The privacy-enhanced embed address for a YouTube video link, or null when it names no video. */
export const youtubeEmbedUrl = (input: unknown, start?: unknown) => {
	const trimmed = typeof input === "string" ? input.trim() : "";
	if (!trimmed) {
		return null;
	}

	let url: URL;
	try {
		url = new URL(
			/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`,
		);
	} catch {
		return null;
	}

	const id = videoId(url);
	if (!id || !VIDEO_ID.test(id)) {
		return null;
	}
	const embed = `https://www.youtube-nocookie.com/embed/${id}`;
	return Number.isInteger(start) && (start as number) > 0
		? `${embed}?start=${start}`
		: embed;
};

export const YOUTUBE_IFRAME_CLASS = cn(
	"aspect-video h-auto w-full border border-muted",
);

/** YouTube embeds stored and shown only as `youtube-nocookie.com` addresses. */
export const TiptapYoutube = Youtube.extend({
	addCommands() {
		return {
			setYoutubeVideo:
				(options) =>
				({ chain }) => {
					const src = youtubeEmbedUrl(options.src);
					return src
						? chain()
								.insertContent({
									type: this.name,
									attrs: {
										src,
									},
								})
								// Left selected, the video would be replaced by the next insert.
								.command(({ tr, dispatch }) => {
									if (dispatch && tr.selection instanceof NodeSelection) {
										const after = tr.selection.to;
										if (!tr.doc.resolve(after).nodeAfter?.isTextblock) {
											tr.insert(
												after,
												tr.doc.type.schema.nodes.paragraph.create(),
											);
										}
										tr.setSelection(TextSelection.create(tr.doc, after + 1));
									}
									return true;
								})
								.run()
						: false;
				},
		};
	},

	addPasteRules() {
		return [
			nodePasteRule({
				find: (text) => {
					const src = /^\S+$/.test(text) ? youtubeEmbedUrl(text) : null;
					return src
						? [
								{
									index: 0,
									text,
									data: {
										src,
									},
								},
							]
						: [];
				},
				type: this.type,
				getAttributes: (match) => ({
					src: match.data?.src,
				}),
			}),
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			{
				"data-youtube-video": "",
			},
			[
				"iframe",
				{
					title: m.editor_youtube_title(),
					class: YOUTUBE_IFRAME_CLASS,
					src: youtubeEmbedUrl(HTMLAttributes.src, HTMLAttributes.start),
					allowfullscreen: "true",
				},
			],
		];
	},
});
