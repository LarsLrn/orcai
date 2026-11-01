import type { HomeOrganization, ResourceRef } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import {
	AccessManagerContent,
	InstalledAccessContent,
} from "@/components/access/access-manager-content";
import { toLinkedBlocks } from "@/components/access/block-edit-offer";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { getResourceTypeLabel } from "@/settings/display-config";

type AccessDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	resourceRef: ResourceRef;
	resourceName?: string;
	/** Set when the active organisation added the resource from the catalogue. */
	homeOrganization?: HomeOrganization | null;
};

const AccessDialog = ({
	open,
	onOpenChange,
	resourceRef,
	resourceName,
	homeOrganization,
}: AccessDialogProps) => {
	const resource = getResourceTypeLabel(resourceRef.type);
	const botEditor = useQuery(
		orpc.bot.findEditor.queryOptions({
			input:
				open && resourceRef.type === "bot" && !homeOrganization
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

				<DialogBody>
					{homeOrganization ? (
						<InstalledAccessContent
							resourceRef={resourceRef}
							from={homeOrganization}
						/>
					) : (
						<AccessManagerContent
							resourceRef={resourceRef}
							resourceName={resourceName}
							linkedBlocks={
								botEditor.data ? toLinkedBlocks(botEditor.data.data) : undefined
							}
						/>
					)}
				</DialogBody>

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
