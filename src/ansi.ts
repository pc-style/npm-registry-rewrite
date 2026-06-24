type ColorMode = boolean | "auto";

type StyleName = "bold" | "dim" | "green" | "yellow" | "red" | "cyan" | "gray";

const codes: Record<StyleName, readonly [number, number]> = {
  bold: [1, 22],
  dim: [2, 22],
  green: [32, 39],
  yellow: [33, 39],
  red: [31, 39],
  cyan: [36, 39],
  gray: [90, 39]
};

export type Ansi = Record<StyleName, (text: string) => string> & {
  enabled: boolean;
};

export function createAnsi(mode: ColorMode = "auto"): Ansi {
  const enabled = mode === "auto" ? shouldUseColor() : mode;
  const wrap = (name: StyleName) => (text: string) => {
    if (!enabled) return text;
    const [open, close] = codes[name];
    return `\x1b[${open}m${text}\x1b[${close}m`;
  };

  return {
    enabled,
    bold: wrap("bold"),
    dim: wrap("dim"),
    green: wrap("green"),
    yellow: wrap("yellow"),
    red: wrap("red"),
    cyan: wrap("cyan"),
    gray: wrap("gray")
  };
}

function shouldUseColor(): boolean {
  if ("NO_COLOR" in process.env) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") return true;
  return Boolean(process.stdout.isTTY);
}
