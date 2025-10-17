import { type Editor, isTextSelection } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NodeSelector, TextAlignSelector, TextButtons } from "./selectors";

export const DefaultBubbleMenu = ({ editor }: { editor: Editor }) => {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft] = useState(false);
	const [canScrollRight] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [startX, setStartX] = useState(0);
	const [startScrollLeft, setStartScrollLeft] = useState(0);

	const handleMouseDown = (e: React.MouseEvent) => {
		const container = scrollContainerRef.current;
		if (!container) return;

		setIsDragging(true);
		setStartX(e.pageX - container.offsetLeft);
		setStartScrollLeft(container.scrollLeft);
		container.style.cursor = "grabbing";
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging) return;

		e.preventDefault();
		const container = scrollContainerRef.current;
		if (!container) return;

		const x = e.pageX - container.offsetLeft;
		const walk = (x - startX) * 2; // Adjust scroll speed
		container.scrollLeft = startScrollLeft - walk;
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		const container = scrollContainerRef.current;
		if (container) {
			container.style.cursor = "grab";
		}
	};

	const handleMouseLeave = () => {
		setIsDragging(false);
		const container = scrollContainerRef.current;
		if (container) {
			container.style.cursor = "grab";
		}
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		const container = scrollContainerRef.current;
		if (!container) return;

		setIsDragging(true);
		setStartX(e.touches[0].pageX - container.offsetLeft);
		setStartScrollLeft(container.scrollLeft);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (!isDragging) return;

		const container = scrollContainerRef.current;
		if (!container) return;

		const x = e.touches[0].pageX - container.offsetLeft;
		const walk = (x - startX) * 2;
		container.scrollLeft = startScrollLeft - walk;
	};

	const handleTouchEnd = () => {
		setIsDragging(false);
	};

	const handleScrollLeft = () => {
		const container = scrollContainerRef.current;
		if (!container) return;

		container.scrollBy({ left: -100, behavior: "smooth" });
	};

	const handleScrollRight = () => {
		const container = scrollContainerRef.current;
		if (!container) return;

		container.scrollBy({ left: 100, behavior: "smooth" });
	};

	if (!editor) {
		return null;
	}

	return (
		<BubbleMenu
			editor={editor}
			options={{
				placement: "top",
			}}
			shouldShow={({ editor, state }) => {
				const { selection } = state;
				const { empty } = selection;

				if (!editor.isEditable) {
					return false;
				}

				if (empty) {
					return false;
				}

				if (!isTextSelection(selection)) {
					return false;
				}

				if (editor.isActive("codeBlock")) {
					return false;
				}

				return true;
			}}
		>
			<div className="relative max-w-[90vw] overflow-hidden rounded-md border bg-popover shadow-xl">
				{/* Left scroll indicator */}
				{canScrollLeft && (
					<button
						type="button"
						onClick={handleScrollLeft}
						className="absolute top-0 left-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-r from-popover/95 via-popover/80 to-transparent transition-colors duration-200 hover:from-popover"
					>
						<ChevronLeft className="h-4 w-4 text-foreground drop-shadow-sm" />
					</button>
				)}

				{/* Right scroll indicator */}
				{canScrollRight && (
					<button
						type="button"
						onClick={handleScrollRight}
						className="absolute top-0 right-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-l from-popover/95 via-popover/80 to-transparent transition-colors duration-200 hover:from-popover"
					>
						<ChevronRight className="h-4 w-4 text-foreground drop-shadow-sm" />
					</button>
				)}

				{/* Scrollable content */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Drag to scroll functionality requires mouse/touch events */}
				<div
					ref={scrollContainerRef}
					className={cn(
						"scrollbar-hide flex h-9 select-none overflow-x-auto rounded-md",
						"cursor-grab active:cursor-grabbing",
					)}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					style={{
						scrollbarWidth: "none", // Firefox
						msOverflowStyle: "none", // IE/Edge
					}}
				>
					<NodeSelector editor={editor} />
					<Separator orientation="vertical" />
					<TextButtons editor={editor} />
					<Separator orientation="vertical" />
					<TextAlignSelector editor={editor} />
				</div>
			</div>
		</BubbleMenu>
	);
};
