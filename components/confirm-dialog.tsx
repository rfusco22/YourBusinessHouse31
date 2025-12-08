"use client"

import { AlertCircle, CheckCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: "default" | "danger" | "warning"
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: <AlertCircle className="h-12 w-12 text-red-500" />,
          confirmBg: "bg-red-600 hover:bg-red-700",
          accentColor: "border-red-500/30",
        }
      case "warning":
        return {
          icon: <AlertCircle className="h-12 w-12 text-yellow-500" />,
          confirmBg: "bg-yellow-600 hover:bg-yellow-700",
          accentColor: "border-yellow-500/30",
        }
      default:
        return {
          icon: <CheckCircle className="h-12 w-12 text-primary" />,
          confirmBg: "bg-primary hover:bg-primary/90",
          accentColor: "border-primary/30",
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={`bg-neutral-900 border ${styles.accentColor} max-w-md`}>
        <AlertDialogHeader>
          <div className="flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-neutral-800/50 p-4">{styles.icon}</div>
            <AlertDialogTitle className="text-white text-xl font-bold">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 text-base leading-relaxed">
              {description}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
          >
            {cancelText}
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} className={`flex-1 ${styles.confirmBg} text-white`}>
            {isLoading ? "Procesando..." : confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
