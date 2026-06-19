// Marca VeChat: burbuja de chat con la "V" dentro. 3 variantes:
//   color   → burbuja verde + V blanca   (fondos claros)
//   reverse → burbuja blanca + V verde    (fondos oscuros)
//   mono    → burbuja espresso + V blanca (un solo color)
// Solo el ícono (sin el wordmark "VeChat", que lo pone quien lo usa).
const GREEN = "#10A37F";
const INK = "#2A2521";

export default function Logo({
  variant = "color",
  size = 24,
  className,
}: {
  variant?: "color" | "reverse" | "mono";
  size?: number;
  className?: string;
}) {
  const bubble = variant === "reverse" ? "#FFFFFF" : variant === "mono" ? INK : GREEN;
  const v = variant === "reverse" ? GREEN : "#FFFFFF";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label="VeChat"
    >
      <rect x="15" y="16" width="70" height="52" rx="18" fill={bubble} />
      <path d="M32 62 L32 84 L50 66 Z" fill={bubble} />
      <polyline points="37,34 50,48 63,34" stroke={v} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
