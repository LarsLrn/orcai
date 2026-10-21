import {
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { m } from "@/paraglide/messages";

const LOAD_THRESHOLD_PX = 400;

/**
 * Loads older pages when the reader nears the top and keeps the visible
 * messages in place while a page is prepended.
 */
const EarlierMessages = ({
	hasEarlier,
	loadEarlier: load,
	firstMessageId,
}: {
	hasEarlier: boolean;
	/** Prepends the previous page, running `beforePrepend` first, and resolves whether more remain. */
	loadEarlier: (beforePrepend: () => void) => Promise<boolean>;
	firstMessageId?: string;
}) => {
	const { scrollRef } = useStickToBottomContext();
	const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">(
		hasEarlier ? "idle" : "done",
	);
	const inFlight = useRef(false);
	const anchor = useRef<{
		firstMessageId?: string;
		scrollHeight: number;
		scrollTop: number;
	} | null>(null);

	const loadEarlier = async () => {
		if (status === "done" || inFlight.current) {
			return;
		}

		inFlight.current = true;
		setStatus("loading");

		try {
			const hasMore = await load(() => {
				const scroller = scrollRef.current;
				if (scroller) {
					anchor.current = {
						firstMessageId,
						scrollHeight: scroller.scrollHeight,
						scrollTop: scroller.scrollTop,
					};
				}
			});
			setStatus(hasMore ? "idle" : "done");
		} catch {
			setStatus("error");
		} finally {
			inFlight.current = false;
		}
	};

	const onScroll = useEffectEvent(() => {
		const scroller = scrollRef.current;
		if (
			status === "idle" &&
			scroller &&
			scroller.scrollTop < LOAD_THRESHOLD_PX
		) {
			void loadEarlier();
		}
	});

	// A page too short to scroll never reaches the threshold on its own.
	const fillViewport = useEffectEvent(() => {
		const scroller = scrollRef.current;
		if (
			status === "idle" &&
			scroller &&
			scroller.scrollHeight <= scroller.clientHeight
		) {
			void loadEarlier();
		}
	});

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;

		const handleScroll = () => onScroll();
		scroller.addEventListener("scroll", handleScroll, {
			passive: true,
		});
		return () => scroller.removeEventListener("scroll", handleScroll);
	}, [
		scrollRef,
	]);

	// Hold the previous first message where it was instead of letting the prepended page push it down.
	useLayoutEffect(() => {
		const scroller = scrollRef.current;
		const saved = anchor.current;
		if (!scroller || !saved || saved.firstMessageId === firstMessageId) return;

		anchor.current = null;
		scroller.scrollTop =
			saved.scrollTop + scroller.scrollHeight - saved.scrollHeight;
	}, [
		firstMessageId,
		scrollRef,
	]);

	useEffect(() => {
		if (firstMessageId !== undefined) fillViewport();
	}, [
		firstMessageId,
	]);

	if (status === "loading") {
		return (
			<div
				role="status"
				className="flex items-center justify-center gap-2 text-muted-foreground text-xs"
			>
				<Spinner aria-hidden="true" className="size-3" />
				{m.chat_earlier_messages_loading()}
			</div>
		);
	}

	if (status === "error") {
		return (
			<div
				role="alert"
				className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground text-xs"
			>
				{m.chat_earlier_messages_failed()}
				<Button variant="outline" size="xs" onClick={() => void loadEarlier()}>
					{m.common_retry_button()}
				</Button>
			</div>
		);
	}

	return null;
};

export { EarlierMessages };
