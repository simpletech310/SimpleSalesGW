"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { X, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v2.23 — Phone-camera barcode scanner.
 *
 * Wraps @zxing/browser's BrowserMultiFormatReader. Defaults to the
 * environment-facing camera + a hint set covering the codes most
 * commonly printed on IT-equipment labels:
 *   - QR (Cisco serial QR, Dell express service tags)
 *   - Code 128 + Code 39 (server serial bars)
 *   - DataMatrix (Dell + HP system tags)
 *   - EAN-13 / UPC-A (some consumer-ish gear)
 *
 * Renders as a fullscreen modal with a viewfinder + cancel/torch.
 * Vibrates on successful decode (where supported).
 */
export function BarcodeScanner({
  onScan,
  onClose,
  formats,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
  formats?: BarcodeFormat[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hints = new Map();
    hints.set(
      DecodeHintType.POSSIBLE_FORMATS,
      formats ?? [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.EAN_13,
        BarcodeFormat.UPC_A,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
      ],
    );
    const reader = new BrowserMultiFormatReader(hints);

    async function start() {
      if (!videoRef.current) return;
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              ctrl.stop();
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try { navigator.vibrate(50); } catch { /* ignore */ }
              }
              onScan(text);
              onClose();
            }
          },
        );
        controlsRef.current = controls;

        // Detect torch capability
        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()?.[0];
        if (track && "getCapabilities" in track) {
          const caps = (track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }) ?? {};
          if (caps.torch) setTorchSupported(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg.includes("Permission")
            ? "Camera permission denied. Allow access in your browser settings, then try again."
            : msg.includes("getUserMedia") || msg.includes("NotFoundError")
              ? "No camera detected. Open this page on your phone to scan."
              : `Scanner error: ${msg}`,
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* ignore */ }
    };
  }, [formats, onScan, onClose]);

  async function toggleTorch() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet & { torch?: boolean }] });
      setTorchOn(next);
    } catch {
      // Torch toggle failed — silently skip
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white">
        <span className="text-sm font-semibold">Scan barcode</span>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <Button size="sm" variant="ghost" onClick={toggleTorch} className="text-white hover:text-white">
              {torchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white p-6 text-center">
            <div>
              <p className="text-sm">{error}</p>
              <p className="text-xs text-white/60 mt-2">
                If you&apos;re on a desktop with no webcam, open this URL on your phone:
              </p>
              <code className="text-xs bg-white/10 px-2 py-1 rounded mt-1 inline-block">
                {typeof window !== "undefined" ? window.location.href : ""}
              </code>
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="border-2 border-white/80 rounded-md w-2/3 max-w-md h-1/3 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            <p className="absolute bottom-6 inset-x-0 text-center text-white/80 text-xs px-4">
              Hold the barcode steady in the frame — scans automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
