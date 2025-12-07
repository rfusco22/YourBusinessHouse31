"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sliders } from "lucide-react"

interface PropertyFiltersProps {
  filters: any
  onFiltersChange: (filters: any) => void
  onApplyFilters: (filters: any) => void
}

export function PropertyFilters({ filters, onFiltersChange, onApplyFilters }: PropertyFiltersProps) {
  const [showFilters, setShowFilters] = useState(true)

  const handleFilterChange = (key: string, value: string) => {
    const updatedFilters = { ...filters, [key]: value }
    onFiltersChange(updatedFilters)

    if (key === "searchTerm" || key === "operacion") {
      onApplyFilters(updatedFilters)
    }
  }

  const handleApplyFilters = () => {
    onApplyFilters(filters)
  }

  const handleClearFilters = () => {
    const clearedFilters = {
      searchTerm: "",
      type: "todos",
      priceMin: "",
      priceMax: "",
      bedrooms: "",
      bathrooms: "",
      area: "",
      operacion: "",
    }
    onFiltersChange(clearedFilters)
    onApplyFilters(clearedFilters)
  }

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden mb-4">
        <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={() => setShowFilters(!showFilters)}>
          <Sliders className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      {/* Filters Card */}
      {showFilters && (
        <Card className="p-6 sticky top-20">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground">Filtros</h3>
              <button
                onClick={handleClearFilters}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Limpiar
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Búsqueda</label>
              <input
                type="text"
                value={filters.searchTerm || ""}
                onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                placeholder="Ubicación o dirección"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tipo de operación</label>
              <select
                value={filters.operacion || ""}
                onChange={(e) => handleFilterChange("operacion", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                <option value="alquiler">Para Alquilar</option>
                <option value="compra">Para Comprar</option>
                <option value="ambos">Para Alquilar y Para Comprar</option>
              </select>
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tipo de inmueble</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="todos">Todos los tipos</option>
                <option value="casa">Casa</option>
                <option value="apartamento">Apartamento</option>
                <option value="oficina">Oficina</option>
                <option value="terreno">Terreno</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">Rango de precio</label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Mín."
                  value={filters.priceMin}
                  onChange={(e) => handleFilterChange("priceMin", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
                <input
                  type="number"
                  placeholder="Máx."
                  value={filters.priceMax}
                  onChange={(e) => handleFilterChange("priceMax", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>

            {/* Bedrooms */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Cuartos</label>
              <select
                value={filters.bedrooms}
                onChange={(e) => handleFilterChange("bedrooms", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Cualquier cantidad</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
              </select>
            </div>

            {/* Bathrooms */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Baños</label>
              <select
                value={filters.bathrooms}
                onChange={(e) => handleFilterChange("bathrooms", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Cualquier cantidad</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>

            {/* Area */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Área mínima (m²)</label>
              <input
                type="number"
                placeholder="Ej: 200"
                value={filters.area}
                onChange={(e) => handleFilterChange("area", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {/* Apply Filters Button */}
            <Button className="w-full" onClick={handleApplyFilters}>
              Aplicar filtros
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
