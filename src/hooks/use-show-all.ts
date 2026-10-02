// A long list that shows its first few until asked for the rest (the button is ShowAllButton in
// components/show-all.tsx). Closing the list scrolls back up to it (put `box` on the list's
// container), since a long list closed from its far end leaves the page a long way below it.
import { useEffect, useRef, useState } from "react";

export function useShowAll<T extends HTMLElement>() {
  const [all, setAll] = useState(false);
  const box = useRef<T>(null);
  const closing = useRef(false);
  const toggle = () => {
    closing.current = all;
    setAll(!all);
  };
  useEffect(() => {
    if (!closing.current) return;
    closing.current = false;
    box.current?.scrollIntoView({ block: "start" });
  }, [all]);
  return { all, toggle, box };
}
