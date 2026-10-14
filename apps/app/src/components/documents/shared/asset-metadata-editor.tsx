import {
	type Asset,
	type SourceType,
	sourceTypeLabels,
	sourceTypes,
} from "@orcai/schema";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { m } from "@/paraglide/messages";

type AssetMetadataDraft = {
	title: string;
	metadata: Asset["metadata"];
};

const createDefaultAssetMetadata = (): Asset["metadata"] => ({
	showReference: true,
	relevance: "medium",
	citation: "",
	externalUrl: "",
	pageRange: "",
	author: "",
	chapterTitle: "",
});

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

const MetadataField = ({
	label,
	value,
	placeholder,
	onChange,
	className,
}: {
	label: string;
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	className?: string;
}) => (
	<div className={className ?? "space-y-2"}>
		<div className="font-medium text-sm">{label}</div>
		<Input
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
		/>
	</div>
);

// ---------------------------------------------------------------------------
// Source-type–specific field sets
// ---------------------------------------------------------------------------

const BookFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_author_label()}
			value={metadata.author ?? ""}
			placeholder={m.assets_metadata_author_placeholder()}
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_chapter_title_label()}
			value={metadata.chapterTitle ?? ""}
			placeholder={m.assets_metadata_chapter_title_placeholder()}
			onChange={(v) => onFieldChange("chapterTitle", v)}
		/>
		<MetadataField
			label={m.assets_metadata_page_range_label()}
			value={metadata.pageRange ?? ""}
			placeholder="12-56"
			onChange={(v) => onFieldChange("pageRange", v)}
		/>
	</>
);

const JournalArticleFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_author_label()}
			value={metadata.author ?? ""}
			placeholder={m.assets_metadata_author_placeholder()}
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_journal_name_label()}
			value={metadata.journalName ?? ""}
			placeholder={m.assets_metadata_journal_name_placeholder()}
			onChange={(v) => onFieldChange("journalName", v)}
		/>
		<MetadataField
			label={m.assets_metadata_volume_label()}
			value={metadata.volume ?? ""}
			placeholder={m.assets_metadata_volume_placeholder()}
			onChange={(v) => onFieldChange("volume", v)}
		/>
		<MetadataField
			label={m.assets_metadata_issue_label()}
			value={metadata.issueNumber ?? ""}
			placeholder={m.assets_metadata_issue_placeholder()}
			onChange={(v) => onFieldChange("issueNumber", v)}
		/>
		<MetadataField
			label={m.assets_metadata_page_range_label()}
			value={metadata.pageRange ?? ""}
			placeholder="120-135"
			onChange={(v) => onFieldChange("pageRange", v)}
		/>
		<MetadataField
			label={m.assets_metadata_doi_label()}
			value={metadata.doi ?? ""}
			placeholder="10.1000/xyz123"
			onChange={(v) => onFieldChange("doi", v)}
		/>
	</>
);

const WebSourceFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_author_label()}
			value={metadata.author ?? ""}
			placeholder={m.assets_metadata_author_placeholder()}
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_website_name_label()}
			value={metadata.websiteName ?? ""}
			placeholder={m.assets_metadata_website_name_placeholder()}
			onChange={(v) => onFieldChange("websiteName", v)}
		/>
		<MetadataField
			label={m.assets_metadata_external_url_label()}
			value={metadata.externalUrl ?? ""}
			placeholder="https://example.com/article"
			className="space-y-2 md:col-span-2"
			onChange={(v) => onFieldChange("externalUrl", v)}
		/>
		<MetadataField
			label={m.assets_metadata_access_date_label()}
			value={metadata.accessDate ?? ""}
			placeholder="YYYY-MM-DD"
			onChange={(v) => onFieldChange("accessDate", v)}
		/>
	</>
);

const LegalTextFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_legal_reference_label()}
			value={metadata.legalReference ?? ""}
			placeholder={m.assets_metadata_legal_reference_placeholder()}
			onChange={(v) => onFieldChange("legalReference", v)}
		/>
		<MetadataField
			label={m.assets_metadata_jurisdiction_label()}
			value={metadata.jurisdiction ?? ""}
			placeholder={m.assets_metadata_jurisdiction_placeholder()}
			onChange={(v) => onFieldChange("jurisdiction", v)}
		/>
	</>
);

const sourceTypeFieldComponents: Record<SourceType, typeof BookFields> = {
	book: BookFields,
	"journal-article": JournalArticleFields,
	"web-source": WebSourceFields,
	"legal-text": LegalTextFields,
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const AssetMetadataEditor = ({
	value,
	onChange,
	showTitle = true,
}: {
	value: AssetMetadataDraft;
	onChange: (nextValue: AssetMetadataDraft) => void;
	showTitle?: boolean;
}) => {
	const metadata = value.metadata ?? createDefaultAssetMetadata();

	const onFieldChange = (field: string, fieldValue: string) =>
		onChange({
			...value,
			metadata: {
				...metadata,
				[field]: fieldValue,
			},
		});

	const SourceFields =
		metadata.sourceType && sourceTypeFieldComponents[metadata.sourceType];

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{showTitle ? (
				<div className="space-y-2 md:col-span-2">
					<div className="font-medium text-sm">
						{m.assets_metadata_source_title_label()}
					</div>
					<Input
						value={value.title}
						onChange={(event) =>
							onChange({
								...value,
								title: event.target.value,
							})
						}
						placeholder={m.assets_metadata_source_title_placeholder()}
					/>
				</div>
			) : null}

			<div className="space-y-2 md:col-span-2">
				<div className="font-medium text-sm">
					{m.assets_metadata_source_type_label()}
				</div>
				<Select
					value={metadata.sourceType ?? ""}
					onValueChange={(nextValue) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								sourceType: nextValue as SourceType,
							},
						})
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue
							placeholder={m.assets_metadata_source_type_placeholder()}
						/>
					</SelectTrigger>
					<SelectContent>
						{sourceTypes.map((type) => (
							<SelectItem key={type} value={type}>
								{sourceTypeLabels[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{SourceFields ? (
				<SourceFields metadata={metadata} onFieldChange={onFieldChange} />
			) : null}

			{/* External URL is always available when the source type doesn't already include it */}
			{metadata.sourceType && metadata.sourceType !== "web-source" ? (
				<MetadataField
					label={m.assets_metadata_external_url_label()}
					value={metadata.externalUrl ?? ""}
					placeholder="https://example.org/article"
					className="space-y-2 md:col-span-2"
					onChange={(v) => onFieldChange("externalUrl", v)}
				/>
			) : null}

			<div className="space-y-2">
				<div className="font-medium text-sm">
					{m.assets_metadata_relevance_label()}
				</div>
				<Select
					value={metadata.relevance}
					onValueChange={(nextValue) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								relevance: nextValue as Asset["metadata"]["relevance"],
							},
						})
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue
							placeholder={m.assets_metadata_relevance_placeholder()}
						/>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="high">
							{m.assets_relevance_high_label()}
						</SelectItem>
						<SelectItem value="medium">
							{m.assets_relevance_medium_label()}
						</SelectItem>
						<SelectItem value="low">
							{m.assets_relevance_low_label()}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-3 rounded-xl border p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="font-medium text-sm">
							{m.assets_metadata_show_reference_label()}
						</div>
						<div className="text-muted-foreground text-xs">
							{m.assets_metadata_show_reference_description()}
						</div>
					</div>
					<Switch
						checked={metadata.showReference}
						onCheckedChange={(checked) =>
							onChange({
								...value,
								metadata: {
									...metadata,
									showReference: checked,
								},
							})
						}
					/>
				</div>
			</div>
		</div>
	);
};

export {
	type AssetMetadataDraft,
	AssetMetadataEditor,
	createDefaultAssetMetadata,
};
