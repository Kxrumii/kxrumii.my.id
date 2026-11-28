import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectPage } from './pages/ProjectPage';
import { WorksPage } from './pages/WorksPage';

export default function App() {
  return (
    <BrowserRouter basename="/tugas/pertemuan-7">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<WorksPage />} />
          <Route path="work/:slug" element={<ProjectPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
