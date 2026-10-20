import type { ProviderKind } from "@orcai/core";
import { m } from "@/paraglide/messages";

const providerKindLabels: Record<ProviderKind, () => string> = {
	"openai-compatible": m.providers_kind_openai_compatible_label,
	openai: m.providers_kind_openai_label,
	anthropic: m.providers_kind_anthropic_label,
};

export const getProviderKindLabel = (kind: ProviderKind) =>
	providerKindLabels[kind]();
