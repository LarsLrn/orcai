import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { BuildingIcon } from "lucide-react";
import { Suspense, useState } from "react";
import {
	invitationsPageInput,
	OrganizationInvitationsList,
} from "@/components/organizations/invitations/organization-invitations-list";
import { OrganizationCard } from "@/components/organizations/organization-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetActiveOrganizationMutation } from "@/hooks/mutations/use-user-mutations";
import { authClient } from "@/lib/auth/auth-client";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { orpc } from "@/lib/orpc/orpc";

const PAGE_SIZE = 12;

const organizationsInput = (params: { search: string; pageCount: number }) => ({
	filters: params.search
		? {
				search: params.search,
			}
		: undefined,
	pageIndex: 0,
	pageSize: PAGE_SIZE * params.pageCount,
});

export const Route = createFileRoute("/_pathlessLayout/select-organization")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}
	},
	loader: async ({ context: { auth, queryClient } }) => {
		const organizations = await queryClient.query(
			orpc.organization.list.queryOptions({
				input: organizationsInput({
					search: "",
					pageCount: 1,
				}),
				staleTime: "static",
			}),
		);

		const invitations = await queryClient.query(
			orpc.organizationInvitation.list.queryOptions({
				input: invitationsPageInput({
					status: "pending",
				}),
				staleTime: 0,
			}),
		);
		const activeOrganizationId = auth.isAuthenticated
			? auth.session.activeOrganizationId
			: null;

		if (
			invitations.rowCount === 0 &&
			activeOrganizationId &&
			organizations.rowCount === 1 &&
			organizations.data[0]?.id === activeOrganizationId
		) {
			throw redirect({
				to: "/app",
				statusCode: 302,
			});
		}
	},
});

function PendingInvitationsSection({
	onAccepted,
}: {
	onAccepted: () => void | Promise<void>;
}) {
	const { data: invitations } = useSuspenseQuery(
		orpc.organizationInvitation.list.queryOptions({
			input: invitationsPageInput({
				status: "pending",
			}),
		}),
	);

	if (invitations.rowCount === 0) {
		return null;
	}

	return (
		<Card>
			<CardContent>
				<h2 className="font-semibold text-xl">Pending invitations</h2>
				<p className="mt-1 mb-4 text-muted-foreground text-sm">
					Accept an invitation to join an organisation.
				</p>
				<OrganizationInvitationsList mode="pending" onAccepted={onAccepted} />
			</CardContent>
		</Card>
	);
}

function RouteComponent() {
	const { refetch: refetchSession } = authClient.useSession();
	const navigate = useNavigate();
	const { auth } = Route.useRouteContext();

	const [search, setSearch] = useState("");
	const [pageCount, setPageCount] = useState(1);
	const trimmedSearch = search.trim();

	const { data: organizations, isFetching } = useQuery(
		orpc.organization.list.queryOptions({
			input: organizationsInput({
				search: trimmedSearch,
				pageCount,
			}),
		}),
	);
	const { mutate: setActiveOrganization } = useSetActiveOrganizationMutation();

	const rows = organizations?.data ?? [];
	const rowCount = organizations?.rowCount ?? 0;
	const hasMore = rows.length < rowCount;

	const handleInvitationAccepted = async () => {
		await refetchSession();
		await navigate({
			to: "/app",
		});
	};

	return (
		<div className="w-full max-w-3xl space-y-6">
			{auth.isAuthenticated && isInstanceAdminRole(auth.user.role) && (
				<Link
					to="/instance"
					className={buttonVariants({
						variant: "link",
					})}
				>
					Manage instance
				</Link>
			)}
			<div className="space-y-2 text-center">
				<h1 className="font-bold text-2xl tracking-tight">
					Select your organisation
				</h1>
				<p className="text-lg text-muted-foreground">
					You can switch to a different organisation at any time.
				</p>
			</div>

			{trimmedSearch || rowCount > 0 ? (
				<div className="flex justify-center">
					<DataTableSearch
						value={search}
						placeholder="Filter by name..."
						onChange={(value) => {
							setSearch(value);
							setPageCount(1);
						}}
					/>
				</div>
			) : null}

			{rows.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
					{rows.map((organization) => (
						<OrganizationCard
							key={organization.id}
							organization={organization}
							onSelect={() =>
								setActiveOrganization({
									organizationId: organization.id,
								})
							}
						/>
					))}
				</div>
			)}

			{hasMore ? (
				<div className="flex justify-center">
					<Button
						variant="outline"
						disabled={isFetching}
						onClick={() => setPageCount((count) => count + 1)}
					>
						Load more organisations
					</Button>
				</div>
			) : null}

			<Suspense fallback={<Skeleton className="h-28 w-full" />}>
				<PendingInvitationsSection onAccepted={handleInvitationAccepted} />
			</Suspense>

			{rowCount === 0 && trimmedSearch ? (
				<p className="text-center text-muted-foreground text-sm">
					No organisation matches "{trimmedSearch}".
				</p>
			) : null}

			{rowCount === 0 && !trimmedSearch && (
				<Card className="py-12 text-center">
					<CardContent>
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<BuildingIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<p className="mb-4 text-lg text-muted-foreground">
							No organisations available yet
						</p>
						<p className="text-muted-foreground text-sm">
							Accept an invitation above or contact your administrator to get
							access.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
