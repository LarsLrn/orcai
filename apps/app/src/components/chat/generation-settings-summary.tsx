import type { GenerationSettings } from "@orcai/schema";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

/** Read-only generation settings, such as a bot's required ones; unset values keep the provider's defaults. */
const GenerationSettingsSummary = ({
	generation,
}: {
	generation: GenerationSettings;
}) => {
	const entries = [
		[
			m.chat_settings_temperature_label(),
			generation.temperature?.toFixed(1),
		],
		[
			m.chat_settings_top_p_label(),
			generation.topP?.toFixed(2),
		],
		[
			m.chat_settings_max_tokens_label(),
			generation.maxTokens === undefined
				? undefined
				: formatCount(generation.maxTokens),
		],
		[
			m.chat_settings_frequency_penalty_label(),
			generation.frequencyPenalty?.toFixed(1),
		],
		[
			m.chat_settings_presence_penalty_label(),
			generation.presencePenalty?.toFixed(1),
		],
	].filter(
		(
			entry,
		): entry is [
			string,
			string,
		] => entry[1] !== undefined,
	);

	if (entries.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				{m.generation_settings_provider_defaults()}
			</p>
		);
	}

	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			{entries.map(([label, value]) => (
				<div key={label} className="contents">
					<dt className="text-muted-foreground">{label}</dt>
					<dd className="tabular-nums">{value}</dd>
				</div>
			))}
		</dl>
	);
};

export { GenerationSettingsSummary };
