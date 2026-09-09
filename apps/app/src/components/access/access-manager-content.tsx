import type {
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
	PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { GrantList } from "@/components/access/grant-list";
import { InheritedAccessSummary } from "@/components/access/inherited-access-summary";
import { PrincipalPicker } from "@/components/access/principal-picker";
import { VisibilityToggle } from "@/components/access/visibility-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useGrantResourceAccess,
	useInheritedAccess,
	useResourceGrants,
	useResourceVisibility,
	useRevokeResourceAccess,
	useSetResourceVisibility,
} from "@/hooks/authz/use-resource-access";
import { RESOURCES, ROLES } from "@/settings/display-config";

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

type AccessManagerContentProps = {
	resourceRef: ResourceRef;
	resourceName?: string;
};

const AccessManagerContent = ({
	resourceRef,
	resourceName,
}: AccessManagerContentProps) => {
	const [grantSearch, setGrantSearch] = useState("");
	const [principalSearch, setPrincipalSearch] = useState("");
	const [principalType, setPrincipalType] = useState<PrincipalType>("group");
	const [selectedPrincipals, setSelectedPrincipals] = useState<
		ResourcePrincipal[]
	>([]);
	const [selectedRole, setSelectedRole] = useState<ResourceGrantRole>("viewer");

	const grants = useResourceGrants(resourceRef);
	const inherited = useInheritedAccess(resourceRef);
	const visibility = useResourceVisibility(resourceRef);

	const grantAccess = useGrantResourceAccess(resourceRef);
	const revokeAccess = useRevokeResourceAccess(resourceRef);
	const setVisibility = useSetResourceVisibility(resourceRef);

	const isMutating =
		grantAccess.isPending || revokeAccess.isPending || setVisibility.isPending;
	const isRefreshing = grants.isFetching || visibility.isFetching;

	const selectedHasAllMembers = selectedPrincipals.some(
		(principal) =>
			principal.type === "group" &&
			principal.kind === "system" &&
			principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY,
	);

	const effectiveRole = selectedHasAllMembers ? "viewer" : selectedRole;

	const handleGrant = async () => {
		if (selectedPrincipals.length === 0) {
			return;
		}

		const result = await grantAccess.mutateAsync({
			resourceType: resourceRef.type,
			resourceId: resourceRef.id,
			principals: selectedPrincipals.map(toPrincipalIdentity),
			role: effectiveRole,
		});

		if (result.status === "success") {
			setSelectedPrincipals([]);
		}
	};

	const currentVisibility = visibility.data?.data.visibility ?? "private";

	return (
		<div className="space-y-6">
			{currentVisibility === "public" && (
				<Alert>
					<GlobeIcon className="h-4 w-4" />
					<AlertTitle>This resource is public</AlertTitle>
					<AlertDescription>
						Every user of this instance can find and use it.
					</AlertDescription>
				</Alert>
			)}

			{inherited.data && (
				<InheritedAccessSummary inherited={inherited.data.data} />
			)}

			<VisibilityToggle
				visibility={currentVisibility}
				disabled={isMutating}
				onChange={(nextVisibility) =>
					setVisibility.mutate({
						resourceType: resourceRef.type,
						resourceId: resourceRef.id,
						visibility: nextVisibility,
					})
				}
			/>

			<Alert>
				<AlertCircleIcon className="h-4 w-4" />
				<AlertTitle>Groups are usually the right place to start</AlertTitle>
				<AlertDescription>
					Use groups for classes, cohorts, or teams whenever possible. Direct
					grants are best for exceptions and individual collaborators.
				</AlertDescription>
			</Alert>

			<div className="rounded-2xl border p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="font-medium text-sm">Add people and groups</p>
						<p className="text-muted-foreground text-xs">
							Give someone in this organisation access to this resource.
						</p>
					</div>
					{(isMutating || isRefreshing) && (
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
					}}
					className="mt-3"
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="group" disabled={isMutating}>
							Groups
						</TabsTrigger>
						<TabsTrigger value="user" disabled={isMutating}>
							People
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
					<PrincipalPicker
						resourceRef={resourceRef}
						principalType={principalType}
						query={principalSearch}
						onQueryChange={setPrincipalSearch}
						selectedPrincipals={selectedPrincipals}
						onToggle={(principal) =>
							setSelectedPrincipals((current) =>
								current.some((selected) => selected.id === principal.id)
									? current.filter((selected) => selected.id !== principal.id)
									: [
											...current,
											principal,
										],
							)
						}
						onClearSelection={() => setSelectedPrincipals([])}
						disabled={isMutating}
					/>

					<div className="space-y-2">
						<OptionPicker
							options={ROLES}
							onChange={(role) => setSelectedRole(role)}
							value={effectiveRole}
							disabled={isMutating || selectedHasAllMembers}
						/>
						<Button
							className="w-full"
							disabled={selectedPrincipals.length === 0 || isMutating}
							onClick={handleGrant}
						>
							<PlusIcon />
							Grant access
						</Button>
					</div>
				</div>
			</div>

			<GrantList
				grants={grants.data?.data ?? []}
				search={grantSearch}
				onSearchChange={setGrantSearch}
				disabled={isMutating}
				onChangeRole={(grant, role) =>
					grantAccess.mutate({
						resourceType: resourceRef.type,
						resourceId: resourceRef.id,
						principals: [
							toPrincipalIdentity(grant.principal),
						],
						role,
					})
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

			<div className="rounded-2xl border border-dashed p-3 text-muted-foreground text-xs">
				{
					RESOURCES.find((resource) => resource.value === resourceRef.type)
						?.accessHint
				}
				{resourceName ? ` Current resource: ${resourceName}.` : ""}
			</div>
		</div>
	);
};

export { AccessManagerContent };
