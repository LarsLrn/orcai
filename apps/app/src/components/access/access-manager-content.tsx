import type {
	HomeOrganization,
	PrincipalType,
	ResourceGrantRole,
	ResourcePrincipal,
	ResourcePrincipalIdentity,
	ResourceRef,
} from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import {
	AlertCircleIcon,
	GlobeIcon,
	Loader2Icon,
	PackageCheckIcon,
	PlusIcon,
} from "lucide-react";
import { useState } from "react";
import {
	BlockEditOffer,
	type LinkedBlock,
} from "@/components/access/block-edit-offer";
import { GrantList } from "@/components/access/grant-list";
import { InheritedAccessSummary } from "@/components/access/inherited-access-summary";
import { PrincipalPicker } from "@/components/access/principal-picker";
import { VisibilityToggle } from "@/components/access/visibility-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useGrantBlockEdit,
	useGrantResourceAccess,
	useInheritedAccess,
	useResourceGrants,
	useResourceVisibility,
	useRevokeResourceAccess,
	useSetResourceListing,
} from "@/hooks/authz/use-resource-access";
import { toggleSelection } from "@/lib/utils/array-utils";
import { m } from "@/paraglide/messages";
import {
	getResourceAccessHint,
	getResourceRoleOptions,
} from "@/settings/display-config";

const toPrincipalIdentity = (
	principal: ResourcePrincipal,
): ResourcePrincipalIdentity =>
	principal.type === "user"
		? {
				principalType: "user",
				principalId: principal.id,
			}
		: {
				principalType: "group",
				principalId: principal.id,
			};

const GroupsHint = () => (
	<Alert>
		<AlertCircleIcon className="h-4 w-4" />
		<AlertTitle>{m.access_manager_groups_hint_title()}</AlertTitle>
		<AlertDescription>
			{m.access_manager_groups_hint_description()}
		</AlertDescription>
	</Alert>
);

/**
 * Grants on the resource in the active organisation: who gets which role,
 * of `roles` when given, and the grants it holds. With one role, nobody
 * picks a role.
 */
const GrantManager = ({
	resourceRef,
	roles,
	linkedBlocks = [],
	busy = false,
}: {
	resourceRef: ResourceRef;
	roles?: readonly ResourceGrantRole[];
	linkedBlocks?: LinkedBlock[];
	/** Another change to the resource's access is running. */
	busy?: boolean;
}) => {
	const [grantSearch, setGrantSearch] = useState("");
	const [principalSearch, setPrincipalSearch] = useState("");
	const [principalType, setPrincipalType] = useState<PrincipalType>("group");
	const [selectedPrincipals, setSelectedPrincipals] = useState<
		ResourcePrincipal[]
	>([]);
	const [selectedRole, setSelectedRole] = useState<ResourceGrantRole>("viewer");
	const [grantsBlockEdit, setGrantsBlockEdit] = useState(true);

	const grants = useResourceGrants(resourceRef);
	const grantAccess = useGrantResourceAccess();
	const changeGrantRole = useGrantResourceAccess();
	const revokeAccess = useRevokeResourceAccess();
	const grantBlockEdit = useGrantBlockEdit();

	const isGranting = grantAccess.isPending || grantBlockEdit.isPending;
	const isMutating =
		busy || isGranting || changeGrantRole.isPending || revokeAccess.isPending;
	const roleOptions = getResourceRoleOptions().filter(
		(option) => !roles || roles.includes(option.value),
	);

	const selectedHasAllMembers = selectedPrincipals.some(
		(principal) =>
			principal.type === "group" &&
			principal.kind === "system" &&
			principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY,
	);

	const effectiveRole = selectedHasAllMembers ? "viewer" : selectedRole;
	const offersBlockEdit =
		linkedBlocks.length > 0 &&
		(effectiveRole === "editor" || effectiveRole === "manager");

	const handleGrant = async () => {
		if (selectedPrincipals.length === 0) {
			return;
		}

		const principals = selectedPrincipals.map(toPrincipalIdentity);
		const result = await grantAccess.mutateAsync({
			resourceType: resourceRef.type,
			resourceId: resourceRef.id,
			principals,
			role: effectiveRole,
		});

		if (result.status !== "success") {
			return;
		}

		if (offersBlockEdit && grantsBlockEdit) {
			await grantBlockEdit.mutateAsync({
				blocks: linkedBlocks.filter((block) => block.canManageAccess),
				principals,
			});
		}
		setSelectedPrincipals([]);
		setGrantsBlockEdit(true);
	};

	return (
		<>
			<div className="rounded-2xl border p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="font-medium text-sm">
							{m.access_manager_add_heading()}
						</p>
						<p className="text-muted-foreground text-xs">
							{m.access_manager_add_description()}
						</p>
					</div>
					{(isMutating || grants.isFetching) && (
						<Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
					)}
				</div>

				<Tabs
					value={principalType}
					onValueChange={(value) => {
						setPrincipalType(value as PrincipalType);
						setSelectedPrincipals([]);
						setPrincipalSearch("");
						setSelectedRole("viewer");
						setGrantsBlockEdit(true);
					}}
					className="mt-3"
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="group" disabled={isMutating}>
							{m.access_manager_tab_groups()}
						</TabsTrigger>
						<TabsTrigger value="user" disabled={isMutating}>
							{m.access_manager_tab_people()}
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
					<PrincipalPicker
						resourceRef={resourceRef}
						principalType={principalType}
						query={principalSearch}
						onQueryChange={setPrincipalSearch}
						selectedPrincipals={selectedPrincipals}
						onToggle={(principal) =>
							setSelectedPrincipals((current) =>
								toggleSelection(current, principal, (item) => item.id),
							)
						}
						onClearSelection={() => setSelectedPrincipals([])}
						disabled={isMutating}
					/>

					<div className="space-y-2">
						{roleOptions.length > 1 && (
							<OptionPicker
								options={roleOptions}
								onChange={(role) => setSelectedRole(role)}
								value={effectiveRole}
								disabled={isMutating || selectedHasAllMembers}
								className="w-32"
							/>
						)}
						<Button
							className="w-full"
							loading={isGranting}
							disabled={selectedPrincipals.length === 0 || isMutating}
							onClick={handleGrant}
						>
							<PlusIcon />
							{m.access_manager_grant_action()}
						</Button>
					</div>
				</div>

				{offersBlockEdit ? (
					<BlockEditOffer
						linkedBlocks={linkedBlocks}
						checked={grantsBlockEdit}
						onCheckedChange={setGrantsBlockEdit}
						disabled={isMutating}
					/>
				) : null}
			</div>

			<GrantList
				grants={grants.data?.data ?? []}
				search={grantSearch}
				onSearchChange={setGrantSearch}
				disabled={isMutating}
				onChangeRole={
					roleOptions.length > 1
						? (grant, role) =>
								changeGrantRole.mutate({
									resourceType: resourceRef.type,
									resourceId: resourceRef.id,
									principals: [
										toPrincipalIdentity(grant.principal),
									],
									role,
								})
						: undefined
				}
				onRevoke={(grant) =>
					revokeAccess.mutate({
						resourceType: resourceRef.type,
						resourceId: resourceRef.id,
						principalType: grant.principalType,
						principalId: grant.principalId,
					})
				}
			/>
		</>
	);
};

