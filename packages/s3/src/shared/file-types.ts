import type { FileType } from "@orcai/schema";

type KnownFileType = Exclude<FileType, "unknown">;

/**
 * Every stored file type with its canonical MIME type and the non-standard
 * MIME types that also mean it. The first file type listing a MIME type wins
 * the reverse lookup, so `image/jpeg` is stored as `jpeg`.
 */
const FILE_TYPES = {
	jpeg: {
		mimeType: "image/jpeg",
	},
	jpg: {
		mimeType: "image/jpeg",
		aliases: [
			"image/jpg",
		],
	},
	png: {
		mimeType: "image/png",
	},
	gif: {
		mimeType: "image/gif",
	},
	webp: {
		mimeType: "image/webp",
	},
	md: {
		mimeType: "text/markdown",
	},
	txt: {
		mimeType: "text/plain",
	},
	csv: {
		mimeType: "text/csv",
	},
	pdf: {
		mimeType: "application/pdf",
	},
	doc: {
		mimeType: "application/msword",
		aliases: [
			"application/x-msword",
		],
	},
	docx: {
		mimeType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
	xls: {
		mimeType: "application/vnd.ms-excel",
		aliases: [
			"application/msexcel",
			"application/x-msexcel",
			"application/x-ms-excel",
		],
	},
	xlsx: {
		mimeType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	},
	ppt: {
		mimeType: "application/vnd.ms-powerpoint",
		aliases: [
			"application/mspowerpoint",
			"application/powerpoint",
			"application/x-mspowerpoint",
		],
	},
	pptx: {
		mimeType:
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	},
	mp3: {
		mimeType: "audio/mpeg",
	},
	wav: {
		mimeType: "audio/wav",
		aliases: [
			"audio/x-wav",
		],
	},
	mp4: {
		mimeType: "video/mp4",
	},
	mov: {
		mimeType: "video/quicktime",
	},
} as const satisfies Record<
	KnownFileType,
	{
		mimeType: string;
		aliases?: readonly string[];
	}
>;

const mimeTypesOf = (fileType: KnownFileType): readonly string[] => {
	const definition: {
		mimeType: string;
		aliases?: readonly string[];
	} = FILE_TYPES[fileType];
	return [
		definition.mimeType,
		...(definition.aliases ?? []),
	];
};

const MIME_TO_FILE_TYPE = new Map<string, KnownFileType>();
for (const fileType of Object.keys(FILE_TYPES) as KnownFileType[]) {
	for (const mimeType of mimeTypesOf(fileType)) {
		if (!MIME_TO_FILE_TYPE.has(mimeType)) {
			MIME_TO_FILE_TYPE.set(mimeType, fileType);
		}
	}
}

/** The file type of a MIME type, ignoring parameters such as `; charset=utf-8`. */
export function getFileTypeFromMime(mimeType: string): FileType {
	for (const [mime, fileType] of MIME_TO_FILE_TYPE) {
		if (mimeType.startsWith(mime)) {
			return fileType;
		}
	}
	return "unknown";
}

/** The file type of exactly this MIME type, if it is one of `fileTypes`. */
export const fileTypeAmong = <T extends KnownFileType>(
	mimeType: string,
	fileTypes: readonly T[],
) => {
	const fileType = MIME_TO_FILE_TYPE.get(mimeType);
	return fileTypes.find((candidate) => candidate === fileType);
};

export function getMimeTypeFromFileType(fileType: KnownFileType): string;
export function getMimeTypeFromFileType(fileType: FileType): string | undefined;
export function getMimeTypeFromFileType(
	fileType: FileType,
): string | undefined {
	if (fileType === "unknown") return undefined;
	return FILE_TYPES[fileType].mimeType;
}

/** Every MIME type that means one of `fileTypes`. */
export const mimeTypesFor = (fileTypes: readonly KnownFileType[]) => [
	...new Set(fileTypes.flatMap(mimeTypesOf)),
];

/** The extensions each MIME type of `fileTypes` may carry, as a file picker's `accept` takes them. */
export const acceptFor = (fileTypes: readonly KnownFileType[]) => {
	const accept: Record<string, string[]> = {};
	for (const fileType of fileTypes) {
		for (const mimeType of mimeTypesOf(fileType)) {
			accept[mimeType] = [
				...(accept[mimeType] ?? []),
				`.${fileType}`,
			];
		}
	}
	return accept;
};
