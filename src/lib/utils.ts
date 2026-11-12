import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extrai a mensagem de um erro desconhecido (bloco `catch`). */
export function errorMessage(err: unknown, fallback = "Erro desconhecido") {
  return err instanceof Error && err.message ? err.message : fallback;
}
