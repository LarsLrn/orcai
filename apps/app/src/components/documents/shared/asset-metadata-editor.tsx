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
			label="Author(s)"
			value={metadata.author ?? ""}
			placeholder="Author names"
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label="Citation label"
			value={metadata.citation ?? ""}
			placeholder="How this source should be cited"
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label="Chapter title"
			value={metadata.chapterTitle ?? ""}
			placeholder="Chapter title"
			onChange={(v) => onFieldChange("chapterTitle", v)}
		/>
		<MetadataField
			label="Page range"
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
			label="Author(s)"
			value={metadata.author ?? ""}
			placeholder="Author names"
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label="Citation label"
			value={metadata.citation ?? ""}
			placeholder="How this source should be cited"
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label="Journal name"
			value={metadata.journalName ?? ""}
			placeholder="Name of the journal"
			onChange={(v) => onFieldChange("journalName", v)}
		/>
		<MetadataField
			label="Volume"
			value={metadata.volume ?? ""}
			placeholder="e.g. 12"
			onChange={(v) => onFieldChange("volume", v)}
		/>
		<MetadataField
			label="Issue"
			value={metadata.issueNumber ?? ""}
			placeholder="e.g. 3"
			onChange={(v) => onFieldChange("issueNumber", v)}
		/>
		<MetadataField
			label="Page range"
			value={metadata.pageRange ?? ""}
			placeholder="120-135"
			onChange={(v) => onFieldChange("pageRange", v)}
		/>
		<MetadataField
			label="DOI"
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
			label="Author(s)"
			value={metadata.author ?? ""}
			placeholder="Author names"
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label="Citation label"
			value={metadata.citation ?? ""}
			placeholder="How this source should be cited"
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label="Website name"
			value={metadata.websiteName ?? ""}
			placeholder="Name of the website"
			onChange={(v) => onFieldChange("websiteName", v)}
		/>
		<MetadataField
			label="External URL"
			value={metadata.externalUrl ?? ""}
			placeholder="https://example.com/article"
			className="space-y-2 md:col-span-2"
			onChange={(v) => onFieldChange("externalUrl", v)}
		/>
		<MetadataField
			label="Access date"
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
			label="Citation label"
			value={metadata.citation ?? ""}
			placeholder="How this source should be cited"
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label="Legal reference"
			value={metadata.legalReference ?? ""}
			placeholder="e.g. § 1 BGB or Art. 5 GG"
			onChange={(v) => onFieldChange("legalReference", v)}
		/>
		<MetadataField
			label="Jurisdiction"
			value={metadata.jurisdiction ?? ""}
			placeholder="e.g. Germany, EU"
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
					<div className="font-medium text-sm">Source title</div>
					<Input
						value={value.title}
						onChange={(event) =>
							onChange({
								...value,
								title: event.target.value,
							})
						}
						placeholder="Source title"
					/>
				</div>
			) : null}

			<div className="space-y-2 md:col-span-2">
				<div className="font-medium text-sm">Source type</div>
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
						<SelectValue placeholder="Choose a source type" />
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
					label="External URL"
					value={metadata.externalUrl ?? ""}
					placeholder="Link to source material"
					className="space-y-2 md:col-span-2"
					onChange={(v) => onFieldChange("externalUrl", v)}
				/>
			) : null}

			<div className="space-y-2">
				<div className="font-medium text-sm">Relevance</div>
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
						<SelectValue placeholder="Choose relevance" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="high">High</SelectItem>
						<SelectItem value="medium">Medium</SelectItem>
						<SelectItem value="low">Low</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-3 rounded-xl border p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="font-medium text-sm">
							Allow citations in answers
						</div>
						<div className="text-muted-foreground text-xs">
							The AI may make in-text references to this source.
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
