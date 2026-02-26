import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import { useBotMutations } from "@/hooks/mutations/use-bot-mutations";
import { orpc } from "@/lib/orpc/orpc";
import type { Block } from "@/lib/orpc/schemas/block";
import type { Bot } from "@/lib/orpc/schemas/bot";
import { botFormOptions } from "./bot-form-options";

interface BotBuilderFormProps {
	action: "create" | "update";
	bot?: Bot;
	blockIds?: Block["id"][];
}

const BotForm = ({ action, bot, blockIds }: BotBuilderFormProps) => {
	const { createBot, updateBot } = useBotMutations();

	const { data: blocksResponse } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: { pageIndex: 0, pageSize: 50 },
		}),
	);

	// TODO: Refactor this after changing the ORPC API to consume/return blocks by type
	const templateBlocks = useMemo<Block[]>(() => {
		return blocksResponse.data.filter((block) => block.type === "template");
	}, [blocksResponse]);

	const databaseBlocks = useMemo<Block[]>(() => {
		return blocksResponse.data.filter((block) => block.type === "database");
	}, [blocksResponse]);

	const imageGenerationBlocks = useMemo<Block[]>(() => {
		return blocksResponse.data.filter(
			(block) => block.type === "imageGeneration",
		);
	}, [blocksResponse]);

	const form = useAppForm({
		...botFormOptions(bot, blockIds),
		onSubmit: ({ value }) => {
			if (action === "update" && bot) {
				updateBot.run({ ...value, id: bot.id });
			} else {
				createBot.run(value);
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<Card>
				<CardHeader>
					<CardTitle>Bot Configuration</CardTitle>
					<CardDescription>
						Provide core information that helps teammates understand the bot's
						purpose and behavior
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<form.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label="Bot Name"
								placeholder="My Awesome Bot"
								description="A descriptive title that everyone can recognize"
							/>
						)}
					/>

					<form.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label="Short Description"
								placeholder="Short bot description"
							/>
						)}
					/>

					<form.AppField
						name="contentJson"
						children={(field) => (
							<field.BlockEditorField
								label="Bot Description"
								htmlFieldName="contentHtml"
							/>
						)}
					/>
				</CardContent>
			</Card>

			<form.AppField
				name="blockIds"
				children={(field) => (
					<field.MultiSelectField
						options={templateBlocks.map((block) => ({
							label: block.name,
							value: block.id,
						}))}
						label="Template Blocks"
					/>
				)}
			/>

			<form.AppField
				name="blockIds"
				children={(field) => (
					<field.MultiSelectField
						options={databaseBlocks.map((block) => ({
							label: block.name,
							value: block.id,
						}))}
						label="Database Blocks"
					/>
				)}
			/>

			<form.AppField
				name="blockIds"
				children={(field) => (
					<field.MultiSelectField
						options={imageGenerationBlocks.map((block) => ({
							label: block.name,
							value: block.id,
						}))}
						label="Image Generation Blocks"
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Save Bot" />
			</form.AppForm>
		</form>
	);
};

export { BotForm };
