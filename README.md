
# ScribeAI

A modern, responsive AI-powered chat application built with vanilla JavaScript that provides intelligent conversations with document export capabilities.

## Features

- **Real-time AI Chat**: Interactive conversations powered by Groq's Llama3 model
- **Markdown Support**: Rich text formatting with syntax highlighting
- **PDF Export**: Download conversations as formatted PDF documents
- **Chat History**: Persistent local storage of conversation history
- **Responsive Design**: Mobile-first design that works on all devices
- **Context-Aware**: Maintains conversation context across messages
- **Stream Processing**: Real-time response streaming for better user experience

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **AI Provider**: Groq API (Llama3-8b-8192 model)
- **Libraries**:
  - Marked.js for Markdown parsing
  - DOMPurify for content sanitization
  - Highlight.js for code syntax highlighting
  - html2pdf.js for PDF generation
- **Storage**: Local Storage for chat persistence

## Project Structure

```
ScribeAI/
├── index.html              # Main HTML file
├── css/
│   └── style.css          # Application styles
├── js/
│   ├── main.js            # Application initialization
│   ├── api.js             # AI API integration
│   ├── chat.js            # Chat functionality
│   ├── ui.js              # User interface handlers
│   ├── storage.js         # Data persistence
│   ├── pdf.js             # PDF export functionality
│   └── toast.js           # Notification system
└── README.md              # Project documentation
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/scribeai.git
cd scribeai
```

2. Open `index.html` in your web browser or serve it using a local web server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

3. Navigate to `http://localhost:8000` in your browser.

## Configuration

The application uses the Groq API for AI responses. The API key is currently embedded in the code for demo purposes. For production use:

1. Sign up for a Groq API account at [https://groq.com](https://groq.com)
2. Replace the API key in `js/api.js`:
```javascript
'Authorization': `Bearer YOUR_API_KEY_HERE`
```

## Usage

### Starting a Conversation
1. Type your message in the input field at the bottom
2. Press Enter or click the send button
3. Wait for the AI response to stream in real-time

### Managing Chat History
- **New Chat**: Click the "+" button in the header
- **View History**: Click the menu button to open the sidebar
- **Rename Chat**: Right-click on a chat in the sidebar and select "Rename"
- **Delete Chat**: Right-click on a chat in the sidebar and select "Delete"
- **Clear All**: Click "Clear" in the sidebar header

### Exporting to PDF
- Click the "Download PDF" button below any AI response
- The PDF will include formatted content with proper styling
- Generated PDFs maintain markdown formatting and code highlighting

## Features in Detail

### AI Integration
- Uses Groq's Llama3-8b-8192 model for high-quality responses
- Streaming responses for real-time interaction
- Context-aware conversations with message history
- Temperature and top-p parameters optimized for balanced responses

### User Interface
- Clean, modern design with purple accent color (#6a0dad)
- Responsive layout that adapts to mobile devices
- Dark/light theme support through CSS variables
- Smooth animations and transitions

### Data Management
- Local storage for chat persistence
- Automatic keyword extraction for search functionality
- Chat history with timestamps and titles
- Efficient storage management with 50-chat limit

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Groq](https://groq.com) for AI API services
- [Marked.js](https://marked.js.org/) for Markdown parsing
- [Highlight.js](https://highlightjs.org/) for syntax highlighting
- [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) for PDF generation

## Support

If you encounter any issues or have questions, please:
1. Check the browser console for error messages
2. Ensure you have a stable internet connection
3. Verify that JavaScript is enabled in your browser
4. Open an issue on GitHub with detailed information

---

**Note**: This application requires an active internet connection for AI responses and uses local storage for data persistence.
