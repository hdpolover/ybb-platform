"use client";

import { useCallback, useRef, useState } from "react";
import {
  uploadFileViaPresignedUrl,
  type UploadContext,
  type UploadProgress,
  type UploadResult,
} from "@/src/shared/api-client";

export type UploadStatus = "idle" | "uploading" | "ready" | "error";

type State = {
  status: UploadStatus;
  progress: UploadProgress | null;
  result: UploadResult | null;
  error: Error | null;
};

/**
 * Single-file upload state machine with progress + cancel. Use this for flows
 * where a user picks one file and wants to see a progress bar (logo picker,
 * gallery photo modal, single document upload).
 *
 * For parallel batch uploads (media library multi-select), call
 * `uploadFileViaPresignedUrl` directly in a `Promise.allSettled` — the hook
 * only tracks one upload at a time.
 */
export function useFileUpload() {
  const [state, setState] = useState<State>({
    status: "idle",
    progress: null,
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle", progress: null, result: null, error: null });
  }, []);

  const start = useCallback(
    async (file: File, ctx: UploadContext): Promise<UploadResult | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ status: "uploading", progress: null, result: null, error: null });

      try {
        const result = await uploadFileViaPresignedUrl(
          file,
          ctx,
          (progress) => setState((prev) => ({ ...prev, progress })),
          controller.signal,
        );
        setState({
          status: "ready",
          progress: {
            loaded: file.size,
            total: file.size,
            percent: 100,
            speedBps: 0,
            etaSecs: 0,
          },
          result,
          error: null,
        });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const aborted = error.name === "AbortError";
        setState({
          status: aborted ? "idle" : "error",
          progress: null,
          result: null,
          error: aborted ? null : error,
        });
        return null;
      }
    },
    [],
  );

  return { ...state, start, cancel, reset };
}
