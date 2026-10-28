import type { AssetMetadataType } from "@orcai/schema";
import type { AssetMetadataDraft } from "./asset-metadata-editor";

const same = (a: string | undefined, b: string | undefined) =>
	(a ?? "") === (b ?? "");

/**
 * What the user changed since `initial`, for a save that leaves every other
 * field as it is stored now, such as metadata generated while the form was open.
 */
export const changedAssetFields = (
	initial: AssetMetadataDraft,
	draft: AssetMetadataDraft,
): {
	title?: string;
	metadata: AssetMetadataType;
} => {
	const fields = new Set([
		...Object.keys(initial.metadata),
		...Object.keys(draft.metadata),
	]) as Set<keyof AssetMetadataType>;
	const metadata = Object.fromEntries(
		[
			...fields,
		]
			.filter((field) => !same(initial.metadata[field], draft.metadata[field]))
			.map((field) => [
				field,
				draft.metadata[field] ?? "",
			]),
	) as AssetMetadataType;

	return {
		...(draft.title !== initial.title && {
			title: draft.title,
		}),
		metadata,
	};
};
