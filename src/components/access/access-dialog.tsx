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
import type { ResourceRef } from "@/lib/orpc/schemas/resource";
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
			<DialogContent className="max-h-[92vh] sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>Manage Access</DialogTitle>
					<DialogDescription>
						Configure visibility, groups, and direct grants for this{" "}
						{RESOURCES.find((r) => r.value === resourceRef.type)?.label}
						{resourceName ? `: ${resourceName}` : ""}.
					</DialogDescription>
				</DialogHeader>

				<AccessManagerContent
					resourceRef={resourceRef}
					resourceName={resourceName}
					enabled={open}
				/>

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
