import { BrowserRouter, Route, Routes } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { BookDetailPage } from './pages/BookDetailPage';
import { CatalogLayout } from './pages/CatalogLayout';
import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter basename="/tugas/pertemuan-8">
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogLayout />}>
            <Route index element={<CatalogPage />} />
            <Route path=":bookId" element={<BookDetailPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
