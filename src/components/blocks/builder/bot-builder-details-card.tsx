import type { Content } from "@tiptap/core";
import type { UseFormReturn } from "react-hook-form";
import { BlockEditor } from "@/components/editor";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormTextField } from "@/components/forms/fields/form-text-field";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { BotBuilderFormValues } from "./bot-builder-form.types";

interface BotBuilderDetailsCardProps {
	form: UseFormReturn<BotBuilderFormValues>;
}

const BotBuilderDetailsCard = ({ form }: BotBuilderDetailsCardProps) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Bot Configuration</CardTitle>
				<CardDescription>
					Provide core information that helps teammates understand the bot's
					purpose and behavior
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<FormInputField
					form={form}
					name="name"
					inputType="text"
					placeholder="My Awesome Bot"
					label="Bot Name"
					required={true}
					description="A descriptive title that everyone can recognize"
				/>

				<FormTextField
					form={form}
					name="description"
					rows={3}
					label="Description"
					placeholder="Describe what this bot does..."
					required={false}
					description="Optional context about how and when to use this bot"
				/>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="font-medium text-sm">
							Course Description
							<span className="text-destructive"> *</span>
						</Label>
					</div>
					<BlockEditor
						content={form.getValues("contentJson") as Content}
						onUpdate={(editor) => {
							form.setValue("contentJson", editor.getJSON(), {
								shouldDirty: true,
							});
							form.setValue("contentHtml", editor.getHTML(), {
								shouldDirty: true,
							});
						}}
					/>
				</div>
			</CardContent>
		</Card>
	);
};

export { BotBuilderDetailsCard };
