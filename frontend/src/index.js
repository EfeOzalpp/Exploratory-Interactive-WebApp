// src/index.js
import App from './entry/App';
import ReactDOM from 'react-dom/client'; // Import the createRoot method
import './static-assets/fonts/fonts1.css';

// Create a root for React 18
const root = ReactDOM.createRoot(document.getElementById('butterfly-effect'));

// Render the App component
root.render(
    <App />
);
