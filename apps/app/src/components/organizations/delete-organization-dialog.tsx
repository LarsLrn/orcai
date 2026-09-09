import type { OrganizationId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteOrganizationsMutation } from "@/hooks/mutations/use-organization-mutations";
import { orpc } from "@/lib/orpc/orpc";

const IMPACT_LABELS = [
	{
		key: "members",
		singular: "member",
		plural: "members",
	},
	{
		key: "pendingInvitations",
		singular: "pending invitation",
		plural: "pending invitations",
	},
	{
		key: "groups",
		singular: "group",
		plural: "groups",
	},
	{
		key: "exclusiveResources",
		singular: "resource scoped only here",
		plural: "resources scoped only here",
	},
] as const;

/** Asks for the impact preview and the slug typed back before Delete is enabled. */
const DeleteOrganizationDialog = ({
	organizationId,
	open,
	onOpenChange,
	onDeleted,
}: {
	organizationId: OrganizationId;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDeleted?: () => void;
}) => {
	const [typedSlug, setTypedSlug] = useState("");
	const { mutateAsync: deleteOrganizations, isPending } =
		useDeleteOrganizationsMutation();

	const { data: impact, isPending: isImpactPending } = useQuery(
		orpc.organization.deletionImpact.queryOptions({
			input: {
				id: organizationId,
			},
			enabled: open,
		}),
	);

	useEffect(() => {
		if (open) {
			setTypedSlug("");
		}
	}, [
		open,
	]);

	const slug = impact?.data.slug;
	const canDelete = slug !== undefined && typedSlug.trim() === slug;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();

						if (!canDelete) {
							return;
						}

						const result = await deleteOrganizations({
							refs: [
								{
									id: organizationId,
								},
							],
						});

						if (result.status === "success") {
							onOpenChange(false);
							onDeleted?.();
						}
					}}
					className="space-y-4"
				>
					<DialogHeader>
						<DialogTitle>
							{impact
								? `Delete the ${impact.data.name} organisation?`
								: "Delete this organisation?"}
						</DialogTitle>
						<DialogDescription>
							Everything counted below goes with it, and deletion is permanent.
						</DialogDescription>
					</DialogHeader>
					{isImpactPending || !impact ? (
						<Skeleton className="h-24 w-full" />
					) : (
						<div className="space-y-3 text-sm">
							<ul className="list-inside list-disc space-y-1">
								{IMPACT_LABELS.map((label) => {
									const value = impact.data[label.key];

									return (
										<li key={label.key}>
											{value} {value === 1 ? label.singular : label.plural}
										</li>
									);
								})}
							</ul>
							<p className="text-muted-foreground">
								Members, invitations and groups go with the organisation.
								Resources scoped only here stay behind without an organisation.
							</p>
						</div>
					)}
					<div className="space-y-2">
						<Label htmlFor="delete-organization-slug">
							Type {slug ? <code>{slug}</code> : "the slug"} to confirm
						</Label>
						<Input
							id="delete-organization-slug"
							autoComplete="off"
							value={typedSlug}
							onChange={(event) => setTypedSlug(event.target.value)}
							disabled={slug === undefined}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="destructive"
							disabled={!canDelete || isPending}
						>
							{isPending ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export { DeleteOrganizationDialog };
