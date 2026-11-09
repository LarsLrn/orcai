import { useDisplayTime } from "@/hooks/use-display-time";

type DisplayTimeProps = {
	value: Date | string | number;
};

/** Date and time in the browser's time zone, safe to server-render. */
export const DisplayTimestamp = ({ value }: DisplayTimeProps) =>
	useDisplayTime().timestamp(value);

/** Date only in the browser's time zone, safe to server-render. */
export const DisplayDate = ({ value }: DisplayTimeProps) =>
	useDisplayTime().date(value);
