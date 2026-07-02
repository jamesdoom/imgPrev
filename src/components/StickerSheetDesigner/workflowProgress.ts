export type WorkflowStepStatus = "complete" | "current" | "waiting";

export type WorkflowStep = {
  description: string;
  label: "Upload" | "Arrange" | "Proof" | "Submit";
  status: WorkflowStepStatus;
};

export function getWorkflowSteps({
  assetCount,
  canExport,
  decalCount,
  isSubmitted,
}: {
  assetCount: number;
  canExport: boolean;
  decalCount: number;
  isSubmitted: boolean;
}): WorkflowStep[] {
  const hasArtwork = assetCount > 0;
  const hasDecals = decalCount > 0;
  const proofReady = hasDecals && canExport;

  return [
    {
      description: hasArtwork ? `${assetCount} uploaded` : "Add artwork",
      label: "Upload",
      status: hasArtwork ? "complete" : "current",
    },
    {
      description: hasDecals ? `${decalCount} on sheet` : "Place decals",
      label: "Arrange",
      status: hasDecals ? "complete" : hasArtwork ? "current" : "waiting",
    },
    {
      description: proofReady ? "Print checks pass" : "Resolve checks",
      label: "Proof",
      status: proofReady ? "complete" : hasDecals ? "current" : "waiting",
    },
    {
      description: isSubmitted ? "Sent for print" : "Submit for print",
      label: "Submit",
      status: isSubmitted ? "complete" : proofReady ? "current" : "waiting",
    },
  ];
}