type AccessManagerContentProps = {
	resourceRef: ResourceRef;
	resourceName?: string;
	linkedBlocks?: LinkedBlock[];
};

/** Access to a resource in its home: listing, inherited access and grants of every role. */
const AccessManagerContent = ({
	resourceRef,
	resourceName,
	linkedBlocks = [],
}: AccessManagerContentProps) => {
	const inherited = useInheritedAccess(resourceRef);
	const visibility = useResourceVisibility(resourceRef);
	const listing = useSetResourceListing();
	const currentVisibility = visibility.data?.data.visibility ?? "private";

	return (
		<div className="space-y-6">
			{currentVisibility === "public" && (
				<Alert>
					<GlobeIcon className="h-4 w-4" />
					<AlertTitle>{m.access_manager_public_alert_title()}</AlertTitle>
					<AlertDescription>
						{m.access_manager_public_alert_description()}
					</AlertDescription>
				</Alert>
			)}

			{inherited.data && (
				<InheritedAccessSummary inherited={inherited.data.data} />
			)}

			{/* Assets are published through their repository; one listed earlier can still be unlisted. */}
			{resourceRef.type !== "asset" || currentVisibility === "public" ? (
				<VisibilityToggle
					visibility={currentVisibility}
					disabled={listing.isPending}
					onChange={(nextVisibility) =>
						void listing.setListing(resourceRef, nextVisibility)
					}
				/>
			) : null}

			<GroupsHint />

			<GrantManager
				resourceRef={resourceRef}
				linkedBlocks={linkedBlocks}
				busy={listing.isPending}
			/>

			<div className="rounded-2xl border border-dashed p-3 text-muted-foreground text-xs">
				{getResourceAccessHint(resourceRef.type)}
				{resourceName
					? ` ${m.access_manager_current_resource({
							name: resourceName,
						})}`
					: ""}
			</div>
		</div>
	);
};

const INSTALLED_ROLES = [
	"viewer",
] as const satisfies ResourceGrantRole[];

/**
 * Access to a resource the active organisation added from the catalogue:
 * its home edits it, so here it is shared for use only.
 */
const InstalledAccessContent = ({
	resourceRef,
	from,
}: {
	resourceRef: ResourceRef;
	from: HomeOrganization;
}) => (
	<div className="space-y-6">
		<Alert>
			<PackageCheckIcon className="h-4 w-4" />
			<AlertTitle>
				{m.access_manager_installed_alert_title({
					organisation: from.name,
				})}
			</AlertTitle>
			<AlertDescription>
				{m.access_manager_installed_alert_description()}
			</AlertDescription>
		</Alert>

		<GroupsHint />

		<GrantManager resourceRef={resourceRef} roles={INSTALLED_ROLES} />
	</div>
);

export { AccessManagerContent, InstalledAccessContent };
