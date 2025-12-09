-- Create email notification log table to track sent notifications
CREATE TABLE IF NOT EXISTS email_notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  recipient_id INT,
  recipient_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_property_alert_date (property_id, alert_type, sent_at),
  INDEX idx_sent_date (sent_at)
);
