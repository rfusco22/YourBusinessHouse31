-- Update operation_type based on existing price data
-- This script sets the correct operation_type for inmueble records

-- Set to 'alquiler' for properties that only have rental price
UPDATE inmueble 
SET operation_type = 'alquiler'
WHERE rental_price IS NOT NULL 
  AND rental_price > 0
  AND (price IS NULL OR price = 0);

-- Set to 'compra' for properties that only have purchase price
UPDATE inmueble 
SET operation_type = 'compra'
WHERE (price IS NOT NULL AND price > 0)
  AND (rental_price IS NULL OR rental_price = 0);

-- Set to 'ambos' for properties that have BOTH rental and purchase prices
UPDATE inmueble 
SET operation_type = 'ambos'
WHERE (price IS NOT NULL AND price > 0)
  AND (rental_price IS NOT NULL AND rental_price > 0);

-- Verify the updates
SELECT 
  operation_type,
  COUNT(*) as total,
  GROUP_CONCAT(id ORDER BY id LIMIT 5) as sample_ids
FROM inmueble
GROUP BY operation_type;
