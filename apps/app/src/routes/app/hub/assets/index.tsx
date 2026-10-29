import {
	type AssetOrigin,
	assetOriginSchema,
	paginationInputSchema,
} from "@orcai/schema";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
	SparklesIcon,
} from "lucide-react";
import { AssetTile } from "@/components/documents/asset-tile";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { useGenerateMissingMetadataMutation } from "@/hooks/mutations/use-asset-mutations";
import { useUtilityModel } from "@/hooks/use-utility-model";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import {
	isAssetWorking,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
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

/** Generates metadata for the library assets that lack it; hidden without a utility model or anything to generate. */
const GenerateMissingMetadataAction = () => {
	const utilityModel = useUtilityModel();
	const { data } = useQuery(
		orpc.asset.missingMetadata.queryOptions({
			input: utilityModel.available ? {} : skipToken,
		}),
	);
	const count = data?.count ?? 0;
	const { mutate: generate, isPending } =
		useGenerateMissingMetadataMutation(count);

	if (!utilityModel.available || count === 0) {
		return null;
	}
	return (
		<Button
			variant="outline"
			size="sm"
			loading={isPending}
			onClick={() => generate({})}
		>
			<SparklesIcon />
			{m.assets_metadata_backfill_action()}
		</Button>
	);
};

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
			refetchInterval: (query) =>
				query.state.data?.data.some(isAssetWorking) ? METADATA_POLL_MS : false,
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
				{canCreateAsset || !isChatUploads ? (
					<SectionAction>
						{isChatUploads ? null : <GenerateMissingMetadataAction />}
						{canCreateAsset ? (
							<Link
								to="/app/hub/assets/add"
								className={buttonVariants({
									size: "sm",
								})}
							>
								<PlusIcon />
								{m.assets_list_add_action()}
							</Link>
						) : null}
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
								<AssetTile key={asset.id} asset={asset} />
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
