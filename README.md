# Go Chat

Go Chat is a modern, real-time full-stack chat application designed for instant communication with friends and colleagues. It features a beautiful UI, secure authentication, real-time messaging, and profile customization.

## Features

- **Real-time Messaging**: Instant message delivery using WebSockets.
- **User Authentication**: Secure signup, login, and JWT-based authentication.
- **Profile Customization**: Users can upload and update their profile pictures.
- **Email Notifications**: Welcome emails and other notifications upon account creation.
- **Responsive Design**: A stunning, responsive user interface tailored for all devices.

## Tech Stack

### Frontend
- **Framework**: React with Vite
- **Styling**: Tailwind CSS (with DaisyUI components)
- **State Management**: Zustand
- **Icons**: Lucide React
- **Routing**: React Router DOM

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-time Communication**: Socket.io
- **Authentication**: JWT & bcryptjs
- **Image Uploads**: Cloudinary
- **Emails**: Resend

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB (local or Atlas)
- Cloudinary Account (for image uploads)
- Resend Account (for sending emails)

### Installation

1. **Clone the repository** (or download the source):
   ```bash
   git clone <your-repo-url>
   cd go_chat
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

### Environment Variables

You need to set up environment variables for both the frontend and backend.

**Backend (`backend/.env`)**
Create a `.env` file in the `backend` directory based on the provided `.env.example`:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
RESEND_API_KEY=your_resend_api_key
```

**Frontend (`frontend/.env`)**
Create a `.env` file in the `frontend` directory based on `.env.example` if available.

### Running the Application

You can run both the frontend and backend concurrently or in separate terminals.

1. **Start the Backend Development Server**:
   ```bash
   cd backend
   npm run dev
   ```
   *The backend server will run on `http://localhost:5000`*

2. **Start the Frontend Development Server**:
   ```bash
   cd frontend
   npm run dev
   ```
   *The frontend will be accessible via the link provided by Vite (usually `http://localhost:5173`)*

## License

This project is licensed under the MIT License.
