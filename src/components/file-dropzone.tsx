"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  onFile,
  fileName,
  accept = ".csv,text/csv,text/plain",
  className,
}: {
  onFile: (text: string, fileName: string) => void;
  fileName?: string | null;
  accept?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onFile(String(reader.result ?? ""), file.name);
    reader.readAsText(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readFile(file);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        className,
      )}
    >
      <Upload className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">
        {fileName ?? "Drag and drop a CSV here, or click to browse"}
      </p>
      <p className="text-xs text-muted-foreground">.csv or plain text export</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />
    </div>
  );
}
