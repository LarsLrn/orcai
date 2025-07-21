import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod/v4";
import { DraggableBlock } from "@/components/blocks/builder/draggable-block";
import { DroppableZone } from "@/components/blocks/builder/droppable-zone";
import { BlockEditor } from "@/components/editor";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormTextField } from "@/components/forms/fields/form-text-field";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import type { Block } from "@/db/schema/block";
import { botInsertSchema } from "@/lib/orpc/contracts/bot";
import { orpc } from "@/lib/orpc/orpc";

interface BotBuilderFormProps {
	initialData?: z.infer<typeof botInsertSchema>;
	onSubmit?: (data: z.infer<typeof botInsertSchema>) => void;
}

const BotBuilderForm = ({ initialData, onSubmit }: BotBuilderFormProps) => {
	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: { pageIndex: 0, pageSize: 50 }, // Increase page size to get more blocks
			queryKey: orpc.block.list.key({ input: { pageIndex: 0, pageSize: 50 } }),
			placeholderData: keepPreviousData,
		}),
	);

	const [isDragging, setIsDragging] = useState(false);

	const form = useForm<z.infer<typeof botInsertSchema>>({
		resolver: zodResolver(botInsertSchema),
		mode: "onSubmit", // Validate on submit
		reValidateMode: "onChange", // Re-validate on change after first submit
		shouldFocusError: true, // Focus first field with error
		defaultValues: {
			name: initialData?.name ?? "",
			description: initialData?.description ?? "",
			contentJson: initialData?.contentJson ?? "",
			contentHtml: initialData?.contentHtml ?? "",
			blocks: initialData?.blocks ?? [],
		},
	});

	const activeBlocks = form.watch("blocks");
	const activeZoneId = "active-zone";
	const availableZoneId = "available-zone";

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		setIsDragging(false);

		if (over && over.id === activeZoneId) {
			// Find the block being dragged from available blocks
			const draggedBlock = blocks.data.find(
				(block: Block) => block.id === active.id,
			);
			if (draggedBlock && !activeBlocks.find((b) => b.id === draggedBlock.id)) {
				const newActiveBlocks = [...activeBlocks, { ...draggedBlock }];
				form.setValue("blocks", newActiveBlocks);
			}
		} else if (over && over.id === availableZoneId) {
			// Remove block from active zone if dragged back to available zone
			const draggedBlock = activeBlocks.find((block) => block.id === active.id);
			if (draggedBlock) {
				const newActiveBlocks = activeBlocks.filter(
					(block) => block.id !== draggedBlock.id,
				);
				form.setValue("blocks", newActiveBlocks);
			}
		}
	};

	const removeFromActiveZone = (blockId: string) => {
		const newActiveBlocks = activeBlocks.filter(
			(block) => block.id !== blockId,
		);
		form.setValue("blocks", newActiveBlocks);
	};

	// Filter out blocks that are already active
	const availableBlocks = blocks.data.filter(
		(block: Block) =>
			!activeBlocks.find((activeBlock) => activeBlock.id === block.id),
	);

	const handleSubmit = (data: z.infer<typeof botInsertSchema>) => {
		if (onSubmit) {
			onSubmit(data);
		} else {
			toast.success("Bot configuration saved!", {
				description: `${data.name} configured with ${data.blocks.length} blocks`,
			});
		}
	};

	const handleSubmitError = () => {
		toast.error("Please fix the form errors before submitting");
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit, handleSubmitError)}
				className="space-y-6"
				noValidate
			>
				{/* Validation Errors Section */}
				<FormValidationErrors form={form} />

				{/* Bot Configuration Section */}
				<Card>
					<CardHeader>
						<CardTitle>Bot Configuration</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormInputField
							form={form}
							name="name"
							inputType="text"
							placeholder="My Awesome Bot"
							label="Bot Name"
							required={true}
							description="Give your bot a descriptive name"
						/>

						<FormTextField
							form={form}
							name="description"
							rows={3}
							label="Description"
							placeholder="Describe what this bot does..."
							required={false}
							description="Optional description of your bot's purpose"
						/>

						<div className="space-y-2">
							<Label>
								Course Description
								<span className="bold text-muted-foreground"> *</span>
							</Label>
							{/* TODO: Improve handling of JSON */}
							<BlockEditor
								content={form.getValues("contentJson")}
								onUpdate={(value) => {
									form.setValue("contentJson", value.getJSON());
									form.setValue("contentHtml", value.getHTML());
								}}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Block Selection Section */}
				<Card>
					<CardHeader>
						<CardTitle>Block Configuration</CardTitle>
						<p className="text-muted-foreground text-sm">
							Drag blocks between the available and active sections to configure
							your bot
						</p>
					</CardHeader>
					<CardContent>
						<DndContext
							onDragStart={() => setIsDragging(true)}
							onDragEnd={handleDragEnd}
							onDragCancel={() => setIsDragging(false)}
						>
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
								{/* Available Blocks Section */}
								<div>
									<h3 className="mb-4 font-semibold text-base">
										Available Blocks
									</h3>
									<DroppableZone id={availableZoneId} dragging={isDragging}>
										{availableBlocks.length > 0 ? (
											<div className="space-y-2">
												{availableBlocks.map((block: Block) => (
													<DraggableBlock key={block.id} block={block} />
												))}
											</div>
										) : (
											<p className="text-center text-gray-500 text-sm">
												All blocks are currently active
											</p>
										)}
									</DroppableZone>
								</div>

								{/* Active Zone Section */}
								<div>
									<h3 className="mb-4 font-semibold text-base">
										Active Blocks ({activeBlocks.length})
									</h3>
									<DroppableZone id={activeZoneId} dragging={isDragging}>
										{activeBlocks.length > 0 ? (
											<div className="space-y-2">
												{activeBlocks.map((block) => (
													<div
														key={block.id}
														className="rounded border border-blue-300 bg-blue-100 p-3"
													>
														<div className="flex items-center justify-between">
															<DraggableBlock block={block as Block} />
															<button
																type="button"
																onClick={() => removeFromActiveZone(block.id)}
																className="text-red-500 text-sm hover:text-red-700"
															>
																×
															</button>
														</div>
													</div>
												))}
											</div>
										) : null}
									</DroppableZone>
								</div>
							</div>
						</DndContext>
					</CardContent>
				</Card>

				{/* Submit Section */}
				<div className="flex justify-end">
					<Button type="submit" size="lg">
						Save Bot Configuration
					</Button>
				</div>
			</form>
		</Form>
	);
};

export { BotBuilderForm };
