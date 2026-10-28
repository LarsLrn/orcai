import {
	type AssetOrigin,
	assetOriginSchema,
	paginationInputSchema,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import {
	FileTextIcon,
	LibraryIcon,
	MessageSquareIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { AssetCard } from "@/components/documents/asset-card";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import { CardPager, useClampedPageIndex } from "@/components/ui/card-pager";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pager";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import {
	useAddAssetToLibraryMutation,
	useReprocessAssetMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const assetsSearchSchema = paginationInputSchema.extend({
	origin: assetOriginSchema.default("library"),
});

const listInput = (search: {
	pageIndex: number;
	pageSize: number;
	origin: AssetOrigin;
}) => ({
	pageIndex: search.pageIndex,
	pageSize: search.pageSize,
	filters: {
		origin: search.origin,
	},
});

export const Route = createFileRoute("/app/hub/assets/")({
	validateSearch: assetsSearchSchema,
	search: {
		middlewares: [
			stripSearchParams({
				pageIndex: 0,
				pageSize: DEFAULT_PAGE_SIZE,
				origin: "library",
			}),
		],
	},
	loaderDeps: ({ search: { pageIndex, pageSize, origin } }) => ({
		pageIndex,
		pageSize,
		origin,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await queryClient.query(
			orpc.asset.list.queryOptions({
				input: listInput(deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const { mutate: reprocessAsset } = useReprocessAssetMutation();
	const { mutate: addToLibrary } = useAddAssetToLibraryMutation();
	const { data: organizationCapabilities } = useOrganizationCapabilities([
		"create_asset",
	]);
	const canCreateAsset = hasCapability(
		organizationCapabilities?.data.capabilities,
		"create_asset",
	);
	const { data: assets } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: listInput(search),
		}),
	);
	useClampedPageIndex({
		rowCount: assets.rowCount,
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
	});
	const isChatUploads = search.origin === "chat";

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>{m.assets_list_title()}</SectionTitle>
				<SectionDescription>{m.assets_list_description()}</SectionDescription>
				{canCreateAsset ? (
					<SectionAction>
						<Link
							to="/app/hub/assets/add"
							className={buttonVariants({
								size: "sm",
							})}
						>
							<PlusIcon />
							{m.assets_list_add_action()}
						</Link>
					</SectionAction>
				) : null}
			</SectionHeader>
			<SectionContent className="space-y-6">
				<Tabs
					value={search.origin}
					onValueChange={(origin) =>
						void navigate({
							search: {
								origin: assetOriginSchema.parse(origin),
								pageIndex: 0,
								pageSize: search.pageSize,
							},
						})
					}
				>
					<TabsList>
						<TabsTrigger value="library">
							<LibraryIcon />
							{m.assets_list_library_tab()}
						</TabsTrigger>
						<TabsTrigger value="chat">
							<MessageSquareIcon />
							{m.assets_list_chat_uploads_tab()}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				{assets.rowCount === 0 ? (
					<Placeholder
						Icon={isChatUploads ? MessageSquareIcon : FileTextIcon}
						tone="asset"
						title={
							isChatUploads
								? m.assets_list_chat_uploads_empty_state_title()
								: m.assets_list_empty_state_title()
						}
						description={
							isChatUploads
								? m.assets_list_chat_uploads_empty_state_description()
								: m.assets_list_empty_state_description()
						}
						actions={
							canCreateAsset && !isChatUploads
								? [
										{
											key: "add",
											label: m.assets_list_add_action(),
											icon: PlusIcon,
											variant: "default",
											linkProps: {
												to: "/app/hub/assets/add",
											},
										},
									]
								: []
						}
					/>
				) : (
					<>
						<SectionGrid layout="3">
							{assets.data.map((asset) => (
								<AssetCard
									key={asset.id}
									asset={asset}
									actions={{
										dropdown: hasCapability(asset.capabilities, "edit")
											? [
													...(asset.origin === "chat"
														? [
																{
																	key: "add-to-library",
																	label: m.assets_add_to_library_action(),
																	icon: LibraryIcon,
																	onClick: () =>
																		addToLibrary({
																			id: asset.id,
																		}),
																},
															]
														: []),
													...(asset.processingStatus === "pending" ||
													asset.processingStatus === "active"
														? []
														: [
																{
																	key: "reprocess",
																	label: m.assets_list_reprocess_action(),
																	icon: RefreshCwIcon,
																	onClick: () =>
																		reprocessAsset({
																			id: asset.id,
																		}),
																},
															]),
												]
											: [],
										footer: [],
									}}
								/>
							))}
						</SectionGrid>
						<CardPager
							rowCount={assets.rowCount}
							pageIndex={search.pageIndex}
							pageSize={search.pageSize}
						/>
					</>
				)}
			</SectionContent>
		</Section>
	);
}
