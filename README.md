# Hotel Management System (HMS)

A full-stack, production-ready hotel booking web application built with **Node.js + Express + MySQL** on the backend and **vanilla HTML/CSS/JavaScript** on the frontend.

## Features

- **User Auth** – customer/admin registration & login with JWT sessions, bcrypt password hashing
- **Hotel Search** – filter by city, price range and star rating
- **Live Availability** – room availability check that excludes rooms with overlapping confirmed bookings
- **Booking** – pick room + dates, auto-calculated `total_amount` (nights × price), status `Pending`
- **Mock Payment Gateway** – card/UPI/netbanking; success sets booking to `Confirmed`
- **Check-in / Check-out** – admin transitions `Confirmed → CheckedIn → CheckedOut`
- **Cancellation** – customers & admins can cancel `Pending`/`Confirmed` bookings; blocked once checked in; room is released
- **Customer Management** – admin can search, edit and (de)activate customer accounts
- **Room Management** – full admin CRUD for hotels & rooms, including marking rooms `Maintenance`
- **Reviews** – customers can review a hotel only after a `CheckedOut` stay; average rating shown per hotel
- **Reports** – revenue by date range, occupancy rate per hotel, bookings by status, top-rated hotels
- **Security** – parameterized SQL queries, `express-validator` on all POST/PUT routes, CORS restricted to the frontend origin, role-based route protection, secrets in `.env`

## Tech Stack

| Layer      | Technology                                  |
|------------|---------------------------------------------|
| Backend    | Node.js, Express.js                         |
| Database   | MySQL (via `mysql2` connection pool)        |
| Auth       | JWT (`jsonwebtoken`), `bcryptjs`            |
| Validation | `express-validator`                         |
| Frontend   | HTML, CSS, vanilla JavaScript (fetch API)   |

## Project Structure

```
hotel-management-system/
├── backend/
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── hotelRoutes.js
│   │   ├── roomRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── reportRoutes.js
│   │   └── customerRoutes.js
│   ├── package.json
│   ├── .env            (your real credentials - not committed)
│   └── .env.example
├── database/
│   ├── schema.sql      (DDL)
│   └── seed.sql        (sample data + bcrypt-hashed passwords)
├── frontend/
│   ├── index.html, login.html, register.html
│   ├── hotels.html, room-details.html, booking.html, payment.html
│   ├── customer-dashboard.html, admin-dashboard.html, reports.html
│   ├── css/style.css
│   └── js/api.js, auth.js, hotels.js, roomDetails.js, booking.js,
│       dashboard.js, admin.js, reports.js
└── README.md
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- MySQL 8 running locally (service on port 3306)

### 2. Create the database and seed data

Using the MySQL CLI:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

This creates the `hotel_management` database, all tables, indexes and sample data.

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set your real database credentials:

```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_real_password
DB_NAME=hotel_management
JWT_SECRET=change_this_to_a_long_random_string
CLIENT_ORIGIN=http://127.0.0.1:5000,http://127.0.0.1:5500
```

> On the machine where this project was delivered, the MySQL `root` password was
> reset to **`Root@12345`** and `backend/.env` already contains working
> credentials, so `npm run dev` works out of the box.

### 4. Install dependencies and run

```bash
cd backend
npm install
npm run dev
```

The server boots on `http://localhost:5000` after successfully connecting to MySQL. The frontend is served from the same origin, so open **http://localhost:5000** in your browser. (You may also open the `frontend/*.html` files with a static server such as VS Code Live Server — CORS is pre-configured.)

## Default Login Credentials

| Role     | Email             | Password      |
|----------|-------------------|---------------|
| Admin    | admin@hotel.com   | Admin@123     |
| Customer | john@example.com  | Customer@123  |

## API Endpoints

