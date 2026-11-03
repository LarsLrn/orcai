import type { ResourceGrant } from "@orcai/schema";
import { AccessManagerContent } from "@/components/access/access-manager-content";
import { toLinkedBlocks } from "@/components/access/block-edit-offer";
import type { BotEditorFormValues } from "@/components/authoring/bot-editor-form-options";
import { describeAllMembersAccess } from "@/components/authoring/publish-summary";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

const SharingStep = ({
	editor,
	grants,
	grantsAvailable,
}: {
	editor: BotEditorFormValues;
	grants: ResourceGrant[];
	grantsAvailable: boolean;
}) => {
	const memberAccess = grantsAvailable
		? describeAllMembersAccess(grants)
		: null;

	if (!editor.id) {
		return (
			<Card className="min-w-0 rounded-2xl">
				<CardHeader>
					<CardTitle>{m.authoring_sharing_title()}</CardTitle>
					<CardDescription>
						{m.authoring_sharing_unsaved_description()}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<p>{m.authoring_sharing_unshared_description()}</p>
					{memberAccess ? <p>{memberAccess}</p> : null}
				</CardContent>
			</Card>
		);
	}

	if (!hasCapability(editor.capabilities, "manage_access")) {
		return null;
	}

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>{m.authoring_sharing_title()}</CardTitle>
				<CardDescription>{m.authoring_sharing_description()}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{grants.length === 0 ? (
					<p>{m.authoring_sharing_unshared_description()}</p>
				) : null}
				{memberAccess ? <p>{memberAccess}</p> : null}
				<AccessManagerContent
					resourceRef={{
						type: "bot",
						id: editor.id,
					}}
					resourceName={editor.name}
					linkedBlocks={toLinkedBlocks(editor)}
				/>
			</CardContent>
		</Card>
	);
};

export { SharingStep };
