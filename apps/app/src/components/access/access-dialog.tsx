import type { ResourceRef } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { AccessManagerContent } from "@/components/access/access-manager-content";
import { toLinkedBlocks } from "@/components/access/block-edit-offer";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { getResourceTypeLabel } from "@/settings/display-config";

type AccessDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	resourceRef: ResourceRef;
	resourceName?: string;
};

const AccessDialog = ({
	open,
	onOpenChange,
	resourceRef,
	resourceName,
}: AccessDialogProps) => {
	const resource = getResourceTypeLabel(resourceRef.type);
	const botEditor = useQuery(
		orpc.bot.findEditor.queryOptions({
			input:
				open && resourceRef.type === "bot"
					? {
							id: resourceRef.id,
						}
					: skipToken,
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>{m.access_dialog_title()}</DialogTitle>
					<DialogDescription>
						{resourceName
							? m.access_dialog_description_named({
									resource,
									name: resourceName,
								})
							: m.access_dialog_description({
									resource,
								})}
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="flex min-h-0 flex-1 flex-col *:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:min-h-0">
					<AccessManagerContent
						resourceRef={resourceRef}
						resourceName={resourceName}
						linkedBlocks={
							botEditor.data ? toLinkedBlocks(botEditor.data.data) : undefined
						}
					/>
				</ScrollArea>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{m.common_close_button()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export { AccessDialog };
