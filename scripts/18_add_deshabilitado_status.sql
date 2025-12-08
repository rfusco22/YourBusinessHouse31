-- Add 'deshabilitado' status to inmueble table
-- This allows properties to be marked as disabled

ALTER TABLE inmueble 
MODIFY COLUMN status ENUM('disponible', 'vendido', 'alquilado', 'deshabilitado') DEFAULT 'disponible';

SELECT 'Added deshabilitado status to inmueble table!' as status;
