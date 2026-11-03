import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Trash2, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { m } from "@/paraglide/messages";
import { outsideFormula } from "./controls";

/** Any allowed address, to ask whether the selection can take a link. */
export const LINK_PROBE = "https://example.com";

const hostHref = (host: string) => {
	if (!host.includes(".") || /\s/.test(host)) {
		return null;
	}
	try {
		return new URL(`https://${host}`).toString();
	} catch {
		return null;
	}
};

/** The address a typed link stands for: relative links stay, bare hosts get https, bare emails mailto. */
const linkHref = (typed: string) => {
	const text = typed.trim();
	// Browsers read a backslash as a slash, so `/\host` would leave the site.
	if (text.includes("\\")) {
		return null;
	}
	if (/^(mailto:|tel:)\S+$/.test(text)) {
		return text;
	}
	if (/^https?:\/\/\S+$/.test(text)) {
		return URL.canParse(text) ? text : null;
	}
	if (text.startsWith("//")) {
		return hostHref(text.slice(2));
	}
	if (/^(\/|#|\?|\.\.?\/)\S*$/.test(text)) {
		return text;
	}
	if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(text)) {
		return `mailto:${text}`;
	}
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
		return null;
	}
	return hostHref(text);
};

export const useLinkState = (editor: Editor) =>
	useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			canLink:
				outsideFormula(current) &&
				current.can().setLink({
					href: LINK_PROBE,
				}),
			isActive: current.isActive("link"),
			href: current.getAttributes("link").href as string | undefined,
		}),
	});

/** Sets, changes or removes the link on the selection; `children` holds the trigger. */
export const LinkPopover = ({
	editor,
	children,
}: {
	editor: Editor;
	children: React.ReactNode;
}) => {
	const { href } = useLinkState(editor);
	const inputId = useId();

	return (
		<Popover>
			{children}
			<PopoverContent className="relative w-72 px-3 py-2.5">
				<PopoverPrimitive.Close
					aria-label={m.common_close_button()}
					className="absolute top-3 right-3"
				>
					<X className="h-4 w-4" />
				</PopoverPrimitive.Close>
				<form
					key={href}
					onSubmit={(event) => {
						event.preventDefault();
						const typed = new FormData(event.currentTarget).get("href");
						const next = linkHref(String(typed ?? ""));
						if (next) {
							editor
								.chain()
								.focus()
								.extendMarkRange("link")
								.setLink({
									href: next,
								})
								.run();
						}
					}}
				>
					<Label htmlFor={inputId}>{m.editor_control_link()}</Label>
					<p className="text-sm">{m.editor_link_description()}</p>
					<div className="mt-3 flex flex-col items-end justify-end gap-3">
						<Input
							id={inputId}
							name="href"
							defaultValue={href}
							className="w-full"
							placeholder="https://example.com"
						/>
						<div className="flex items-center gap-3">
							{href && (
								<Button
									type="button"
									size="sm"
									className="h-8"
									variant="ghost"
									onClick={() => editor.chain().focus().unsetLink().run()}
								>
									<Trash2 />
									{m.common_remove_button()}
								</Button>
							)}
							<Button type="submit" size="sm" className="h-8">
								{href
									? m.editor_link_update_button()
									: m.common_confirm_button()}
							</Button>
						</div>
					</div>
				</form>
			</PopoverContent>
		</Popover>
	);
};
