-- Script para corregir definitivamente los valores de operation_type
-- Ejecutar este script para asegurar que todos los inmuebles tengan el valor correcto

-- Primero, actualizar todos los inmuebles que tienen ambos precios
UPDATE inmueble 
SET operation_type = 'ambos' 
WHERE rental_price IS NOT NULL 
  AND rental_price > 0 
  AND purchase_price IS NOT NULL 
  AND purchase_price > 0;

-- Actualizar inmuebles que solo tienen precio de alquiler
UPDATE inmueble 
SET operation_type = 'alquiler' 
WHERE (rental_price IS NOT NULL AND rental_price > 0)
  AND (purchase_price IS NULL OR purchase_price = 0);

-- Actualizar inmuebles que solo tienen precio de compra
UPDATE inmueble 
SET operation_type = 'compra' 
WHERE (purchase_price IS NOT NULL AND purchase_price > 0)
  AND (rental_price IS NULL OR rental_price = 0);

-- Verificar los resultados
SELECT 
  operation_type,
  COUNT(*) as cantidad,
  GROUP_CONCAT(CONCAT(id, ': ', title) SEPARATOR ' | ') as propiedades
FROM inmueble 
GROUP BY operation_type;

-- Mostrar detalles de cada tipo
SELECT 
  id,
  title,
  operation_type,
  rental_price,
  purchase_price,
  CASE 
    WHEN rental_price IS NOT NULL AND rental_price > 0 AND purchase_price IS NOT NULL AND purchase_price > 0 THEN 'Tiene ambos precios'
    WHEN rental_price IS NOT NULL AND rental_price > 0 THEN 'Solo alquiler'
    WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN 'Solo compra'
    ELSE 'Sin precios'
  END as estado_precios
FROM inmueble
ORDER BY operation_type, id;
