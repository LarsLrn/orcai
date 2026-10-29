import type { OrganizationId } from "@orcai/core";
import { type ReactNode, useState } from "react";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/users/user-avatar";
import { m } from "@/paraglide/messages";
import { ImageUploadDialog } from "./image-upload-dialog";
import { type ImageTarget, useImageUpload } from "./use-image-upload";

const ImageSettings = ({
	target,
	preview,
	hasImage,
	shape,
	copy,
}: {
	target: ImageTarget;
	preview: ReactNode;
	hasImage: boolean;
	shape: "round" | "rect";
	copy: {
		change: string;
		remove: string;
		dialogTitle: string;
	};
}) => {
	const [open, setOpen] = useState(false);
	const { save, remove } = useImageUpload(target);

	return (
		<div className="flex items-center gap-4">
			{preview}
			<div className="flex flex-wrap gap-2">
				<Button type="button" variant="outline" onClick={() => setOpen(true)}>
					{copy.change}
				</Button>
				{hasImage ? (
					<Button
						type="button"
						variant="ghost"
						onClick={() => remove.mutate(undefined)}
						loading={remove.isPending}
					>
						{copy.remove}
					</Button>
				) : null}
			</div>
			<ImageUploadDialog
				open={open}
				onOpenChange={setOpen}
				shape={shape}
				title={copy.dialogTitle}
				onSave={async (image) =>
					(await save.mutateAsync(image)).status === "success"
				}
			/>
		</div>
	);
};

/** The signed-in user's picture with change and remove. */
export const ProfilePictureSettings = ({
	user,
}: {
	user: {
		name: string;
		image?: string | null;
	};
}) => (
	<ImageSettings
		target={{
			kind: "user",
		}}
		preview={<UserAvatar user={user} className="size-16 text-lg" />}
		hasImage={Boolean(user.image)}
		shape="round"
		copy={{
			change: m.images_picture_change_button(),
			remove: m.images_picture_remove_button(),
			dialogTitle: m.images_picture_dialog_title(),
		}}
	/>
);

/** An organisation's logo with change and remove, for its admins. */
export const OrganizationLogoSettings = ({
	organization,
}: {
	organization: {
		id: OrganizationId;
		name: string;
		logo: string | null;
	};
}) => (
	<ImageSettings
		target={{
			kind: "organization",
			organizationId: organization.id,
		}}
		preview={
			<OrganizationLogo
				organization={organization}
				className="size-16 text-lg"
			/>
		}
		hasImage={Boolean(organization.logo)}
		shape="rect"
		copy={{
			change: m.images_logo_change_button(),
			remove: m.images_logo_remove_button(),
			dialogTitle: m.images_logo_dialog_title(),
		}}
	/>
);
