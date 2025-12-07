-- Add city and state columns to inmueble table for better location filtering
ALTER TABLE inmueble 
ADD COLUMN IF NOT EXISTS city VARCHAR(100) AFTER location,
ADD COLUMN IF NOT EXISTS state VARCHAR(100) AFTER city;

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_inmueble_city ON inmueble(city);
CREATE INDEX IF NOT EXISTS idx_inmueble_state ON inmueble(state);

-- Update existing records to extract city from location field
-- This will parse location strings like "Altamira, Caracas, Miranda" 
-- and extract city and state
UPDATE inmueble 
SET 
  city = CASE 
    WHEN location LIKE '%,%' THEN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(location, ',', 2), ',', -1))
    ELSE NULL
  END,
  state = CASE 
    WHEN location LIKE '%,%,%' THEN TRIM(SUBSTRING_INDEX(location, ',', -1))
    ELSE NULL
  END
WHERE city IS NULL OR state IS NULL;
