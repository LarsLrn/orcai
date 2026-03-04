import { type Easing, motion } from "motion/react";
import { useTheme } from "next-themes";
import type React from "react";

const AnimatedPath = ({
	d,
	transform,
	color,
	delay = 0,
	duration = 2,
	strokeWidth = "10px",
	animateOffset = 1,
	animatePathLength = 1,
	ease = "linear",
	baseRepeatDelay = 4,
	speedMultiplier = 1,
}: {
	d: string;
	transform?: string;
	color: string;
	delay?: number;
	duration?: number;
	strokeWidth?: string;
	animateOffset?: number | number[];
	animatePathLength?: number | number[];
	ease?: Easing | Easing[];
	baseRepeatDelay?: number;
	speedMultiplier?: number;
}) => {
	const adjustedDelay = delay / speedMultiplier;
	const adjustedDuration = duration / speedMultiplier;
	const adjustedRepeatDelay = baseRepeatDelay / speedMultiplier;

	return (
		<g transform={transform}>
			<motion.path
				d={d}
				style={{
					fill: "none",
					stroke: color,
					strokeWidth: strokeWidth,
					strokeLinecap: "round",
				}}
				initial={{
					pathLength: 0,
					pathOffset: 0,
					opacity: 0,
				}}
				animate={{
					pathLength: animatePathLength,
					pathOffset: animateOffset,
					opacity: [
						0,
						1,
						1,
						1,
						0,
					],
				}}
				transition={{
					delay: adjustedDelay,
					duration: adjustedDuration,
					ease,
					repeat: Number.POSITIVE_INFINITY,
					repeatDelay: adjustedRepeatDelay - adjustedDuration,
				}}
			/>
		</g>
	);
};

const AnimatedCircle = ({
	cx,
	cy,
	r,
	transform,
	color,
	delay = 0,
	duration = 0.5,
	strokeWidth = "15px",
	baseRepeatDelay = 4,
	speedMultiplier = 1,
}: {
	cx: string;
	cy: string;
	r: string;
	transform?: string;
	color: string;
	delay?: number;
	duration?: number;
	strokeWidth?: string;
	baseRepeatDelay?: number;
	speedMultiplier?: number;
}) => {
	const adjustedDelay = delay / speedMultiplier;
	const adjustedDuration = duration / speedMultiplier;
	const adjustedRepeatDelay = baseRepeatDelay / speedMultiplier;

	return (
		<g transform={transform}>
			<motion.circle
				cx={cx}
				cy={cy}
				r={r}
				style={{
					fill: "none",
					stroke: color,
					strokeWidth,
				}}
				initial={{
					opacity: 0,
				}}
				animate={{
					opacity: [
						0,
						1,
						1,
						1,
						1,
						0.9,
						0.8,
						0.5,
						0.4,
						0.3,
						0.2,
						0,
					],
				}}
				transition={{
					delay: adjustedDelay,
					duration: adjustedDuration,
					ease: "easeOut",
					repeat: Number.POSITIVE_INFINITY,
					repeatDelay: adjustedRepeatDelay - adjustedDuration,
				}}
			/>
		</g>
	);
};

