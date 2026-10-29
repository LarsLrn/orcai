import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { BuildingIcon, ServerCogIcon } from "lucide-react";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { ChatHistoryLink } from "@/components/chat/chat-history-link";
import {
	invitationsPageInput,
	OrganizationInvitationsList,
} from "@/components/organizations/invitations/organization-invitations-list";
import { OrganizationTile } from "@/components/organizations/organization-tile";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchField } from "@/components/ui/composed/search-field";
import { useSetActiveOrganizationMutation } from "@/hooks/mutations/use-user-mutations";
import { authClient } from "@/lib/auth/auth-client";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
			orpc.organizationInvitation.listMine.queryOptions({
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
		orpc.organizationInvitation.listMine.queryOptions({
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
				<h2 className="font-semibold text-xl">
					{m.select_organisation_page_pending_invitations_title()}
				</h2>
				<p className="mt-1 mb-4 text-muted-foreground text-sm">
					{m.select_organisation_page_pending_invitations_description()}
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
	const [debouncedSearch] = useDebounceValue(search, 250);
	const [pageCount, setPageCount] = useState(1);
	const trimmedSearch = debouncedSearch.trim();

	const { data: organizations, isFetching } = useQuery(
		orpc.organization.list.queryOptions({
			input: organizationsInput({
				search: trimmedSearch,
				pageCount,
			}),
		}),
	);
	const setActiveOrganization = useSetActiveOrganizationMutation();
	// One selection at a time: a second one would switch the session under the first's page.
	const selectingId = setActiveOrganization.isPending
		? setActiveOrganization.variables?.organizationId
		: undefined;

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
				<div className="flex justify-end">
					<Link
						to="/instance"
						className={buttonVariants({
							variant: "outline",
						})}
					>
						<ServerCogIcon />
						{m.select_organisation_page_manage_instance_link()}
					</Link>
				</div>
			)}
			<div className="space-y-2 text-center">
				<h1 className="font-semibold text-2xl tracking-tight">
					{m.select_organisation_page_title()}
				</h1>
				<p className="text-lg text-muted-foreground">
					{m.select_organisation_page_subtitle()}
				</p>
			</div>

			{search || rowCount > 0 ? (
				<div className="flex justify-center">
					<SearchField
						value={search}
						placeholder={m.select_organisation_page_search_placeholder()}
						onValueChange={(value) => {
							setSearch(value);
							setPageCount(1);
						}}
						className="w-full sm:max-w-xs"
					/>
				</div>
			) : null}

			{rows.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
					{rows.map((organization) => (
						<OrganizationTile
							key={organization.id}
							organization={organization}
							loading={organization.id === selectingId}
							disabled={setActiveOrganization.isPending}
							onSelect={() =>
								setActiveOrganization.mutate({
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
						loading={isFetching}
						onClick={() => setPageCount((count) => count + 1)}
					>
						{m.select_organisation_page_load_more_button()}
					</Button>
				</div>
			) : null}

			<PendingInvitationsSection onAccepted={handleInvitationAccepted} />

			<div className="flex justify-center">
				<ChatHistoryLink />
			</div>

			{rowCount === 0 && trimmedSearch ? (
				<p className="text-center text-muted-foreground text-sm">
					{m.select_organisation_page_no_match({
						search: trimmedSearch,
					})}
				</p>
			) : null}

			{rowCount === 0 && !trimmedSearch && (
				<Card className="py-12 text-center">
					<CardContent>
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<BuildingIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<p className="mb-4 text-lg text-muted-foreground">
							{m.select_organisation_page_empty_title()}
						</p>
						<p className="text-muted-foreground text-sm">
							{m.select_organisation_page_empty_description()}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
