const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring filled by a share, 0 to 1; an emphasised track carries a tint even when nearly empty. */
const UsageRing = ({
	share,
	emphasised = false,
}: {
	share: number;
	emphasised?: boolean;
}) => (
	<svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden="true">
		<circle
			cx="12"
			cy="12"
			r={RADIUS}
			fill="none"
			stroke="currentColor"
			strokeOpacity={emphasised ? 0.6 : 0.25}
			strokeWidth="2.5"
		/>
		{share > 0 && (
			<circle
				cx="12"
				cy="12"
				r={RADIUS}
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeDasharray={CIRCUMFERENCE}
				strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(share, 1))}
			/>
		)}
	</svg>
);

export { UsageRing };
