import { useState } from "react";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Barcode, Plus, X } from "lucide-react";

type BarcodeListInputProps = {
  /** Lista completa de códigos: el primero es el principal (el que se imprime en etiquetas). */
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  inputId?: string;
};

/**
 * Editor de códigos de barras de un producto — sin límite de cantidad.
 * Pensado para el lector: con el foco en el campo, cada escaneo (que termina
 * en Enter) agrega un código a la lista. También acepta pegar varios a la vez.
 */
export function BarcodeListInput({ value, onChange, disabled = false, inputId = "barcode-input" }: BarcodeListInputProps) {
  const [draft, setDraft] = useState("");

  const addCodes = (raw: string) => {
    const incoming = raw.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
    if (incoming.length === 0) return;
    const next = [...value];
    for (const code of incoming) {
      if (!next.includes(code)) next.push(code);
    }
    onChange(next);
    setDraft("");
  };

  const removeCode = (code: string) => onChange(value.filter((c) => c !== code));

  /** Mueve el código al inicio: pasa a ser el principal. */
  const makePrimary = (code: string) => onChange([code, ...value.filter((c) => c !== code)]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addCodes(draft);
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[\s,;]/.test(text.trim())) {
              e.preventDefault();
              addCodes(text);
            }
          }}
          onBlur={() => addCodes(draft)}
          placeholder="Escanea o escribe y presiona Enter"
          disabled={disabled}
          autoComplete="off"
          inputMode="numeric"
          aria-describedby={`${inputId}-hint`}
          className="h-9 bg-background font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled || !draft.trim()}
          onClick={() => addCodes(draft)}
          title="Agregar código"
          aria-label="Agregar código de barras"
        >
          <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>

      {value.length > 0 ? (
        <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden list-none p-0" aria-label="Lista de códigos del producto">
          {value.map((code, index) => (
            <li key={code} className="flex items-center gap-2 px-3 py-1.5">
              <Barcode className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="font-mono text-sm truncate min-w-0 flex-1" title={code}>{code}</span>
              {index === 0 ? (
                <span className="rounded-full bg-muted text-xs px-2 py-0.5 text-muted-foreground shrink-0">Principal</span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  disabled={disabled}
                  onClick={() => makePrimary(code)}
                >
                  Hacer principal
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                disabled={disabled}
                onClick={() => removeCode(code)}
                title="Quitar código"
                aria-label={`Quitar código ${code}`}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {value.length === 0
          ? "Sin códigos todavía. Puedes agregar todos los que tenga el producto (sabores, empaques, lotes)."
          : "El POS reconoce cualquiera de estos códigos. El principal es el que se imprime en las etiquetas."}
      </p>
    </div>
  );
}
