-- Add new request types for disable and enable to rental_permission_requests table
-- This allows asesores to request permission to disable/enable properties

ALTER TABLE rental_permission_requests
MODIFY COLUMN request_type ENUM('disponible_request', 'property_approval', 'nuevo_inmueble', 'disable_request', 'enable_request') NOT NULL;

-- Add comments for clarity
ALTER TABLE rental_permission_requests 
COMMENT = 'Stores permission requests from asesores for property status changes, including disable/enable requests';

SELECT 'Rental permission requests table updated with disable/enable request types!' as status;
