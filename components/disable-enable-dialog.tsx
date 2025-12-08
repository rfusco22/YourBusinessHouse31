"use client"

import { useState } from "react"
import { X, AlertTriangle, Power } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DisableEnableDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  propertyTitle: string
  action: "disable" | "enable"
  isLoading?: boolean
}

export function DisableEnableDialog({
  isOpen,
  onClose,
  onConfirm,
  propertyTitle,
  action,
  isLoading = false,
}: DisableEnableDialogProps) {
  const [reason, setReason] = useState("")

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!reason.trim()) return
    onConfirm(reason)
    setReason("")
  }

  const actionText = action === "disable" ? "deshabilitar" : "habilitar"
  const ActionIcon = action === "disable" ? AlertTriangle : Power

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 border-2 border-primary/30 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/10 px-6 py-4 border-b border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${action === "disable" ? "bg-orange-500/20" : "bg-green-500/20"}`}>
                <ActionIcon className={action === "disable" ? "text-orange-400" : "text-green-400"} size={24} />
              </div>
              <h2 className="text-xl font-bold text-white capitalize">Solicitar {actionText}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Property info */}
          <div className="bg-neutral-800/50 border border-primary/10 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Inmueble:</p>
            <p className="text-white font-semibold line-clamp-2">{propertyTitle}</p>
          </div>

          {/* Alert message */}
          <div
            className={`flex gap-3 p-4 rounded-lg border ${
              action === "disable" ? "bg-orange-500/10 border-orange-500/30" : "bg-green-500/10 border-green-500/30"
            }`}
          >
            <AlertTriangle className={action === "disable" ? "text-orange-400" : "text-green-400"} size={20} />
            <p className="text-sm text-gray-300">
              Para {actionText} este inmueble, debes proporcionar una razón que será revisada por el administrador.
            </p>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300">
              Razón <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Explica por qué necesitas ${actionText} este inmueble...`}
              className="w-full px-4 py-3 bg-neutral-800 border border-primary/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
              rows={4}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">Mínimo 10 caracteres</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-900/50 border-t border-primary/20 flex gap-3">
          <Button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white border-none"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || reason.trim().length < 10}
            className={`flex-1 border-none ${
              action === "disable"
                ? "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            } text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? "Enviando..." : `Solicitar ${actionText}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
