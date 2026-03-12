import {
	AlertCircleIcon,
	GlobeIcon,
	Loader2Icon,
	PlusIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GrantList } from "@/components/access/grant-list";
import { PrincipalPicker } from "@/components/access/principal-picker";
import { VisibilityToggle } from "@/components/access/visibility-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useGrantResourceAccess,
	useResourceGrants,
	useResourceVisibility,
	useRevokeResourceAccess,
	useSetResourceVisibility,
} from "@/hooks/authz/use-resource-access";
import type {
	PrincipalType,
	ResourceGrantRole,
	ResourceGrantSource,
	ResourcePrincipal,
	ResourceRef,
} from "@/lib/orpc/schemas/resource";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	RESOURCE_GRANT_SOURCE,
} from "@/lib/orpc/schemas/resource";
import { RESOURCES, ROLES } from "@/settings/display-config";

const isDirectSource = (source: ResourceGrantSource) =>
	source === RESOURCE_GRANT_SOURCE.DIRECT_USER ||
	source === RESOURCE_GRANT_SOURCE.DIRECT_GROUP ||
	source === RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS;

type AccessManagerContentProps = {
	resourceRef: ResourceRef;
	resourceName?: string;
	enabled?: boolean;
};

const AccessManagerContent = ({
	resourceRef,
	resourceName,
	enabled = true,
}: AccessManagerContentProps) => {
	const [grantSearch, setGrantSearch] = useState("");
	const [principalSearch, setPrincipalSearch] = useState("");
	const [principalType, setPrincipalType] = useState<PrincipalType>("user");
	const [selectedPrincipalIds, setSelectedPrincipalIds] = useState<string[]>(
		[],
	);
	const [selectedPrincipalMap, setSelectedPrincipalMap] = useState<
		Record<string, ResourcePrincipal>
	>({});
	const [selectedRole, setSelectedRole] = useState<ResourceGrantRole>("viewer");
	const [projectionNotice, setProjectionNotice] = useState<string | null>(null);

	const grants = useResourceGrants(resourceRef, {
		enabled,
	});
	const visibility = useResourceVisibility(resourceRef, {
		enabled,
	});

	const grantAccess = useGrantResourceAccess(resourceRef);
	const revokeAccess = useRevokeResourceAccess(resourceRef);
	const setVisibility = useSetResourceVisibility(resourceRef);

	const isMutating =
		grantAccess.isPending || revokeAccess.isPending || setVisibility.isPending;
	const isRefreshing = grants.isFetching || visibility.isFetching;
	const isBusy = isMutating || isRefreshing;

	useEffect(() => {
		if (!enabled) {
			setGrantSearch("");
			setPrincipalSearch("");
			setPrincipalType("user");
			setSelectedPrincipalIds([]);
			setSelectedPrincipalMap({});
			setSelectedRole("viewer");
			setProjectionNotice(null);
		}
	}, [
		enabled,
	]);

	const directGrants = useMemo(
		() =>
			(grants.data?.data ?? []).filter((grant) => isDirectSource(grant.source)),
		[
			grants.data?.data,
		],
	);

	const selectedPrincipals = selectedPrincipalIds
		.map((id) => selectedPrincipalMap[id])
		.filter(
			(principal): principal is ResourcePrincipal => principal !== undefined,
		);

	const selectedHasAllMembers = selectedPrincipals.some(
		(principal) =>
			principal.type === "group" &&
			principal.kind === "system" &&
			principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY,
	);

	useEffect(() => {
		if (selectedHasAllMembers && selectedRole !== "viewer") {
			setSelectedRole("viewer");
		}
	}, [
		selectedHasAllMembers,
		selectedRole,
	]);

	const handleGrant = async () => {
		if (selectedPrincipals.length === 0) {
			return;
		}

		const results = await Promise.all(
			selectedPrincipals.map((principal) =>
				grantAccess.mutateAsync({
					resourceType: resourceRef.type,
					resourceId: resourceRef.id,
					principalType: principal.type,
					principalId: principal.id,
					role: selectedRole,
				}),
			),
		);

		const successfulPrincipalIds = results
			.map((result, index) =>
				result.status === "success" ? selectedPrincipals[index]?.id : undefined,
			)
			.filter((value): value is string => value !== undefined);

		if (successfulPrincipalIds.length > 0) {
			setSelectedPrincipalIds((current) =>
				current.filter((id) => !successfulPrincipalIds.includes(id)),
			);
		}

		const hasProjectionLag = results.some((result) => {
			if (result.status !== "success") {
				return false;
			}

			const meta = (
				result.data as {
					meta?: {
						zedToken?: string;
					};
				}
			).meta;
			return !meta?.zedToken;
		});

		if (hasProjectionLag) {
			setProjectionNotice(
				"Permissions are updating in the background. Changes may take a few seconds to appear.",
			);
		}
	};

	const currentVisibility = visibility.data?.data.visibility ?? "private";

	const excludedPrincipalIds = directGrants
		.filter((grant) => grant.principalType === principalType)
		.map((grant) => grant.principalId);

	return (
		<div className="space-y-6">
			{currentVisibility === "public" && (
				<Alert>
					<GlobeIcon className="h-4 w-4" />
					<AlertTitle>This resource is public</AlertTitle>
					<AlertDescription>
						Visible to authenticated users across all organizations.
					</AlertDescription>
				</Alert>
			)}

			{projectionNotice && (
				<Alert>
					<AlertCircleIcon className="h-4 w-4" />
					<AlertTitle>Permissions updating</AlertTitle>
					<AlertDescription>{projectionNotice}</AlertDescription>
				</Alert>
			)}

			<VisibilityToggle
				visibility={currentVisibility}
				disabled={isBusy}
				onChange={(nextVisibility) =>
					setVisibility.mutate({
						resourceType: resourceRef.type,
						resourceId: resourceRef.id,
						visibility: nextVisibility,
					})
				}
			/>

			<div className="rounded-lg border p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="font-medium text-sm">Add direct grants</p>
						<p className="text-muted-foreground text-xs">
							Grant direct access to principals in the same organization scope.
						</p>
					</div>
					{isBusy && (
						<Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
					)}
				</div>

				<Tabs
					value={principalType}
					onValueChange={(value) => {
						setPrincipalType(value as PrincipalType);
						setSelectedPrincipalIds([]);
						setSelectedPrincipalMap({});
						setPrincipalSearch("");
						setSelectedRole("viewer");
					}}
					className="mt-3"
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="user" disabled={isBusy}>
							People
						</TabsTrigger>
						<TabsTrigger value="group" disabled={isBusy}>
							Groups
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
					<PrincipalPicker
						resourceRef={resourceRef}
						principalType={principalType}
						query={principalSearch}
						onQueryChange={setPrincipalSearch}
						selectedPrincipalIds={selectedPrincipalIds}
						onToggle={(principal) => {
							setSelectedPrincipalMap((current) => ({
								...current,
								[principal.id]: principal,
							}));
							setSelectedPrincipalIds((current) =>
								current.includes(principal.id)
									? current.filter((id) => id !== principal.id)
									: [
											...current,
											principal.id,
										],
							);
						}}
						onClearSelection={() => setSelectedPrincipalIds([])}
						excludedPrincipalIds={excludedPrincipalIds}
						disabled={isBusy}
					/>

					<div className="space-y-2">
						<OptionPicker
							options={ROLES}
							onChange={(role) => setSelectedRole(role)}
							value={selectedRole}
							disabled={isBusy || selectedHasAllMembers}
						/>
						<Button
							className="w-full"
							disabled={selectedPrincipals.length === 0 || isBusy}
							onClick={handleGrant}
						>
							<PlusIcon className="mr-2 h-4 w-4" />
							Add {selectedPrincipals.length > 1 ? "Principals" : "Principal"}
						</Button>
					</div>
				</div>
			</div>

			<GrantList
				grants={directGrants}
				search={grantSearch}
				onSearchChange={setGrantSearch}
				disabled={isBusy}
				onChangeRole={(grant, role) =>
					grantAccess.mutate({
						resourceType: resourceRef.type,
						resourceId: resourceRef.id,
						principalType: grant.principalType,
						principalId: grant.principalId,
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

			<div className="rounded-lg border border-dashed p-3 text-muted-foreground text-xs">
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
