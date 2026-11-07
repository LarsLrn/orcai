import type { BlockId } from "@orcai/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import {
	type BotEditorRepository,
	botEditorFormOptions,
	newRepositoryValues,
} from "@/components/authoring/bot-editor-form-options";
import { ReadOnlyRepositoryCard } from "@/components/authoring/steps/read-only-block-cards";
import { BlockSelectorDialog } from "@/components/blocks/block-selector-dialog";
import { RepositoryFieldGroup } from "@/components/blocks/repository/form/repository-field-group";
import { Button } from "@/components/ui/button";
import { withForm } from "@/hooks/form";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

/** A new repository, or one the user may edit, is edited in the step; any other is shown read-only. */
const editsInPlace = (repository: BotEditorRepository) =>
	hasCapability(repository.capabilities, "edit") || !repository.id;

const RepositoriesStep = withForm({
	...botEditorFormOptions,
	props: {} as {
		onLink: (blockId: BlockId) => Promise<void>;
	},
	render: function Render({ form, onLink }) {
		const repositories = useSelector(
			form.store,
			(state) => state.values.repositories,
		);
		const [isLibraryOpen, setIsLibraryOpen] = useState(false);

		const addRepository = () =>
			form.pushFieldValue(
				"repositories",
				newRepositoryValues(form.getFieldValue("name")),
			);
		const removeRepository = (index: number) =>
			void form.removeFieldValue("repositories", index);

		return (
			<div className="grid min-w-0 grid-cols-1 gap-4">
				{repositories.length === 0 ? (
					<div className="bg-background/70 min-w-0 rounded-2xl border border-dashed p-6">
						<div className="font-medium">
							{m.authoring_repositories_empty_state_title()}
						</div>
						<div className="text-muted-foreground mt-2 text-sm">
							{m.authoring_repositories_empty_state_description()}
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<Button onClick={addRepository}>
								{m.authoring_repositories_create_action()}
							</Button>
							<Button variant="outline" onClick={() => setIsLibraryOpen(true)}>
								{m.authoring_repositories_use_existing_action()}
							</Button>
						</div>
					</div>
				) : (
					<div className="grid min-w-0 grid-cols-1 gap-4">
						<div className="flex flex-wrap justify-end gap-2">
							<Button variant="outline" onClick={() => setIsLibraryOpen(true)}>
								{m.authoring_repositories_add_existing_action()}
							</Button>
						</div>

						{repositories.map((repository, index) =>
							editsInPlace(repository) ? (
								<RepositoryFieldGroup
									key={repository.id ?? `repository-${index}`}
									form={form}
									fields={`repositories[${index}]`}
									blockId={repository.id}
									assets={repository.assets}
									onAssetsChange={(assets) => {
										form.setFieldValue(`repositories[${index}].assets`, assets);
										form.setFieldValue(
											`repositories[${index}].assetIds`,
											assets.map((asset) => asset.id),
										);
									}}
									onUploadRun={(runId) =>
										form.pushFieldValue(
											`repositories[${index}].uploadRunIds`,
											runId,
										)
									}
									onRemove={() => removeRepository(index)}
								/>
							) : (
								<ReadOnlyRepositoryCard
									key={repository.id}
									block={repository}
									onDetach={() => removeRepository(index)}
								/>
							),
						)}

						<Button
							className="justify-self-start"
							variant="outline"
							onClick={addRepository}
						>
							{m.authoring_repositories_add_another_action()}
						</Button>
					</div>
				)}

				<BlockSelectorDialog
					open={isLibraryOpen}
					onOpenChange={setIsLibraryOpen}
					type="repository"
					includeDrafts
					selectedIds={repositories.flatMap((repository) =>
						repository.id
							? [
									repository.id,
								]
							: [],
					)}
					onSelect={(block) => onLink(block.id)}
					title={m.authoring_repositories_library_dialog_title()}
					description={m.authoring_repositories_library_dialog_description()}
				/>
			</div>
		);
	},
});

export { editsInPlace, RepositoriesStep };
