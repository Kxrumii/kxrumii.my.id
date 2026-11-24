import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { WorkSheet } from './components/WorkSheet';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { WorksStage } from './pages/WorksStage';

export default function App() {
  return (
    <BrowserRouter basename="/tugas/pertemuan-7">
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<WorksStage />}>
            <Route path="work/:slug" element={<WorkSheet />} />
          </Route>
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
