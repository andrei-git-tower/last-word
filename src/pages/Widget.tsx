import { useSearchParams } from "react-router-dom";
import { InterviewChat } from "@/components/InterviewChat";
import type { Insight } from "@/lib/constants";

export default function Widget() {
  const [searchParams] = useSearchParams();
  const apiKey = searchParams.get("key") ?? "";

  function handleInsight(_insight: Insight) {
    window.parent.postMessage({ type: "lastword:done" }, "*");
  }

  if (!apiKey) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Missing API key.</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background p-4 flex flex-col justify-center">
      <InterviewChat onInsight={handleInsight} apiKey={apiKey} autoStart />
    </div>
  );
}
