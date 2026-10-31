import { useEffect, useState } from "react";

/** Which sides of a horizontal scroller still hide content. */
export const useInlineOverflow = (element: HTMLElement | null) => {
	const [overflow, setOverflow] = useState({
		start: false,
		end: false,
	});

	useEffect(() => {
		if (!element) return;

		const update = () => {
			const start = element.scrollLeft > 0;
			const end =
				element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
			setOverflow((previous) =>
				previous.start === start && previous.end === end
					? previous
					: {
							start,
							end,
						},
			);
		};

		const resizes = new ResizeObserver(update);
		// Content can grow or shrink while the scroller keeps its size.
		const observe = () => {
			resizes.disconnect();
			resizes.observe(element);
			for (const child of element.children) resizes.observe(child);
			update();
		};
		const mutations = new MutationObserver(observe);

		observe();
		mutations.observe(element, {
			childList: true,
		});
		element.addEventListener("scroll", update, {
			passive: true,
		});

		return () => {
			element.removeEventListener("scroll", update);
			mutations.disconnect();
			resizes.disconnect();
		};
	}, [
		element,
	]);

	return overflow;
};
