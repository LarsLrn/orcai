import type { Editor } from "@tiptap/core";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LinkPopover, useLinkState } from "../../link-popover";

export const LinkSelector = ({ editor }: { editor: Editor }) => {
	const { canLink, isActive } = useLinkState(editor);

	return (
		<LinkPopover editor={editor}>
			<PopoverTrigger
				disabled={!canLink}
				render={
					<Button
						variant="ghost"
						size="icon"
						aria-label={m.editor_control_link()}
						className="shrink-0 rounded-none"
					>
						<LinkIcon
							className={cn("size-4", isActive && "text-primary")}
							strokeWidth={2.5}
						/>
					</Button>
				}
			/>
		</LinkPopover>
	);
};
