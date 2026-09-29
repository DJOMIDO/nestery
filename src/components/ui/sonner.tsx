"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

// Toasts sit top right with solid fills by type (success, error, warning,
// info) from the theme tokens in globals.css. Plain toasts (e.g. "Deleted ·
// Undo") are inverted: deep forest ink on the light theme, light on the dark one.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      // Inline variables win over sonner's own per-theme defaults
      // Inline variables win over sonner's own per-theme defaults. Borders
      // match the fill; the shadow lifts the toast off the page.
      style={
        {
          "--normal-bg": "var(--toast-plain-bg)",
          "--normal-text": "var(--toast-plain-text)",
          "--normal-border": "var(--toast-plain-bg)",
          "--success-bg": "var(--toast-success-bg)",
          "--success-text": "var(--toast-success-text)",
          "--success-border": "var(--toast-success-bg)",
          "--error-bg": "var(--toast-error-bg)",
          "--error-text": "var(--toast-error-text)",
          "--error-border": "var(--toast-error-bg)",
          "--warning-bg": "var(--toast-warning-bg)",
          "--warning-text": "var(--toast-warning-text)",
          "--warning-border": "var(--toast-warning-border)",
          "--info-bg": "var(--toast-info-bg)",
          "--info-text": "var(--toast-info-text)",
          "--info-border": "var(--toast-info-bg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "shadow-lg!",
          // A pill in the page's background color reads on every fill (sonner
          // would otherwise draw it in the text color)
          actionButton: "bg-background! text-leaf! font-semibold hover:brightness-95",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
