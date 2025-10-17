import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { BotBuilderBlocksSection } from "@/components/blocks/builder/bot-builder-blocks-section";
import { BotBuilderDetailsCard } from "@/components/blocks/builder/bot-builder-details-card";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { Block } from "@/lib/orpc/schemas/block";
import { type BotInsert, botInsertSchema } from "@/lib/orpc/schemas/bot";
import { blockQueryOptions } from "@/lib/query-options/block";

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

	const form = useForm<BotInsert>({
		resolver: zodResolver(botInsertSchema) as Resolver<BotInsert>,
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

	const handleSubmit = (data: BotInsert) => {
		if (onSubmit) {
			onSubmit(data);
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
