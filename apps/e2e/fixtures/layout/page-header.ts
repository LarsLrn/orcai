import type { Page } from "@playwright/test";

/** Thickness of a focus ring; an action closer than this to a clipping ancestor loses part of it. */
const FOCUS_RING = 3;

/**
 * What is wrong with the page headers on the open page: content that leaves
 * its header or the viewport, and header actions too close to a clipping
 * ancestor for their focus ring.
 */
export const pageHeaderProblems = (page: Page) =>
	page.evaluate((ring) => {
		type Box = {
			left: number;
			right: number;
			top: number;
			bottom: number;
		};
		type Element = {
			tagName: string;
			textContent: string | null;
			parentElement: Element | null;
			getBoundingClientRect: () => Box;
			querySelectorAll: (selector: string) => Iterable<Element>;
		};
		const browser = globalThis as unknown as {
			innerWidth: number;
			document: {
				documentElement: Element & {
					scrollWidth: number;
				};
				body: Element;
				querySelectorAll: (selector: string) => Iterable<Element>;
			};
			getComputedStyle: (element: Element) => {
				overflowX: string;
				overflowY: string;
			};
		};
		const { document } = browser;
		const problems: string[] = [];
		const label = (element: Element) =>
			`${element.tagName} "${(element.textContent ?? "").trim().slice(0, 20)}"`;

		const { scrollWidth } = document.documentElement;
		if (scrollWidth > browser.innerWidth) {
			problems.push(`page scrolls horizontally: ${scrollWidth}`);
		}

		for (const header of document.querySelectorAll("[data-slot=page-header]")) {
			const box = header.getBoundingClientRect();
			for (const element of header.querySelectorAll("*")) {
				const inner = element.getBoundingClientRect();
				if (
					inner.right - inner.left > 0 &&
					(inner.right > box.right + 0.5 || inner.left < box.left - 0.5)
				) {
					problems.push(`${label(element)} leaves its header`);
				}
			}

			for (const action of header.querySelectorAll("a,button")) {
				const inner = action.getBoundingClientRect();
				let clipper: Element | null = header;
				while (
					clipper &&
					browser.getComputedStyle(clipper).overflowX === "visible" &&
					browser.getComputedStyle(clipper).overflowY === "visible"
				) {
					clipper = clipper.parentElement;
				}
				if (!clipper || clipper === document.body) {
					continue;
				}
				const outer = clipper.getBoundingClientRect();
				const gap = Math.min(
					inner.left - outer.left,
					outer.right - inner.right,
					inner.top - outer.top,
					outer.bottom - inner.bottom,
				);
				if (gap < ring) {
					problems.push(`${label(action)} is ${gap}px from a clipping edge`);
				}
			}
		}
		return problems;
	}, FOCUS_RING);
