import { mountPanel, type PanelOptions } from "@wishkit/dom";
import { useEffect, useRef } from "react";

export type PanelProps = PanelOptions;

/** The floating wish panel, shared with the other frameworks' adapters and mounted here. */
export function Panel({ runtime, wishes, wisher, apiKey }: PanelProps) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => mountPanel(host.current!, { runtime, wishes, wisher, apiKey }), [runtime, wishes, wisher, apiKey]);
  return <div ref={host} style={{ display: "contents" }} />;
}
