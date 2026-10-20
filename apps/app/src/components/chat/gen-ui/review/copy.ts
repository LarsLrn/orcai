import { createElement } from "react";
import { toast } from "sonner";
import { stripEmphasis } from "@/components/chat/gen-ui/review/findings";
import { m } from "@/paraglide/messages";

const renderHtml = async (markdown: string): Promise<Blob> => {
	const [{ renderToStaticMarkup }, { default: Markdown }] = await Promise.all([
		import("react-dom/server"),
		import("react-markdown"),
	]);
	return new Blob(
		[
			renderToStaticMarkup(
				createElement(Markdown, {
					children: markdown,
				}),
			),
		],
		{
			type: "text/html",
		},
	);
};

/**
 * Copies markdown as rendered HTML, so emphasis survives a paste into a word
 * processor, and as plain text without emphasis markers.
 */
export const copyRevision = (markdown: string) =>
	toast.promise(
		async () =>
			navigator.clipboard.write([
				new ClipboardItem({
					"text/html": renderHtml(markdown),
					"text/plain": new Blob(
						[
							stripEmphasis(markdown),
						],
						{
							type: "text/plain",
						},
					),
				}),
			]),
		{
			loading: m.chat_message_copy_toast_loading(),
			success: m.chat_message_copy_toast_success(),
			error: () => ({
				message: m.chat_message_copy_toast_error(),
			}),
		},
	);
