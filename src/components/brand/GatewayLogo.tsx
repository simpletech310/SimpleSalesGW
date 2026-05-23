type Props = {
  variant?: "onLight" | "onDark";
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Gateway TelNet logo — italic "Gateway" + tracked-uppercase "TELNET" stacked.
 * Pure SVG so it scales crisply on retina + PWA splash.
 */
export function GatewayLogo({ variant = "onDark", size = "md", className = "" }: Props) {
  const fill = variant === "onDark" ? "#FFFFFF" : "var(--gtn-navy)";
  const dims = size === "sm" ? { w: 110, h: 36 } : size === "lg" ? { w: 220, h: 72 } : { w: 160, h: 52 };

  return (
    <svg
      width={dims.w}
      height={dims.h}
      viewBox="0 0 220 72"
      role="img"
      aria-label="Gateway TelNet"
      className={className}
    >
      <text
        x="0"
        y="38"
        fontFamily="Inter, system-ui, sans-serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="34"
        fill={fill}
        letterSpacing="-0.5"
      >
        Gateway
      </text>
      <text
        x="0"
        y="64"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="600"
        fontSize="14"
        fill={fill}
        letterSpacing="6"
      >
        TELNET
      </text>
    </svg>
  );
}
