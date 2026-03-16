import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Asset } from "@/lib/orpc/schemas/asset";

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

			<div className="space-y-2">
				<div className="font-medium text-sm">Author(s)</div>
				<Input
					value={metadata.author ?? ""}
					onChange={(event) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								author: event.target.value,
							},
						})
					}
					placeholder="Author names"
				/>
			</div>

			<div className="space-y-2">
				<div className="font-medium text-sm">Citation label</div>
				<Input
					value={metadata.citation ?? ""}
					onChange={(event) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								citation: event.target.value,
							},
						})
					}
					placeholder="How this source should be cited"
				/>
			</div>

			<div className="space-y-2">
				<div className="font-medium text-sm">Chapter Title</div>
				<Input
					value={metadata.chapterTitle ?? ""}
					onChange={(event) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								chapterTitle: event.target.value,
							},
						})
					}
					placeholder="Chapter title"
				/>
			</div>

			<div className="space-y-2">
				<div className="font-medium text-sm">Page Range</div>
				<Input
					value={metadata.pageRange ?? ""}
					onChange={(event) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								pageRange: event.target.value,
							},
						})
					}
					placeholder="12-56"
				/>
			</div>

			<div className="space-y-2 md:col-span-2">
				<div className="font-medium text-sm">External URL</div>
				<Input
					value={metadata.externalUrl ?? ""}
					onChange={(event) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								externalUrl: event.target.value,
							},
						})
					}
					placeholder="Link to source material"
				/>
			</div>

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
