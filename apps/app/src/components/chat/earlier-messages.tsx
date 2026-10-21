import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useConversationViewport } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { m } from "@/paraglide/messages";

const LOAD_THRESHOLD_PX = 400;

const statusClassName =
	"absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background px-3 py-1.5 text-muted-foreground text-xs shadow-sm ring-1 ring-border";

/** Loads older pages when the reader nears the top, with its status floating above the transcript. */
const EarlierMessages = ({
	hasEarlier,
	loadEarlier: load,
	firstMessageId,
}: {
	hasEarlier: boolean;
	/** Prepends the previous page and resolves whether more remain. */
	loadEarlier: () => Promise<boolean>;
	firstMessageId?: string;
}) => {
	const scrollRef = useConversationViewport();
	const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">(
		hasEarlier ? "idle" : "done",
	);
	const inFlight = useRef(false);

	const loadEarlier = async () => {
		if (status === "done" || inFlight.current) {
			return;
		}

		inFlight.current = true;
		setStatus("loading");

		try {
			const hasMore = await load();
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

	useEffect(() => {
		if (firstMessageId !== undefined) fillViewport();
	}, [
		firstMessageId,
	]);

	if (status === "loading") {
		return (
			<div role="status" className={statusClassName}>
				<Spinner aria-hidden="true" className="size-3" />
				{m.chat_earlier_messages_loading()}
			</div>
		);
	}

	if (status === "error") {
		return (
			<div role="alert" className={statusClassName}>
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
