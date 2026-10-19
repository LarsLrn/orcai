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
import { m } from "@/paraglide/messages";

const IMPACT_ROWS = [
	{
		key: "members",
		describe: (count: number) =>
			m.orgs_delete_dialog_impact_members({
				count,
			}),
	},
	{
		key: "pendingInvitations",
		describe: (count: number) =>
			m.orgs_delete_dialog_impact_invitations({
				count,
			}),
	},
	{
		key: "groups",
		describe: (count: number) =>
			m.orgs_delete_dialog_impact_groups({
				count,
			}),
	},
	{
		key: "exclusiveResources",
		describe: (count: number) =>
			m.orgs_delete_dialog_impact_resources({
				count,
			}),
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
								? m.orgs_delete_dialog_title_named({
										name: impact.data.name,
									})
								: m.orgs_delete_dialog_title()}
						</DialogTitle>
						<DialogDescription>
							{m.orgs_delete_dialog_description()}
						</DialogDescription>
					</DialogHeader>
					{isImpactPending || !impact ? (
						<Skeleton className="h-24 w-full" />
					) : (
						<div className="space-y-3 text-sm">
							<ul className="list-inside list-disc space-y-1">
								{IMPACT_ROWS.map((row) => (
									<li key={row.key}>{row.describe(impact.data[row.key])}</li>
								))}
							</ul>
							<p className="text-muted-foreground">
								{m.orgs_delete_dialog_impact_note()}
							</p>
						</div>
					)}
					<div className="space-y-2">
						<Label htmlFor="delete-organization-slug">
							{slug ? (
								<>
									{m.orgs_delete_dialog_slug_label_before()} <code>{slug}</code>{" "}
									{m.orgs_delete_dialog_slug_label_after()}
								</>
							) : (
								m.orgs_delete_dialog_slug_label_unknown()
							)}
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
							{m.common_cancel_button()}
						</Button>
						<Button
							type="submit"
							variant="destructive"
							loading={isPending}
							disabled={!canDelete}
						>
							{m.common_delete_button()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export { DeleteOrganizationDialog };
