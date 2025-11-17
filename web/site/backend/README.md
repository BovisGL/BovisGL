# BovisGL - Backend

## Overview
This is the backend (server-side) part of the BovisGL website. It handles all the behind-the-scenes operations like database management, authentication, and communication with the Minecraft servers.

## What This Code Does
The backend code is like the "brain" of the website. It's responsible for:
- Keeping track of users and permissions
- Starting, stopping, and monitoring Minecraft servers
- Storing and retrieving data from databases
- Securing the website against unauthorized access
- Communicating with the Minecraft servers using RCON protocol
- Processing requests from the frontend

## Technologies Used
- **Node.js**: A JavaScript runtime for building server applications
- **Express**: A web framework for handling HTTP requests
- **TypeScript**: Adds type safety to JavaScript
- **SQLite**: A lightweight database to store information
- **JWT**: JSON Web Tokens for secure authentication
- **RCON**: Remote Console protocol to communicate with Minecraft servers

## Main Files and Folders Explained

### index.ts
This is the main server file that starts everything up. It configures the server, sets up security, and defines the API endpoints.

### routes/
Contains definitions for all the API endpoints (URLs) that the frontend can call.

### controllers/
Contains the code that processes requests, interacts with the database, and sends responses back.

### middleware/
Contains functions that check requests for things like authentication, permissions, and validity before they reach the controllers.

### services/
Contains business logic separated from the controllers for better organization.

### utils/
Contains helper functions used throughout the application.

### db/
Contains database connection and query code.

### rcon.ts
Implements the RCON protocol for sending commands to Minecraft servers.

## How to Run It
1. Open a command prompt in this directory
2. Run `npm install` to install all the required packages
3. Make sure your environment variables are set up correctly
4. Run `npm run dev` to start the server in development mode
5. The server will be available at http://localhost:3000

## Security Features
- **JWT Authentication**: Securely identifies users with tokens that expire
- **Password Hashing**: Stores passwords securely using bcrypt
- **CSRF Protection**: Prevents cross-site request forgery attacks
- **Rate Limiting**: Prevents brute force attacks by limiting login attempts
- **Input Validation**: Checks all input to prevent injection attacks
- **Security Headers**: Protects against common web vulnerabilities
- **Two-Factor Authentication**: Adds an extra layer of security for admin access

## How It Connects to Minecraft Servers
The backend uses the RCON protocol to send commands directly to Minecraft servers. This allows it to:
- Start and stop servers
- Monitor server status and player counts
- Execute game commands
- Get server logs

## Database Information
The backend uses SQLite databases to store:
- User accounts and permissions
- Server configurations
- Game logs and statistics
- Authentication data 