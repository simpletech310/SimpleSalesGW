import Image from "next/image";

type Props = {
  variant?: "onLight" | "onDark";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Set true for the largest above-the-fold instance (login + sidebar). */
  priority?: boolean;
};

/**
 * v3.3.25 — Real Gateway TelNet brand lockup (the same PNG served on
 * gatewaytelnet.com at /wp-content/uploads/gateway-header.png). The old
 * SVG-text placeholder lived here for offline-first crispness; now we
 * use the actual published mark so the operational portal matches the
 * marketing site.
 *
 * Variants:
 *   onLight — PNG renders directly on a light surface (black wordmark
 *             + purple swoosh on whatever's behind it).
 *   onDark  — PNG wrapped in a white-pill container so the black
 *             wordmark stays readable against navy. No second inverted
 *             asset to ship + drift over time.
 *
 * Sizes track the source PNG's ~200×70 aspect ratio.
 */
export function GatewayLogo({
  variant = "onDark",
  size = "md",
  className = "",
  priority = false,
}: Props) {
  const dims =
    size === "sm" ? { w: 110, h: 38 } :
    size === "lg" ? { w: 220, h: 76 } :
                    { w: 160, h: 55 };

  const img = (
    <Image
      src="/icons/gateway-header.png"
      alt="Gateway TelNet"
      width={dims.w}
      height={dims.h}
      priority={priority}
      // Crisp on retina + correct aspect when the container constrains.
      style={{ height: "auto", width: "auto", maxWidth: `${dims.w}px`, maxHeight: `${dims.h}px` }}
    />
  );

  if (variant === "onDark") {
    // White pill keeps the black wordmark readable against navy without
    // shipping a separate inverted asset.
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-white px-2 py-1 ${className}`}
      >
        {img}
      </span>
    );
  }

  return <span className={`inline-flex items-center ${className}`}>{img}</span>;
}
