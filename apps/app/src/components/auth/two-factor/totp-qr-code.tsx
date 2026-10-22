import { encode } from "uqr";

/** The authenticator setup link as a QR code, dark on light in either theme. */
export const TotpQrCode = ({ uri, label }: { uri: string; label: string }) => {
	const { data, size } = encode(uri, {
		border: 2,
	});
	const path = data
		.flatMap((row, y) =>
			row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")),
		)
		.join("");

	return (
		<svg
			viewBox={`0 0 ${size} ${size}`}
			className="size-48 rounded-lg bg-white text-black"
			shapeRendering="crispEdges"
			role="img"
			aria-label={label}
		>
			<path d={path} fill="currentColor" />
		</svg>
	);
};
