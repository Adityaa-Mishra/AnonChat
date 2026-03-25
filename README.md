# AnonChat

> **Stranger. Anywhere. Now.** — Anonymous real-time random chat app

AnonChat is a minimalist, anonymous chat application that connects you with random strangers for instant conversations. Built with modern web technologies, it offers a clean, distraction-free chatting experience with real-time messaging and file sharing capabilities.

![AnonChat Preview](https://echostranger.netlify.app/)

## ✨ Features

- **🔒 Anonymous**: No accounts, no data storage, no tracking
- **⚡ Real-time**: Instant messaging with WebSocket connections
- **🎯 Random Matching**: Connect with strangers instantly
- **📎 File Sharing**: Share images and videos (up to 10MB)
- **💬 Typing Indicators**: See when your partner is typing
- **🔄 Skip Feature**: Move to next conversation anytime
- **📱 Responsive**: Works on desktop and mobile devices
- **🎨 Dark Theme**: Hacker/brutalist aesthetic with neon accents

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **Multer** - File upload handling

### Frontend
- **Vanilla JavaScript** - No frameworks, pure JS
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with CSS variables
- **Google Fonts** - Syne & Space Mono typography

### Infrastructure
- **In-memory storage** - No database required
- **Local file storage** - For shared media files
- **Express static serving** - Frontend assets

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd anonchat
   ```

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

That's it! The app is now running locally.

## 📖 Usage

### Getting Started
1. **Enter a username** (optional, max 20 characters)
2. **Click "Connect"** to join the waiting queue
3. **Wait for a match** - you'll be paired with a random stranger
4. **Start chatting!**

### Chat Features
- **Send messages** by typing and pressing Enter or clicking Send
- **Share files** by clicking the 📎 button and selecting images/videos
- **Skip conversation** using the "Next" button
- **See online count** in the top navigation
- **View typing indicators** when your partner is typing

### File Sharing
- **Supported formats**: Images (JPG, PNG, GIF, WebP) and Videos (MP4, WebM, OGV)
- **Size limit**: 10MB per file
- **Instant sharing**: Files appear immediately in chat
- **Click to view**: Images open in new tab for full-size viewing

## 🏗️ Project Structure

```
anonchat/
├── backend/                 # Server-side code
│   ├── server.js           # Main Express server
│   ├── socket/             # WebSocket handlers
│   │   └── index.js        # Socket.io logic
│   └── package.json        # Backend dependencies
├── frontend/               # Client-side code
│   ├── index.html          # Main HTML page
│   ├── app.js             # Frontend JavaScript
│   └── style.css          # Stylesheets
├── uploads/               # Uploaded files storage
├── package-lock.json      # Dependency lock file
└── README.md             # This file
```

## 🔧 Development

### Development Mode
For development with auto-restart:
```bash
cd backend
npm run dev
```

### Building for Production
The app is ready for production deployment on any Node.js hosting service (Heroku, DigitalOcean, etc.).

### Environment Variables
NIL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Keep the codebase simple and minimal
- Maintain the anonymous, privacy-focused ethos
- Test thoroughly before submitting changes
- Follow existing code style and structure

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## ⚠️ Important Notes

- **No data persistence**: All conversations are temporary and disappear on server restart
- **Local file storage**: Uploaded files are stored locally and may accumulate over time
- **No moderation**: Content is unmoderated - use responsibly
- **Development only**: Not intended for production use without additional security measures

## 🐛 Troubleshooting

### Common Issues

**"Online count shows 0"**
- Make sure the server is running on the correct port
- Check browser console for WebSocket connection errors
- Try opening the app in an incognito/private window

**"File upload fails"**
- Check file size (must be under 10MB)
- Ensure file is an image or video format
- Verify the `uploads/` directory exists and is writable

**"Cannot connect to server"**
- Ensure Node.js and npm are installed
- Check that port 3000 is not in use by another application
- Try restarting the server

## 🙏 Acknowledgments

- Built with [Socket.io](https://socket.io/) for real-time communication
- Inspired by anonymous chat platforms
- Typography from [Google Fonts](https://fonts.google.com/)

---

**Made with ❤️ for the curious and the anonymous**