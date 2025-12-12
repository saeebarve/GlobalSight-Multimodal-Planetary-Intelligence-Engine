# 🌍 GlobalSight: Planetary Intelligence Engine

![GlobalSight Banner](https://via.placeholder.com/1200x400/020410/0099ff?text=GlobalSight+Planetary+Intelligence)

> **Analyze Our World.** See the unseen.
> An advanced multimodal AI platform powered by **Gemini 3 Pro** that transforms visual, audio, and text data into actionable global insights, root cause analyses, and predictive simulations.

![React](https://img.shields.io/badge/React-19.0-blue?logo=react&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&style=for-the-badge)
![Gemini API](https://img.shields.io/badge/Gemini_3_Pro-Preview-8E75B2?logo=google&style=for-the-badge)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?logo=tailwind-css&style=for-the-badge)

## 🚀 Overview

GlobalSight is not just a chatbot; it is a **Real-Time World Problem Analysis Engine**. It leverages the reasoning capabilities of Google's **Gemini 3 Pro** model to ingest complex multimodal data (images, camera feeds, audio recordings, documents) and output structured, scientific, and policy-grade reports.

Whether identifying environmental risks from a photo, analyzing infrastructure from a video feed, or simulating policy outcomes based on voice memos, GlobalSight provides a "Mission Control" interface for planetary data.

## ✨ Key Features

### 🧠 Advanced Intelligence
*   **Multimodal Input Core:** Seamlessly processes Text, Images (Upload/Camera), Audio (Microphone/Upload), and Geolocation data.
*   **Deep Reasoning:** Performs Problem Detection, Root Cause Analysis, and Impact Prediction (Short/Long term).
*   **Grounding:** Integrated **Google Search Grounding** to cross-reference visual data with real-time news and statistics.

### 🛠 Active Simulation & Solutions
*   **Actionable Solutions:** Generates specific advice for Personal, Business, and Government sectors.
*   **Live Code Generation:** Automatically generates and renders **interactive HTML/JS/Chart.js simulations** to visualize data or predicted scenarios directly within the app.
*   **Mission Control Chat:** A conversational follow-up interface to refine analysis or ask tactical questions.

### 🎨 Immersive UI/UX
*   **Holographic Aesthetic:** A futuristic "Glassmorphism" design with dynamic aurora backgrounds, 3D tilt effects, and scanning animations.
*   **Responsive & Accessible:** Fully responsive design with speech synthesis (Text-to-Speech) and voice input.
*   **Printable Reports:** Automatic formatting for export-ready PDF reports.

## 🏗️ Tech Stack

*   **Frontend:** React 19, TypeScript, Vite (implied).
*   **AI Model:** Google GenAI SDK (`@google/genai`) - **Gemini 3 Pro Preview**.
*   **Styling:** Tailwind CSS, Custom CSS Animations, FontAwesome.
*   **Visualization:** Chart.js, Leaflet.js (injected dynamically).
*   **State Management:** React Hooks (`useState`, `useRef`).

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   A **Google Gemini API Key** (Waitlist/Paid access required for `gemini-3-pro-preview`).

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/globalsight.git
    cd globalsight
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory and add your API key:
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```
    *(Note: The app expects the key via `process.env.API_KEY`)*

4.  **Run the Development Server**
    ```bash
    npm start
    # or
    npm run dev
    ```

5.  **Access the Mission Control**
    Open `http://localhost:3000` (or the port shown in your terminal).

## 📖 Usage Guide

1.  **Input Data:**
    *   **Text:** Type a hypothesis or question.
    *   **Visual:** Drag & drop an image/PDF or click **"Start Field Scan"** to use your device's camera.
    *   **Audio:** Click the microphone to record a voice report describing the context.
    *   **Location:** Click "Add Location" to inject GPS coordinates for geographic grounding.
2.  **Initiate Analysis:** Click the **"Initiate Analysis"** button. The system will stream the response.
3.  **Review Report:**
    *   Read the structured markdown report.
    *   View verified source links (Grounding).
    *   Interact with auto-generated charts/maps in the "Simulation" tab.
    *   Listen to the audio summary.
4.  **Follow Up:** Use the chat interface at the bottom to ask follow-up questions or request specific code simulations.

## 📂 Project Structure
