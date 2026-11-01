import type { OrganizationId, UserId } from "@orcai/core";
import type { ContentReceiver, OwnedContent } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	type MembershipScope,
	ownedContentQuery,
	receiverSourceOf,
} from "@/components/ownership/membership-scope";
import { ReceiverPicker } from "@/components/ownership/receiver-picker";
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
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldTitle,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/errors/describe-error";
import { formatList } from "@/lib/presentation/format-list";
import { m } from "@/paraglide/messages";

export type ChosenReceiver = {
	organizationId: OrganizationId;
	userId: UserId;
};

/** "2 bots and 1 block": the kinds someone owns, leaving out the empty ones. */
export const ownedContentLabel = (
	counts: Pick<OwnedContent, "bots" | "blocks" | "assets">,
) =>
	formatList(
		[
			counts.bots > 0 &&
				m.ownership_count_bots({
					count: counts.bots,
				}),
			counts.blocks > 0 &&
				m.ownership_count_blocks({
					count: counts.blocks,
				}),
			counts.assets > 0 &&
				m.ownership_count_assets({
					count: counts.assets,
				}),
		].filter((part) => part !== false),
	);

type HandOverConfirmProps = {
	title: ReactNode;
	description: ReactNode;
	confirmText: string;
	scope: MembershipScope;
	/** The users the change is about; they cannot receive. */
	userIds: UserId[];
	pending: boolean;
	onConfirm: (receivers: ChosenReceiver[]) => void;
};

const HandOverConfirmContent = ({
	title,
	description,
	confirmText,
	scope,
	userIds,
	pending,
	onConfirm,
}: HandOverConfirmProps) => {
	const owned = useQuery(ownedContentQuery(scope, userIds));
	// Deleting accounts reaches every organisation where they own something.
	const showOrganization =
		scope.kind === "instance" && scope.organizationId === undefined;
	const [chosen, setChosen] = useState<
		Partial<Record<OrganizationId, ContentReceiver | null>>
	>({});
	const rows = (owned.data?.data ?? []).map((row) => ({
		...row,
		receiver:
			chosen[row.organizationId] === undefined
				? row.defaultReceiver
				: (chosen[row.organizationId] ?? null),
	}));
	// A refetch may change the rows and their defaults, so confirm waits for it.
	const ready =
		owned.isSuccess &&
		!owned.isFetching &&
		rows.every((row) => row.receiver !== null);

	return (
		<>
			<AlertDialogHeader>
				<AlertDialogTitle>{title}</AlertDialogTitle>
				<AlertDialogDescription>{description}</AlertDialogDescription>
			</AlertDialogHeader>
			{owned.isPending ? (
				<Skeleton className="h-16 w-full" />
			) : owned.isError ? (
				<FieldError>{describeError(owned.error)}</FieldError>
			) : rows.length > 0 ? (
				<FieldGroup className="max-h-[60vh] overflow-y-auto">
					{rows.map((row) => (
						<Field key={row.organizationId}>
							<FieldTitle>
								{showOrganization
									? row.organizationName
									: m.ownership_receiver_label()}
							</FieldTitle>
							<FieldDescription>
								{m.ownership_receiver_description({
									content: ownedContentLabel(row),
								})}
							</FieldDescription>
							<ReceiverPicker
								source={receiverSourceOf(scope, row.organizationId)}
								value={row.receiver}
								onChange={(receiver) =>
									setChosen((previous) => ({
										...previous,
										[row.organizationId]: receiver,
									}))
								}
								excluded={userIds}
								disabled={pending}
							/>
						</Field>
					))}
				</FieldGroup>
			) : null}
			<AlertDialogFooter>
				<AlertDialogCancel disabled={pending}>
					{m.common_cancel_button()}
				</AlertDialogCancel>
				<AlertDialogAction
					variant="destructive"
					disabled={!ready}
					loading={pending}
					onClick={() =>
						onConfirm(
							rows.flatMap((row) =>
								row.receiver
									? [
											{
												organizationId: row.organizationId,
												userId: row.receiver.id,
											},
										]
									: [],
							),
						)
					}
				>
					{confirmText}
				</AlertDialogAction>
			</AlertDialogFooter>
		</>
	);
};

/**
 * Confirms a change that takes members or accounts away, and where they own
 * bots, blocks or assets, picks who receives them in each organisation. The
 * default receiver is preselected.
 */
export const HandOverConfirmDialog = ({
	open,
	onOpenChange,
	...props
}: HandOverConfirmProps & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => (
	<AlertDialog open={open} onOpenChange={onOpenChange}>
		<AlertDialogContent>
			<HandOverConfirmContent {...props} />
		</AlertDialogContent>
	</AlertDialog>
);
