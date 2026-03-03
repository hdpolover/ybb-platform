"use client";

import React from "react";
import { Button } from "@/app/components/ui/Button";

export function DownloadCvButton({ fileName }: { fileName: string }) {
  const handleDownload = () => {
    alert(`Downloading ${fileName}... (Logic fetch blob disini nanti)`);
  };

  return (
    <Button variant="blue" size="sm" onClick={handleDownload}>
      Download
    </Button>
  );
}