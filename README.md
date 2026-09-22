# Sports Hub — Full-Stack Mini Project

## Run the project

1. Install Node.js 18+ (Node 20+ recommended).
2. Open a terminal in `backend`.
3. Run `npm start` (or `node server.js`).
4. Open **http://localhost:3000**.

The server serves the Sports Hub frontend and its REST API. Data is persisted locally in JSON files under `backend/data`, so no separate database installation is required.

## Product cards

Every product card now has the same visible layout as the reference design:
- Product category
- Product name
- Price in ₹
- Black **ADD +** button
- Wishlist button

The **ADD +** button calls the backend cart API. A user must log in/register before adding items to their persistent cart.

## Features

- Product API and search/filtering
- Registration/login with password hashing
- Persistent cart and wishlist
- Checkout and order creation
- Stock reduction after checkout
- Newsletter subscription
- Admin order and newsletter APIs

## Demo admin

Email: `admin@sportshub.local`  
Password: `Admin@123`

Checkout creates a real local order record but does not process real payments.
