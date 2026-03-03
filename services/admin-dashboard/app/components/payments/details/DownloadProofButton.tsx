"use client";

import React, { useState } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "@/app/components/ui/Button";

interface DownloadProofButtonProps {
  transactionId: string;
  fileName: string;
}

export function DownloadProofButton({ transactionId, fileName }: DownloadProofButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Ganti url
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/${transactionId}/download-proof`, {
        method: "GET",
        headers: {
          // "Authorization": `Bearer ${localStorage.getItem('access_token')}` 
        }
      });

      if (!response.ok) {
        throw new Error("Gagal mengunduh file bukti pembayaran.");
      }

      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error("Download error:", error);
      alert("Terjadi kesalahan saat mengunduh bukti pembayaran.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button 
      variant="blue" 
      size="sm"
      onClick={handleDownload}
      disabled={isDownloading}
      startIcon={
        isDownloading ? (
          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
        )
      }
    >
      {isDownloading ? "Downloading..." : "Download"}
    </Button>
  );
}