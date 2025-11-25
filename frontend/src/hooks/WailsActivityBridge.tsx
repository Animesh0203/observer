import { useEffect } from "react";
import { EventsOn } from "../../wailsjs/runtime/runtime.js";
import { useStatusBar } from "./useStatus";

export default function WailsActivityBridge() {
const { start, update, finish } = useStatusBar();

useEffect(() => {
  const stop = EventsOn("activity", (ev: any) => {
    const {
        id: ID,
        status: Status,
        label: Label,
        detail: Detail,
        percent: Percent,
    } = ev;

    if (Status === "start") {
      start({ id: ID, label: Label, detail: Detail });
    }

    if (Status === "progress") {
      update(ID, { progress: Percent, detail: Detail });
    }

    // FIXED: support "finish"
    if (Status === "finish") {
      finish(ID, true);
    }

    // Optional: support explicit statuses
    if (Status === "success") finish(ID, true);
    if (Status === "error") finish(ID, false);
  });

  return () => stop();
}, [start, update, finish]);

  return null;
}