const LogoAnimated = ({
	className,
	width = "100%",
	height = "100%",
	variant = "color",
	speed = 1.5,
	...props
}: {
	className?: string;
	width?: string | number;
	height?: string | number;
	variant?: "white" | "black" | "color" | "dynamic";
	speed?: number;
} & React.ComponentProps<"div">) => {
	const { resolvedTheme } = useTheme();

	const colors = {
		white: {
			primary: "rgb(255,255,255)",
			secondary: "rgb(255,255,255)",
			background: "rgb(220,220,220)",
		},
		black: {
			primary: "rgb(0,0,0)",
			secondary: "rgb(0,0,0)",
			background: "rgb(220,220,220)",
		},
		color: {
			primary: "rgb(8,71,101)",
			secondary: "rgb(15,130,126)",
			background: "rgb(200,200,200)",
		},
		dynamic: {
			primary: resolvedTheme === "dark" ? "rgb(255,255,255)" : "rgb(8,71,101)",
			secondary:
				resolvedTheme === "dark" ? "rgb(255,255,255)" : "rgb(15,130,126)",
			background: "rgb(200,200,200)",
		},
	};

	const currentColors = colors[variant];

	const pathData = {
		finalConnection: "M976.663,923.824L913.238,974.176L846.539,959.137",
		neuralEndpointConnection: "M896.157,1241.78L949.298,1311.04",
		mainNeuralNetwork:
			"M1447.99,1894.86L1569.99,2027.86L1711.41,1780.43L1567.99,1533L1270.53,1533L1139.99,1780.43L1328.99,1855.86L1501.99,1718.86L1501.99,1667.86",
		branchSplit: "M1064.05,1298.57L1110.35,1356.36",
		mainInput:
			"M1171.99,1581.86L1083.99,1581.86C1030.99,1581.86 983.989,1608.86 983.989,1665.86L983.989,1860.86C983.989,1916.86 1023.99,1951.86 1075.99,1955.86L1075.99,2039.86L1164.99,1957.86L1355.99,1957.86C1379.99,1957.86 1401.99,1941.07 1401.99,1916.86L1401.99,1871.86L1572.04,1736.48",
	};

	const transformData = {
		finalConnection: undefined,
		neuralEndpointConnection:
			"matrix(-1.21961,-0.212654,-0.212671,-1.28052,2378.62,2750.69)",
		mainNeuralNetwork: "matrix(1,0,0,1,-423.989,-785.861)",
		branchSplit:
			"matrix(0.944908,5.55215e-17,-5.55215e-17,0.944908,87.4688,-228.824)",
		mainInput: "matrix(1,0,0,1,-423.989,-785.861)",
	};

	const circleData = {
		cx: "998.742",
		cy: "1187.14",
		r: "29.919",
		transforms: {
			finalConnectionCircle: "matrix(0.83525,0,0,0.83525,-16.189,-38.7085)",
			neuralEndpointCircle: "matrix(0.83525,0,0,0.83525,90.3217,-143.509)",
			mainNeuralCircle: "matrix(0.83525,0,0,0.83525,243.791,-138.174)",
			branchSplitCircle: "matrix(0.83525,0,0,0.83525,322.169,86.2419)",
			mainInputCircle: "matrix(0.83525,0,0,0.83525,335.491,-58.376)",
		},
	};

	// Speed adjustment - higher speed values make animation faster
	const speedMultiplier = Math.max(0.1, speed); // Prevent division by zero or negative speeds
	const baseRepeatDelay = 4; // Base repeat delay in seconds
	const adjustedRepeatDelay = baseRepeatDelay / speedMultiplier;

	return (
		<div {...props}>
			<svg
				width="100%"
				height="100%"
				viewBox="0 0 1075 714"
				version="1.1"
				xmlns="http://www.w3.org/2000/svg"
				xmlnsXlink="http://www.w3.org/1999/xlink"
				xmlSpace="preserve"
				className={className}
				style={{
					fillRule: "evenodd",
					clipRule: "evenodd",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					strokeMiterlimit: 1.5,
				}}
			>
				<title>SokratesT</title>
				<g transform="matrix(1,0,0,1,-1197,-2600)">
					<g transform="matrix(1.07715,0,0,0.765273,684.275,2117.88)">
						<g transform="matrix(0.928372,0,0,1.30672,105.58,-195.849)">
							{/* Background elements - drawn first */}
							<g>
								{/* Path backgrounds */}
								<g transform={transformData.finalConnection}>
									<path
										d={pathData.finalConnection}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "10px",
										}}
									/>
								</g>
								<g transform={transformData.neuralEndpointConnection}>
									<path
										d={pathData.neuralEndpointConnection}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "10px",
										}}
									/>
								</g>
								<g transform={transformData.mainNeuralNetwork}>
									<path
										d={pathData.mainNeuralNetwork}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "10px",
										}}
									/>
								</g>
								<g transform={transformData.branchSplit}>
									<path
										d={pathData.branchSplit}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "10px",
										}}
									/>
								</g>
								<g transform={transformData.mainInput}>
									<path
										d={pathData.mainInput}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "10px",
										}}
									/>
								</g>

								{/* Circle backgrounds */}
								<g transform={circleData.transforms.finalConnectionCircle}>
									<circle
										cx={circleData.cx}
										cy={circleData.cy}
										r={circleData.r}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "15px",
										}}
									/>
								</g>
								<g transform={circleData.transforms.neuralEndpointCircle}>
									<circle
										cx={circleData.cx}
										cy={circleData.cy}
										r={circleData.r}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "15px",
										}}
									/>
								</g>
								<g transform={circleData.transforms.mainNeuralCircle}>
									<circle
										cx={circleData.cx}
										cy={circleData.cy}
										r={circleData.r}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "15px",
										}}
									/>
								</g>
								<g transform={circleData.transforms.branchSplitCircle}>
									<circle
										cx={circleData.cx}
										cy={circleData.cy}
										r={circleData.r}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "15px",
										}}
									/>
								</g>
								<g transform={circleData.transforms.mainInputCircle}>
									<circle
										cx={circleData.cx}
										cy={circleData.cy}
										r={circleData.r}
										style={{
											fill: "none",
											stroke: currentColors.background,
											strokeWidth: "15px",
										}}
									/>
								</g>
							</g>

							{/* Animated elements - drawn on top */}
							<g>
								{/* Final connecting path to endpoints */}
								<AnimatedPath
									d={pathData.finalConnection}
									transform={transformData.finalConnection}
									color={currentColors.primary}
									delay={1.87}
									duration={1.25}
									animateOffset={[
										0,
										0,
										0,
										0,
										0,
										0,
										0,
										0,
										0.8,
										1,
									]}
									animatePathLength={[
										0,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
									]}
									ease="easeOut"
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>
								<AnimatedCircle
									cx={circleData.cx}
									cy={circleData.cy}
									r={circleData.r}
									transform={circleData.transforms.finalConnectionCircle}
									color={currentColors.primary}
									delay={1.9}
									duration={2}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>

								{/* Connection to neural endpoints */}
								<AnimatedPath
									d={pathData.neuralEndpointConnection}
									transform={transformData.neuralEndpointConnection}
									color={currentColors.primary}
									delay={1.85}
									duration={1.25}
									animateOffset={[
										0,
										0,
										0,
										0,
										0,
										0,
										0,
										0,
										0.8,
										1,
									]}
									animatePathLength={[
										0,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
									]}
									ease="easeOut"
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>
								<AnimatedCircle
									cx={circleData.cx}
									cy={circleData.cy}
									r={circleData.r}
									transform={circleData.transforms.neuralEndpointCircle}
									color={currentColors.primary}
									delay={1.9}
									duration={2}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>

								{/* Main neural network path - complex branching structure */}
								<AnimatedPath
									d={pathData.mainNeuralNetwork}
									transform={transformData.mainNeuralNetwork}
									color={currentColors.primary}
									delay={0.75}
									duration={2.5}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>
								<AnimatedCircle
									cx={circleData.cx}
									cy={circleData.cy}
									r={circleData.r}
									transform={circleData.transforms.mainNeuralCircle}
									color={currentColors.primary}
									delay={1.9}
									duration={2}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>

								{/* Branch that splits from main path - starts when main path reaches it */}
								<AnimatedPath
									d={pathData.branchSplit}
									transform={transformData.branchSplit}
									color={currentColors.secondary}
									delay={1.8}
									duration={0.8}
									animateOffset={[
										0,
										0,
										0,
										0,
										0.8,
										1,
									]}
									animatePathLength={[
										0,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
										1,
									]}
									ease="easeOut"
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>
								<AnimatedCircle
									cx={circleData.cx}
									cy={circleData.cy}
									r={circleData.r}
									transform={circleData.transforms.branchSplitCircle}
									color={currentColors.secondary}
									delay={1.9}
									duration={2}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>

								{/* Main input path - starts the animation */}
								<AnimatedCircle
									cx={circleData.cx}
									cy={circleData.cy}
									r={circleData.r}
									transform={circleData.transforms.mainInputCircle}
									color={currentColors.secondary}
									delay={1.9}
									duration={2}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>
								<AnimatedPath
									d={pathData.mainInput}
									transform={transformData.mainInput}
									color={currentColors.secondary}
									delay={0.3}
									duration={2.4}
									animateOffset={[
										0,
										0,
										0.1,
										0.2,
										0.5,
										1,
									]}
									baseRepeatDelay={adjustedRepeatDelay}
									speedMultiplier={speedMultiplier}
								/>
							</g>
						</g>
					</g>
				</g>
			</svg>
		</div>
	);
};

export { LogoAnimated };
