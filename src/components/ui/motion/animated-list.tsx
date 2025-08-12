import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

interface AnimatedListProps<T> {
	items: T[];
	children: (item: T, index: number) => ReactNode;
	keyExtractor: (item: T, index: number) => string | number;
	className?: string;
	staggerDelay?: number;
	duration?: number;
}

const AnimatedList = <T,>({
	items,
	children,
	keyExtractor,
	className,
	staggerDelay = 0.15,
	duration = 0.4,
}: AnimatedListProps<T>) => {
	return (
		<div className={className}>
			<AnimatePresence mode="popLayout">
				{items.map((item, index) => (
					<motion.div
						key={keyExtractor(item, index)}
						initial={{ opacity: 0 }}
						animate={{
							opacity: 1,
							transition: {
								duration,
								delay: index * staggerDelay,
								ease: "easeOut",
							},
						}}
						exit={{
							opacity: 0,
							transition: {
								duration: duration * 0.8,
								delay: (items.length - 1 - index) * (staggerDelay * 0.6),
								ease: "easeIn",
							},
						}}
						layout
					>
						{children(item, index)}
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
};

export { AnimatedList };
