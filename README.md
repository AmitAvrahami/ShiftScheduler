# Shift Scheduler

[![GitHub](https://img.shields.io/badge/github-ShiftScheduler-blue)](https://github.com/AmitAvrahmi/ShiftScheduler)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Automatic work shift scheduling system for control rooms and workplaces with rotating shifts.

## 🚀 Project Status

- ✅ Phase 1: Project Setup & Infrastructure (Completed)
- ✅ Phase 2: Authentication System (Completed)
- ⏳ Phase 3: Constraints Management
- ⏳ Phase 4: Scheduling Algorithm
- ⏳ Phase 5: Schedule Management UI

## 📦 Repository

- **GitHub:** <https://github.com/AmitAvrahmi/ShiftScheduler>
- **Live Demo:** Coming soon

## Overview

ShiftScheduler is a professional application designed to manage employee shift hours, configuration, and scheduling. This is the Phase 1 MVP focusing on Bezeq's control room constraints.

## Prerequisites

- Node.js 20+
- MongoDB instance running locally or hosted

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd ShiftScheduler

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Setup Environment Variables

### Backend

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/shiftscheduler
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
```

### Frontend

Create a `.env` file in the `frontend/` directory based on `.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Running the Application

### Run Backend

```bash
cd backend
npm run dev
```

The server will start on `http://localhost:5000`.

### Run Frontend

```bash
cd frontend
npm run dev
```

The client will start on `http://localhost:5173`.

## Coding Standards

Please refer to `.agent/rules/` for information on our clean code, security, testing, and formatting standards.

# ShiftScheduler
