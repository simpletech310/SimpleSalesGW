"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BarcodeScanner } from "./BarcodeScanner";

/**
 * v2.23 — Drop-in "scan barcode" button + scanner modal pair.
 *
 * Usage:
 *   <ScanButton onScan={(text) => setSerialNumber(text)} />
 *
 * Renders nothing on the page until clicked; on click opens the
 * fullscreen BarcodeScanner. On successful decode, fires onScan
 * with the raw decoded text and auto-closes the modal.
 */
export function ScanButton({
  onScan,
  label = "Scan",
  size = "sm",
}: {
  onScan: (text: string) => void;
  label?: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size={size} onClick={() => setOpen(true)}>
        <ScanLine className="h-3.5 w-3.5 mr-1" />
        {label}
      </Button>
      {open && <BarcodeScanner onScan={onScan} onClose={() => setOpen(false)} />}
    </>
  );
}
