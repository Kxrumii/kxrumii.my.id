import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { WorkSheet } from './components/WorkSheet';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { WorksStage } from './pages/WorksStage';

export default function App() {
  return (
    <BrowserRouter basename="/tugas/pertemuan-9">
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<WorksStage />}>
            <Route path="work/:slug" element={<WorkSheet />} />
          </Route>
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="about" element={<AboutPage />} />
          {/* Contact was removed from the product; old links and bookmarks land on About. */}
          <Route path="contact" element={<Navigate to="/about" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
