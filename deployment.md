# Deployment Guide: Link Scanner

This document outlines the steps to deploy your Broken Link Scanner to **Render.com** (Backend) and **Vercel** (Frontend).

## 1. Backend Deployment (Render.com)

1.  **Create a Web Service**: Link your GitHub repository.
2.  **Select Root Directory**: `backend`
3.  **Build Command**: `npm install`
4.  **Start Command**: `node server.js`
5.  **Environment Variables**:
    *   `PORT`: `5000` (Render detects this automatically, but good to set).
    *   `MONGODB_URI`: Your MongoDB Atlas connection string.
    *   `JWT_SECRET`: A random secure string.
    *   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Your email service credentials.
    *   `EMAIL_FROM`: The sender email address.
    *   `ALLOWED_ORIGINS`: Your Vercel frontend URL (e.g., `https://your-app.vercel.app`).
    *   `NODE_ENV`: `production`

## 2. Frontend Deployment (Vercel)

1.  **Create a New Project**: Link the same GitHub repository.
2.  **Select Root Directory**: `frontend`
3.  **Framework Preset**: `Next.js`
4.  **Environment Variables**:
    *   `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g., `https://your-backend.onrender.com/api`).
5.  **Build & Deploy**: Click Deploy.

## 3. Post-Deployment Verification

1.  Open your Vercel URL.
2.  Login with your admin credentials.
3.  Add a domain and click **Run Audit**.
4.  Verify that the **Progress Bar** and **Live Log** appear, showing real-time updates from the Render backend.

---

### Important Notes:
- **Render Free Tier**: The backend will "spin down" after 15 minutes of inactivity. The first request after a long time may take 30-60 seconds to wake up the server.
- **Database**: Make sure your MongoDB Atlas cluster allows connections from `0.0.0.0/0` (or Render's outbound IPs if you have a pro plan), as Render Free tier IPs change frequently.
