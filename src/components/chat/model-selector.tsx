import { CheckIcon } from "lucide-react";
import { useState } from "react";
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorLogoGroup,
	ModelSelectorName,
	ModelSelectorTrigger,
} from "../ai-elements/model-selector";
import { PromptInputButton } from "../ai-elements/prompt-input";

const models = [
	{
		id: "gpt-4o",
		name: "GPT-4o",
		chef: "OpenAI",
		chefSlug: "openai",
		providers: ["openai", "azure"],
	},
	{
		id: "gpt-4o-mini",
		name: "GPT-4o Mini",
		chef: "OpenAI",
		chefSlug: "openai",
		providers: ["openai", "azure"],
	},
	{
		id: "claude-opus-4-20250514",
		name: "Claude 4 Opus",
		chef: "Anthropic",
		chefSlug: "anthropic",
		providers: ["anthropic", "azure", "google", "amazon-bedrock"],
	},
	{
		id: "claude-sonnet-4-20250514",
		name: "Claude 4 Sonnet",
		chef: "Anthropic",
		chefSlug: "anthropic",
		providers: ["anthropic", "azure", "google", "amazon-bedrock"],
	},
	{
		id: "gemini-2.0-flash-exp",
		name: "Gemini 2.0 Flash",
		chef: "Google",
		chefSlug: "google",
		providers: ["google"],
	},
];

const ModelSelectorButton = () => {
	const [model, setModel] = useState<string>(models[0].id);
	const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

	const selectedModelData = models.find((m) => m.id === model);

	return (
		<ModelSelector onOpenChange={setModelSelectorOpen} open={modelSelectorOpen}>
			<ModelSelectorTrigger
				render={
					<PromptInputButton>
						{selectedModelData?.chefSlug && (
							<ModelSelectorLogo provider={selectedModelData.chefSlug} />
						)}
						{selectedModelData?.name && (
							<ModelSelectorName>{selectedModelData.name}</ModelSelectorName>
						)}
					</PromptInputButton>
				}
			/>
			<ModelSelectorContent>
				<ModelSelectorInput placeholder="Search models..." />
				<ModelSelectorList>
					<ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
					{["OpenAI", "Anthropic", "Google"].map((chef) => (
						<ModelSelectorGroup heading={chef} key={chef}>
							{models
								.filter((m) => m.chef === chef)
								.map((m) => (
									<ModelSelectorItem
										key={m.id}
										onSelect={() => {
											setModel(m.id);
											setModelSelectorOpen(false);
										}}
										value={m.id}
									>
										<ModelSelectorLogo provider={m.chefSlug} />
										<ModelSelectorName>{m.name}</ModelSelectorName>
										<ModelSelectorLogoGroup>
											{m.providers.map((provider) => (
												<ModelSelectorLogo key={provider} provider={provider} />
											))}
										</ModelSelectorLogoGroup>
										{model === m.id ? (
											<CheckIcon className="ml-auto size-4" />
										) : (
											<div className="ml-auto size-4" />
										)}
									</ModelSelectorItem>
								))}
						</ModelSelectorGroup>
					))}
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
};

export { ModelSelectorButton };
