import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login         from "./pages/Login";
import Home          from "./pages/Home";
import Quiz          from "./pages/Quiz";
import Results       from "./pages/Results";
import DailyLearning from "./pages/DailyLearning";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/"
            element={<ProtectedRoute><Home /></ProtectedRoute>}
          />
          <Route path="/daily"
            element={<ProtectedRoute><DailyLearning /></ProtectedRoute>}
          />
          <Route path="/quiz/:paperId/part/:partNumber"
            element={<ProtectedRoute><Quiz /></ProtectedRoute>}
          />
          <Route path="/quiz/:paperId"
            element={<ProtectedRoute><Quiz /></ProtectedRoute>}
          />
          <Route path="/results/:quizId"
            element={<ProtectedRoute><Results /></ProtectedRoute>}
          />
          <Route path="*"
            element={<ProtectedRoute><Home /></ProtectedRoute>}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}