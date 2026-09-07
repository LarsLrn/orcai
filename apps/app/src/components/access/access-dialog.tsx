import type { ResourceRef } from "@orcai/schema";
import { AccessManagerContent } from "@/components/access/access-manager-content";
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
import { RESOURCES } from "@/settings/display-config";

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
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>Manage Access</DialogTitle>
					<DialogDescription>
						Configure visibility, groups, and direct grants for this{" "}
						{RESOURCES.find((r) => r.value === resourceRef.type)?.label}
						{resourceName ? `: ${resourceName}` : ""}.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="flex min-h-0 flex-1 flex-col [&>[data-slot=scroll-area-viewport]]:h-auto [&>[data-slot=scroll-area-viewport]]:min-h-0">
					<AccessManagerContent
						resourceRef={resourceRef}
						resourceName={resourceName}
						enabled={open}
					/>
				</ScrollArea>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export { AccessDialog };
