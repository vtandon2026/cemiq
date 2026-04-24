// PATH: frontend/components/ui/ChartActions.tsx
// Reusable CSV + PPT button row used on every chart page
"use client";
import DownloadButton from "./DownloadButton";

interface Props {
  onCsv: () => void;
  onPpt?: () => void;
  onPng?: () => void;
  csvDisabled?: boolean;
  pptDisabled?: boolean;
  pngDisabled?: boolean;
  csvLoading?: boolean;
  pptLoading?: boolean;
  pngLoading?: boolean;
  showPpt?: boolean;
  showPng?: boolean;
}

export default function ChartActions({
  onCsv,
  onPpt,
  onPng,
  csvDisabled = false,
  pptDisabled = false,
  pngDisabled = false,
  csvLoading = false,
  pptLoading = false,
  pngLoading = false,
  showPpt = true,
  showPng = false,
}: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <DownloadButton
        variant="csv"
        onClick={onCsv}
        disabled={csvDisabled}
        loading={csvLoading}
      />
      {showPng && onPng && (
        <DownloadButton
          variant="png"
          onClick={onPng}
          disabled={pngDisabled}
          loading={pngLoading}
        />
      )}
      {showPpt && onPpt && (
        <DownloadButton
          variant="ppt"
          onClick={onPpt}
          disabled={pptDisabled}
          loading={pptLoading}
        />
      )}
    </div>
  );
}