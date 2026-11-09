import type { OrganizationId } from "@orcai/core";
import type { MutationFunctionContext } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useUploadFiles } from "@/components/assets/upload/use-upload-files";
import {
	callProcedure,
	useMutationAction,
} from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The signed-in user's picture, or an organisation's logo. */
export type ImageTarget =
	| {
			kind: "user";
	  }
	| {
			kind: "organization";
			organizationId: OrganizationId;
	  };

/**
 * Saves a cropped image as the target's picture or logo, uploading it through
 * the target's route first, and removes it. The user menu reads the signed-in
 * user from the router context, so a picture change reloads it.
 */
export const useImageUpload = (target: ImageTarget) => {
	const router = useRouter();
	const { uploadAsync } = useUploadFiles({
		route: target.kind === "user" ? "profileImage" : "organizationLogo",
	});

	const refresh = async () => {
		if (target.kind === "user") await router.invalidate();
	};

	const save = useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (image: Blob, context: MutationFunctionContext) => {
				const uploaded = await uploadAsync([
					new File(
						[
							image,
						],
						"image.webp",
						{
							type: image.type,
						},
					),
				]);
				const [file] = uploaded.files;
				if (!file)
					throw (
						uploaded.failedFiles[0]?.error.cause ??
						new Error(m.images_upload_failed_error())
					);
				const upload = {
					objectKey: file.objectKey,
					objectMetadata: file.objectMetadata,
					name: file.name,
					size: file.size,
					type: file.type,
				};
				if (target.kind === "user")
					await callProcedure(
						orpc.user.setImage.mutationOptions(),
						context,
					)({
						file: upload,
					});
				else
					await callProcedure(
						orpc.organization.setLogo.mutationOptions(),
						context,
					)({
						id: target.organizationId,
						file: upload,
					});
			},
			onSuccess: refresh,
		}),
		messages: {
			loading: m.images_save_toast_loading(),
			success: m.images_save_toast_success(),
			error: m.images_save_toast_error(),
		},
	});

	const remove = useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (
				_input: undefined,
				context: MutationFunctionContext,
			) => {
				if (target.kind === "user")
					await callProcedure(
						orpc.user.removeImage.mutationOptions(),
						context,
					)({});
				else
					await callProcedure(
						orpc.organization.removeLogo.mutationOptions(),
						context,
					)({
						id: target.organizationId,
					});
			},
			onSuccess: refresh,
		}),
		messages: {
			loading: m.images_remove_toast_loading(),
			success: m.images_remove_toast_success(),
			error: m.images_remove_toast_error(),
		},
	});

	return {
		save,
		remove,
	};
};
