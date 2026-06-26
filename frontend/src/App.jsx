import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import NavBar from './components/NavBar';
import RecommendationForm from './components/RecommendationForm';
import ResultsPage from './components/ResultsPage';
import EnquiryForm from './components/EnquiryForm';
import Dashboard from './components/Dashboard';
import BookingDetail from './components/BookingDetail';
import Login from './components/Login';
import ChatBot from './components/ChatBot';
import FleetManagement from './components/FleetManagement';
import PassengerHistory from './components/PassengerHistory';
import ConfirmModal from './components/ConfirmModal';

export default function App() {
  return (
    <Router>
      {/* Toast notifications provider */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1F1F1F',
            color: '#F0F0F0',
            border: '1px solid rgba(229,57,53,0.4)',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6), 0 0 20px rgba(229,57,53,0.15)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            padding: '14px 18px',
            maxWidth: '380px',
          },
          success: {
            iconTheme: { primary: '#E53935', secondary: '#fff' },
            style: {
              background: '#1F1F1F',
              color: '#F0F0F0',
              border: '1px solid rgba(229,57,53,0.5)',
            },
          },
          error: {
            iconTheme: { primary: '#EF5350', secondary: '#fff' },
            style: {
              background: '#2A0A0A',
              color: '#F0F0F0',
              border: '1px solid rgba(229,57,53,0.6)',
            },
          },
        }}
      />

      
      <div className="app-container">
        <NavBar />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<RecommendationForm />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/enquiry" element={<EnquiryForm />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/booking/:id" element={<BookingDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/fleet" element={<FleetManagement />} />
            <Route path="/history" element={<PassengerHistory />} />
          </Routes>
        </main>

        <ChatBot />
        {/* Global confirm dialog — replaces browser window.confirm() */}
        <ConfirmModal />
      </div>
    </Router>
  );
}
