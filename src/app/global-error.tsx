"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary at the root layout. Renders a self-contained
 * HTML doc with no app shell — used when the layout itself crashes.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#0F0E2E",
          backgroundColor: "#EFEEFB",
          padding: "2rem",
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: "2rem",
            maxWidth: 480,
            boxShadow: "0 4px 24px rgba(15,14,46,0.08)",
          }}
        >
          <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "#5B4FCF", fontWeight: 700, marginBottom: 12 }}>
            GATEWAY TELNET · SOMETHING BROKE
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            The app crashed before it could load
          </h1>
          <p style={{ fontSize: 14, color: "#6B6B6B", marginBottom: 16 }}>
            This is rare — usually a stale cache or a deploy mid-flight. Refresh the
            page first; if it still fails, sign out and back in.
          </p>
          {error.digest && (
            <p style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#ABABAB", marginBottom: 16 }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              background: "#5B4FCF",
              color: "white",
              border: "none",
              padding: "0.625rem 1.25rem",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
