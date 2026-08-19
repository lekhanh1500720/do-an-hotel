-- =============================================
-- Hotel Management System - Database Schema
-- MySQL DDL
-- =============================================

-- Drop existing database (comment out in production)
DROP DATABASE IF EXISTS hotel_management;
CREATE DATABASE hotel_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel_management;

-- -------------------------------------------------
-- users
-- -------------------------------------------------
CREATE TABLE users (
    user_id    INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    phone      VARCHAR(20) NULL,
    role       ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    is_active  TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------
-- hotels
-- -------------------------------------------------
CREATE TABLE hotels (
    hotel_id    INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    address     VARCHAR(255) NOT NULL,
    description TEXT NULL,
    star_rating TINYINT NOT NULL DEFAULT 3 CHECK (star_rating BETWEEN 1 AND 5),
    image_url   VARCHAR(500) NULL,
    created_by  INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hotels_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_hotels_city ON hotels(city);
CREATE INDEX idx_hotels_star_rating ON hotels(star_rating);
CREATE INDEX idx_hotels_created_by ON hotels(created_by);

-- -------------------------------------------------
-- rooms
-- -------------------------------------------------
CREATE TABLE rooms (
    room_id         INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id        INT NOT NULL,
    room_number     VARCHAR(20) NOT NULL,
    room_type       ENUM('Single','Double','Deluxe','Suite') NOT NULL,
    price_per_night DECIMAL(10,2) NOT NULL CHECK (price_per_night > 0),
    capacity        INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    status          ENUM('Available','Booked','Maintenance') NOT NULL DEFAULT 'Available',
    image_url       VARCHAR(500) NULL,
    CONSTRAINT fk_rooms_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    UNIQUE KEY uq_room_hotel_number (hotel_id, room_number)
) ENGINE=InnoDB;

CREATE INDEX idx_rooms_hotel_id ON rooms(hotel_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_room_type ON rooms(room_type);

-- -------------------------------------------------
-- bookings
-- -------------------------------------------------
CREATE TABLE bookings (
    booking_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    room_id        INT NOT NULL,
    check_in_date  DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status         ENUM('Pending','Confirmed','CheckedIn','CheckedOut','Cancelled') NOT NULL DEFAULT 'Pending',
    total_amount   DECIMAL(10,2) NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    CONSTRAINT chk_booking_dates CHECK (check_out_date > check_in_date)
) ENGINE=InnoDB;

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_room_id ON bookings(room_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);

-- -------------------------------------------------
-- payments
-- -------------------------------------------------
CREATE TABLE payments (
    payment_id     INT AUTO_INCREMENT PRIMARY KEY,
    booking_id     INT NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    payment_method ENUM('Card','UPI','NetBanking') NOT NULL,
    payment_status ENUM('Pending','Success','Failed') NOT NULL DEFAULT 'Pending',
    transaction_ref VARCHAR(64) NOT NULL UNIQUE,
    paid_at        TIMESTAMP NULL,
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(payment_status);

-- -------------------------------------------------
-- reviews
-- -------------------------------------------------
CREATE TABLE reviews (
    review_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    hotel_id   INT NOT NULL,
    rating     TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    CONSTRAINT uq_review_user_hotel UNIQUE (user_id, hotel_id)
) ENGINE=InnoDB;

CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_hotel_id ON reviews(hotel_id);
