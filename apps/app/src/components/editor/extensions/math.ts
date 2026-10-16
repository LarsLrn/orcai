import "katex/dist/katex.min.css";

import { mergeAttributes, Node } from "@tiptap/core";
import { render, renderToString } from "katex";

const katexOptions = {
	throwOnError: false,
};

const renderMathToString = (latex: string) =>
	renderToString(latex, katexOptions);

/** Inline LaTeX stored as `{ type: "math", attrs: { latex } }`. */
const MathExtension = Node.create({
	name: "math",
	group: "inline",
	inline: true,
	atom: true,
	marks: "",

	addAttributes() {
		return {
			latex: {
				default: "",
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-type="math"]',
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-type": this.name,
			}),
			node.attrs.latex,
		];
	},

	renderText({ node }) {
		return node.attrs.latex;
	},

	addNodeView() {
		return ({ node }) => {
			const dom = document.createElement("span");
			dom.dataset.type = this.name;
			render(node.attrs.latex, dom, katexOptions);

			return {
				dom,
			};
		};
	},
});

export { MathExtension, renderMathToString };
