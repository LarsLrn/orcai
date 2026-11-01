import { type ComponentProps, createContext, use, useState } from "react";
import type { LinkSafetyConfig, LinkSafetyModalProps } from "streamdown";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { m } from "@/paraglide/messages";
import { isTrustedLink, type TrustedLinks } from "./link-safety";

/** How links in the answers of a chat confirm before they open. */
export const LinkSafetyContext = createContext<LinkSafetyConfig | undefined>(
	undefined,
);

/** Asks before a link in an answer leaves OrcAI. */
const LinkConfirmDialog = ({
	isOpen,
	onClose,
	onConfirm,
	url,
}: LinkSafetyModalProps) => (
	<AlertDialog
		open={isOpen}
		onOpenChange={(open) => {
			if (!open) onClose();
		}}
	>
		<AlertDialogContent>
			<AlertDialogHeader>
				<AlertDialogTitle>{m.chat_link_confirm_title()}</AlertDialogTitle>
				<AlertDialogDescription>
					{m.chat_link_confirm_description()}
				</AlertDialogDescription>
			</AlertDialogHeader>
			<p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
				{url}
			</p>
			<AlertDialogFooter>
				<AlertDialogCancel>{m.common_cancel_button()}</AlertDialogCancel>
				<AlertDialogAction
					onClick={() => {
						onConfirm();
						onClose();
					}}
				>
					{m.chat_link_confirm_open_action()}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	</AlertDialog>
);

/** Every chat confirms links in answers with OrcAI's dialog; trusted links open in a new tab at once. */
export const chatLinkSafety = ({
	docsUrl,
	appPaths,
}: Omit<TrustedLinks, "appOrigin">): LinkSafetyConfig => ({
	enabled: true,
	onLinkCheck: (url) =>
		isTrustedLink(url, {
			appOrigin: window.location.origin,
			docsUrl,
			appPaths,
		}),
	renderModal: (props) => <LinkConfirmDialog {...props} />,
});

/**
 * A link out of an answer, such as a source, that asks first as links in the
 * answer's text do. A button, as Streamdown renders those, so no middle click
 * or link menu opens the page without asking.
 */
export const ConfirmedLink = ({
	href,
	...props
}: Omit<ComponentProps<"button">, "type" | "onClick"> & {
	href: string;
}) => {
	const linkSafety = use(LinkSafetyContext);
	const [isOpen, setIsOpen] = useState(false);
	const open = () => window.open(href, "_blank", "noreferrer");

	return (
		<>
			<button
				type="button"
				onClick={async () => {
					if (!linkSafety?.enabled || (await linkSafety.onLinkCheck?.(href))) {
						open();
						return;
					}
					setIsOpen(true);
				}}
				{...props}
			/>
			{linkSafety?.renderModal?.({
				isOpen,
				onClose: () => setIsOpen(false),
				onConfirm: open,
				url: href,
			})}
		</>
	);
};