| Method | Endpoint                          | Access  | Description                              |
|--------|-----------------------------------|---------|------------------------------------------|
| POST   | `/api/auth/register`              | public  | Register a customer                      |
| POST   | `/api/auth/login`                 | public  | Login, returns JWT                       |
| GET    | `/api/auth/me`                    | auth    | Current user                             |
| GET    | `/api/hotels`                     | public  | List/search hotels (filters)             |
| GET    | `/api/hotels/:id`                 | public  | Hotel detail + rooms + reviews           |
| POST   | `/api/hotels`                     | admin   | Create hotel                             |
| PUT    | `/api/hotels/:id`                 | admin   | Update hotel                             |
| DELETE | `/api/hotels/:id`                 | admin   | Delete hotel (cascades rooms)            |
| GET    | `/api/rooms/hotel/:id/available`  | public  | Availability check for dates             |
| GET    | `/api/rooms`                      | admin   | List all rooms                           |
| POST   | `/api/rooms`                      | admin   | Create room                              |
| PUT    | `/api/rooms/:id`                  | admin   | Update room (incl. Maintenance)          |
| DELETE | `/api/rooms/:id`                  | admin   | Delete room                              |
| POST   | `/api/bookings`                   | auth    | Create booking (Pending)                 |
| GET    | `/api/bookings/my`                | auth    | My bookings                              |
| GET    | `/api/bookings`                   | admin   | All bookings                             |
| PATCH  | `/api/bookings/:id/cancel`        | auth    | Cancel (own) / admin                     |
| PATCH  | `/api/bookings/:id/confirm`       | admin   | Pending → Confirmed                      |
| PATCH  | `/api/bookings/:id/checkin`       | admin   | Confirmed → CheckedIn                    |
| PATCH  | `/api/bookings/:id/checkout`      | admin   | CheckedIn → CheckedOut                   |
| POST   | `/api/payments`                   | auth    | Mock payment (confirms on success)       |
| GET    | `/api/payments/booking/:id`       | auth    | Payment records for a booking            |
| GET    | `/api/reviews/hotel/:id`          | public  | Reviews for a hotel                      |
| GET    | `/api/reviews/my`                 | auth    | My reviews                               |
| GET    | `/api/reviews/eligibility/:id`    | auth    | May this user review this hotel?         |
| POST   | `/api/reviews`                    | auth    | Submit review (after CheckedOut)         |
| GET    | `/api/reports/revenue`            | admin   | Revenue by date range                    |
| GET    | `/api/reports/occupancy`          | admin   | Occupancy rate per hotel                 |
| GET    | `/api/reports/bookings-by-status` | admin   | Bookings grouped by status               |
| GET    | `/api/reports/top-rated-hotels`   | admin   | Top rated hotels                         |
| GET    | `/api/reports/dashboard`          | admin   | Summary stats                            |
| GET    | `/api/customers`                  | admin   | List/search customers                    |
| PUT    | `/api/customers/:id`              | admin   | Edit customer                            |
| PATCH  | `/api/customers/:id/status`       | admin   | Activate/deactivate customer             |

## End-to-End Demo Flow

1. **Register** a new customer (`register.html`) or log in as `john@example.com`.
2. **Search hotels** (`hotels.html`) and open one.
3. On **room details**, pick check-in/check-out dates and check availability.
4. **Book a room** → booking created as `Pending`, redirected to the booking summary.
5. **Pay** on `payment.html` (any card ending in an even digit succeeds, odd digit fails).
6. On success the booking becomes **Confirmed**.
7. As **admin** (`admin@hotel.com`), find the booking and **Confirm → Check-in → Check-out**.
8. As the customer, open **My Bookings** and leave a **review** for the completed stay.
9. Admin: explore **Reports** for revenue, occupancy, status and top-rated hotels.

## Notes

- The payment gateway is a **simulated** endpoint (no real money).
- Room availability correctly rejects bookings whose dates overlap a `Confirmed` or `CheckedIn` booking.
- Cancelling a booking frees the room for those dates.
- All passwords in `seed.sql` are bcrypt-hashed; never store plaintext.