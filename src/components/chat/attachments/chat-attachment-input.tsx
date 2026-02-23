import type { FileUIPart, SourceDocumentUIPart } from "ai";
import convert from "convert";
import {
	Attachment,
	type AttachmentData,
	AttachmentHoverCard,
	AttachmentHoverCardContent,
	AttachmentHoverCardTrigger,
	AttachmentInfo,
	AttachmentPreview,
	AttachmentRemove,
	Attachments,
} from "@/components/ai-elements/attachments";
import { InputGroupAddon } from "@/components/ui/input-group";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { LocalChatFile } from "./use-chat-attachments";

const localFileToUiPart = (file: LocalChatFile) =>
	({
		id: file.id,
		type: "file",
		filename: file.file.name,
		mediaType: file.file.type,
		url: file.previewUrl,
	}) satisfies FileUIPart & { id: string };

const assetToUiPart = (asset: Asset) =>
	({
		id: asset.id,
		type: "source-document",
		sourceId: asset.id,
		mediaType: asset.fileType,
		title: asset.title,
		filename: asset.title,
	}) satisfies SourceDocumentUIPart & { id: string };

const AttachmentNode = ({
	key,
	data,
	title,
	fileType,
	size,
	onRemove,
}: {
	key: string;
	data: AttachmentData;
	title: string;
	fileType: string;
	size: number;
	onRemove: () => void;
}) => {
	return (
		<AttachmentHoverCard key={key}>
			<AttachmentHoverCardTrigger
				render={
					<Attachment data={data} onRemove={onRemove}>
						<div className="relative size-5 shrink-0">
							<div className="absolute inset-0 transition-opacity group-hover:opacity-0">
								<AttachmentPreview />
							</div>
							<AttachmentRemove className="absolute inset-0" />
						</div>
						<AttachmentInfo />
					</Attachment>
				}
			/>
			<AttachmentHoverCardContent>
				<div className="space-y-3">
					<div className="space-y-1 px-0.5">
						<h4 className="font-semibold text-sm leading-none">{title}</h4>

						<p className="font-mono text-muted-foreground text-xs">
							{fileType} · {convert(size, "B").to("best").toString(2)}
						</p>
					</div>
				</div>
			</AttachmentHoverCardContent>
		</AttachmentHoverCard>
	);
};

export const ChatComposerAttachments = ({
	localFiles,
	assets,
	onRemoveLocalFile,
	onRemoveAsset,
}: {
	localFiles: LocalChatFile[];
	assets: Asset[];
	onRemoveLocalFile: (id: string) => void;
	onRemoveAsset: (id: Asset["id"]) => void;
}) => {
	if (localFiles.length === 0 && assets.length === 0) {
		return null;
	}

	return (
		<InputGroupAddon align="block-end" className="flex-wrap gap-1">
			<Attachments variant="inline">
				{localFiles.map((file) => (
					<AttachmentNode
						key={file.id}
						data={localFileToUiPart(file)}
						title={file.file.name}
						fileType={file.file.type}
						size={file.file.size}
						onRemove={() => onRemoveLocalFile(file.id)}
					/>
				))}
				{assets.map((asset) => (
					<AttachmentNode
						key={asset.id}
						data={assetToUiPart(asset)}
						title={asset.title}
						fileType={asset.fileType}
						size={asset.size}
						onRemove={() => onRemoveAsset(asset.id)}
					/>
				))}
			</Attachments>
		</InputGroupAddon>
	);
};
