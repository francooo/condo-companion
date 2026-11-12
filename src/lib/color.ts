/** Utilitários de cor para a identidade do condomínio (cores em #RRGGBB). */

export const DEFAULT_PRIMARY = "#FFC928";
export const DEFAULT_SECONDARY = "#171717";

export function isHex(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v);
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "H S% L%" para variáveis CSS usadas com hsl(var(--x)). */
export function hexToHslTriplet(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Luminância relativa (WCAG). */
export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto legível (quase preto ou branco) sobre a cor informada. */
export function readableOn(hex: string) {
  return contrastRatio(hex, "#171717") >= contrastRatio(hex, "#FFFFFF") ? "#171717" : "#FFFFFF";
}

/** Variáveis CSS do tema do condomínio, aplicadas no contêiner do app. */
export function tenantStyle(primary?: string | null, secondary?: string | null): React.CSSProperties | undefined {
  if (!primary && !secondary) return undefined;
  const p = primary && isHex(primary) ? primary : DEFAULT_PRIMARY;
  const s = secondary && isHex(secondary) ? secondary : DEFAULT_SECONDARY;
  return {
    "--tenant-primary": hexToHslTriplet(p),
    "--tenant-foreground": hexToHslTriplet(readableOn(p)),
    "--tenant-secondary": hexToHslTriplet(s),
    "--tenant-secondary-foreground": hexToHslTriplet(readableOn(s)),
  } as React.CSSProperties;
}
