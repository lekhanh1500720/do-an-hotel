-- =============================================
-- Hotel Management System - Seed Data
-- Passwords are bcrypt-hashed:
--   admin@hotel.com    -> Admin@123
--   john@example.com   -> Customer@123
-- =============================================
USE hotel_management;

-- Users -------------------------------------------------
INSERT INTO users (name, email, password, phone, role) VALUES
('System Admin', 'admin@hotel.com', '$2a$10$DdggGg01yilYELIpxxZiu.8HlMXlZvkwJbsxxbH514T076jqqeJ0i', '+91-9876500001', 'admin'),
('John Carter',  'john@example.com', '$2a$10$AwJruyJJUkvUX1girOH6y.WorHkIOTtG6Wm1POVPRDjMN3i91aEja', '+91-9876500002', 'customer'),
('Maria Lopez',  'maria@example.com', '$2a$10$AwJruyJJUkvUX1girOH6y.WorHkIOTtG6Wm1POVPRDjMN3i91aEja', '+91-9876500003', 'customer'),
('David Kim',    'david@example.com', '$2a$10$AwJruyJJUkvUX1girOH6y.WorHkIOTtG6Wm1POVPRDjMN3i91aEja', '+91-9876500004', 'customer');

-- Hotels -------------------------------------------------
INSERT INTO hotels (name, city, address, description, star_rating, image_url, created_by) VALUES
('Grand Royal Palace', 'Mumbai', '12 Marine Drive, Mumbai 400020', 'Luxury 5-star beachfront hotel with a rooftop infinity pool, fine dining and a full-service spa.', 5, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800', 1),
('The Cozy Inn', 'Delhi', '45 Connaught Place, New Delhi 110001', 'Boutique hotel in the heart of the city with warm rooms and a famous rooftop cafe.', 3, 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', 1),
('Hill View Resort', 'Shimla', '8 Mall Road, Shimla 171001', 'Scenic mountain resort with valley views, bonfire nights and guided trekking.', 4, 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800', 1),
('The Sea Pearl', 'Goa', '5 Candolim Beach Road, Goa 403515', 'Boutique beachfront resort with private cabanas, a saltwater pool and sunset dining on the sand.', 5, 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800', 1),
('Heritage Haveli', 'Jaipur', '27 Hawa Mahal Road, Jaipur 302002', 'A restored 19th-century haveli with hand-painted frescoes, rooftop dining and a heritage courtyard.', 4, 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=800', 1),
('Business Bay Suites', 'Bengaluru', '3 MG Road, Bengaluru 560001', 'Modern serviced suites designed for business travellers with co-working space and express check-in.', 4, 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800', 1),
('Mountain Pine Lodge', 'Manali', '19 Old Manali Road, Manali 175131', 'Cosy pine-wood lodge with a fireplace lounge, mountain-view balconies and guided local treks.', 3, 'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?w=800', 1),
('Skyline Grand', 'Chennai', '88 Anna Salai, Chennai 600002', 'High-rise 5-star hotel with a sky lounge, rooftop pool and panoramic city views.', 5, 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800', 1);

-- Rooms -------------------------------------------------
INSERT INTO rooms (hotel_id, room_number, room_type, price_per_night, capacity, status, image_url) VALUES
(1, '101', 'Single',  5000.00, 1, 'Available', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800'),
(1, '102', 'Double',  8000.00, 2, 'Available', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'),
(1, '201', 'Deluxe', 12000.00, 2, 'Available', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800'),
(1, '301', 'Suite',  25000.00, 4, 'Available', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800'),
(2, 'A01', 'Single',  2200.00, 1, 'Available', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800'),
(2, 'A02', 'Double',  3800.00, 2, 'Available', 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800'),
(3, 'B01', 'Double',  6500.00, 2, 'Available', 'https://images.unsplash.com/photo-1556955112-28cde3817b0a?w=800'),
(3, 'B02', 'Deluxe',  9500.00, 3, 'Available', 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800'),
(4, '101', 'Deluxe', 11000.00, 2, 'Available', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800'),
(4, '201', 'Suite',  22000.00, 4, 'Available', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800'),
(5, '101', 'Double',  7000.00, 2, 'Available', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'),
(5, '102', 'Deluxe', 10000.00, 3, 'Available', 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800'),
(5, '201', 'Suite',  15000.00, 4, 'Available', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800'),
(6, '101', 'Single',  4500.00, 1, 'Available', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800'),
(6, '102', 'Double',  6500.00, 2, 'Available', 'https://images.unsplash.com/photo-1556955112-28cde3817b0a?w=800'),
(6, '201', 'Deluxe',  9000.00, 2, 'Available', 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800'),
(7, '101', 'Double',  3500.00, 2, 'Available', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'),
(7, '102', 'Deluxe',  5200.00, 3, 'Available', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800'),
(8, '101', 'Deluxe', 12000.00, 2, 'Available', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800'),
(8, '201', 'Suite',  26000.00, 4, 'Available', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800');

-- Reviews (sample, so hotel listing shows ratings) --------
INSERT INTO reviews (user_id, hotel_id, rating, comment) VALUES
(2, 1, 5, 'Absolutely stunning property and impeccable service.'),
(2, 2, 4, 'Great location and very comfortable rooms.'),
(3, 3, 4, 'Beautiful views, breakfast could be better.'),
(4, 1, 4, 'Wonderful stay, will come back again.'),
(2, 4, 5, 'The beach cabanas and sunset dining were unforgettable.'),
(3, 5, 4, 'A charming heritage property with lovely hospitality.'),
(4, 6, 5, 'Perfect for business trips; fast Wi-Fi and great location.'),
(2, 7, 4, 'Cozy lodge, beautiful mountain views from the balcony.'),
(3, 8, 5, 'Sky lounge has the best city view in Chennai.');