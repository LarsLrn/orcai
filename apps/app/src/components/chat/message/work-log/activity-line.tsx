import { useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";

/**
 * The running turn's current activity, below its answer so far. Mounted for
 * the whole turn, so its live region announces each new label once, shown or not.
 */
export const ActivityLine = ({
	label,
	shown = true,
	onShowSteps,
}: {
	/** Null while nothing is under way, such as when answer text streams. */
	label: string | null;
	/** Left false while the work log shows the activity in view. */
	shown?: boolean;
	/** Left out while the turn has no work log to show. */
	onShowSteps?: () => void;
}) => {
	const [announced, setAnnounced] = useState(label);
	if (label !== null && label !== announced) {
		setAnnounced(label);
	}

	const text = shown && label && <Shimmer as="span">{label}</Shimmer>;

	return (
		<>
			<span role="status" aria-live="polite" className="sr-only">
				{announced}
			</span>
			{text &&
				(onShowSteps ? (
					<button
						type="button"
						onClick={onShowSteps}
						className="not-prose w-fit text-left text-sm"
					>
						{text}
					</button>
				) : (
					<div className="not-prose text-sm">{text}</div>
				))}
		</>
	);
};
