import { type FeatureId, type Features, featureIdSchema } from "@orcai/schema";
import { SparklesIcon } from "lucide-react";
import {
	featureDescription,
	featureLabel,
} from "@/components/features/feature-labels";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const enabledFeatureIds = (features: Features): FeatureId[] =>
	featureIdSchema.options.filter((id) => features[id] !== undefined);

const FeatureBadges = ({
	features,
	className,
}: {
	features: Features;
	className?: string;
}) => {
	const ids = enabledFeatureIds(features);
	if (ids.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap gap-1.5", className)}>
			{ids.map((id) => (
				<Badge
					key={id}
					variant="outline"
					className="px-2.5 font-medium"
					title={featureDescription(id)}
				>
					<SparklesIcon />
					{featureLabel(id)}
				</Badge>
			))}
		</div>
	);
};

export { enabledFeatureIds, FeatureBadges };
