import { BrowserRouter, Route, Routes } from 'react-router';
import { SiteLayout } from './components/SiteLayout';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { WorkDetailPage } from './pages/WorkDetailPage';
import { WorkPage } from './pages/WorkPage';

export default function App() {
  return (
    <BrowserRouter basename="/tugas/pertemuan-7">
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<WorkPage />} />
          <Route path="work/:slug" element={<WorkDetailPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
