import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function subscribe(onStoreChange: () => void) {
	const query = window.matchMedia(QUERY);
	query.addEventListener("change", onStoreChange);
	return () => query.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
	return window.matchMedia(QUERY).matches;
}

export default function usePointerCoarse(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}