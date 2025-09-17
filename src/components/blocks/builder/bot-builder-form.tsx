import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { BotBuilderBlocksSection } from "@/components/blocks/builder/bot-builder-blocks-section";
import { BotBuilderDetailsCard } from "@/components/blocks/builder/bot-builder-details-card";
import type { BotBuilderFormValues } from "@/components/blocks/builder/bot-builder-form.types";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { Block } from "@/lib/orpc/schemas/block";
import { type BotInsert, botInsertSchema } from "@/lib/orpc/schemas/bot";
import { blockQueryOptions } from "@/lib/query-options/block";
import { MAX_DATABASE_BLOCKS } from "@/settings/bots";

interface BotBuilderFormProps {
	initialData?: BotInsert;
	onSubmit?: (data: BotInsert) => void;
}

const BotBuilderForm = ({ initialData, onSubmit }: BotBuilderFormProps) => {
	const { data: blocksResponse } = useSuspenseQuery(
		blockQueryOptions.list({
			input: { pageIndex: 0, pageSize: 50 },
		}),
	);

	const allBlocks = useMemo<Block[]>(() => {
		const list = blocksResponse.data;
		return Array.isArray(list) ? (list as Block[]) : [];
	}, [blocksResponse.data]);
	const blockMap = useMemo(() => {
		return new Map(allBlocks.map((block) => [block.id, block] as const));
	}, [allBlocks]);

	const form = useForm<BotBuilderFormValues>({
		resolver: zodResolver(botInsertSchema) as Resolver<BotBuilderFormValues>,
		mode: "onSubmit",
		reValidateMode: "onChange",
		shouldFocusError: true,
		defaultValues: {
			name: initialData?.name ?? "",
			description: initialData?.description ?? "",
			contentJson: initialData?.contentJson ?? {},
			contentHtml: initialData?.contentHtml ?? "",
			blockIds: initialData?.blockIds ?? [],
		},
	});

	useEffect(() => {
		const blockIds = form.getValues("blockIds") ?? [];
		if (!blockIds.length) {
			return;
		}

		let templateId: string | undefined;
		const databaseIds: string[] = [];
		const unknownIds: string[] = [];

		blockIds.forEach((id) => {
			const block = blockMap.get(id);
			if (!block) {
				unknownIds.push(id);
				return;
			}

			if (block.type === "template" && !templateId) {
				templateId = block.id;
				return;
			}

			if (
				block.type === "database" &&
				databaseIds.length < MAX_DATABASE_BLOCKS
			) {
				databaseIds.push(block.id);
				return;
			}

			unknownIds.push(id);
		});

		const sanitized: string[] = [];
		if (templateId) {
			sanitized.push(templateId);
		}
		sanitized.push(...databaseIds, ...unknownIds);

		const isSameOrder =
			sanitized.length === blockIds.length &&
			sanitized.every((id, index) => id === blockIds[index]);

		if (!isSameOrder) {
			form.setValue("blockIds", sanitized, {
				shouldDirty: false,
				shouldTouch: false,
			});
		}
	}, [blockMap, form]);

	const handleSubmit = (data: BotBuilderFormValues) => {
		if (onSubmit) {
			onSubmit(data as BotInsert);
			return;
		}

		toast.success("Bot configuration saved!", {
			description: `${data.name} configured with ${data.blockIds.length} blocks`,
		});
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
				<FormValidationErrors form={form} />

				<BotBuilderDetailsCard form={form} />

				<BotBuilderBlocksSection form={form} blocks={allBlocks} />

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
