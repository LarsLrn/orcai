import type { GenerationSettings } from "@orcai/schema";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { withFieldGroup } from "@/hooks/form";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

/** Maps the group onto a form whose generation settings sit at its top level. */
export const GENERATION_SETTINGS_FIELDS = {
	temperature: "temperature",
	maxTokens: "maxTokens",
	topP: "topP",
	frequencyPenalty: "frequencyPenalty",
	presencePenalty: "presencePenalty",
} as const;

/** The collapsed "Advanced generation settings" of a chat or a bot setup; unset values keep the provider's defaults. */
export const GenerationSettingsFieldGroup = withFieldGroup({
	defaultValues: {} as GenerationSettings,
	props: {
		maxOutputTokens: null as number | null,
	},
	render: function Render({ group, maxOutputTokens }) {
		const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

		return (
			<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
				<CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-muted/15 px-4 py-3 text-left">
					<div>
						<div className="font-medium text-sm">
							{m.chat_settings_advanced_title()}
						</div>
						<div className="text-muted-foreground text-sm">
							{m.chat_settings_advanced_description()}
						</div>
					</div>
					<ChevronDownIcon
						className={`h-4 w-4 transition-transform ${
							isAdvancedOpen ? "rotate-180" : ""
						}`}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent className="pt-4">
					<div className="flex flex-col gap-4">
						<group.AppField
							name="temperature"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_temperature_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={1}
									min={0}
									max={2}
									step={0.1}
									formatValue={(value) => value.toFixed(1)}
								/>
							)}
						/>

						<group.AppField
							name="topP"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_top_p_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={1}
									min={0}
									max={1}
									step={0.05}
									formatValue={(value) => value.toFixed(2)}
								/>
							)}
						/>

						<group.AppField
							name="maxTokens"
							validators={{
								onChange: ({ value }) =>
									value != null &&
									maxOutputTokens !== null &&
									value > maxOutputTokens
										? {
												message: reasonMessage(
													"CHAT_MAX_TOKENS_EXCEEDS_MODEL",
													{
														maxOutputTokens: maxOutputTokens,
													},
												),
											}
										: undefined,
							}}
							children={(field) => (
								<field.TextField
									label={m.chat_settings_max_tokens_label()}
									description={
										maxOutputTokens === null
											? undefined
											: m.chat_settings_max_tokens_description({
													maxOutputTokens: formatCount(maxOutputTokens),
												})
									}
									type="number"
									min={1}
									max={maxOutputTokens ?? undefined}
									placeholder={m.chat_settings_provider_default_placeholder()}
								/>
							)}
						/>

						<group.AppField
							name="frequencyPenalty"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_frequency_penalty_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={0}
									min={-2}
									max={2}
									step={0.1}
									formatValue={(value) => value.toFixed(1)}
								/>
							)}
						/>

						<group.AppField
							name="presencePenalty"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_presence_penalty_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={0}
									min={-2}
									max={2}
									step={0.1}
									formatValue={(value) => value.toFixed(1)}
								/>
							)}
						/>
					</div>
				</CollapsibleContent>
			</Collapsible>
		);
	},
});
