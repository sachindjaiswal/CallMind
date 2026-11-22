import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import DailyReportsPage from "@/pages/daily-reports";
import DashboardPage from "@/pages/dashboard";
import NotFoundPage from "@/pages/not-found";
import RecordingsPage from "@/pages/recordings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="recordings" element={<RecordingsPage />} />
        <Route path="daily-reports" element={<DailyReportsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
