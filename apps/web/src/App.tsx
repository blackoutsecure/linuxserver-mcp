import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { AuditPage } from './pages/AuditPage';
import { HomePage } from './pages/HomePage';
import { ImageDetailPage } from './pages/ImageDetailPage';
import { ImageSearchPage } from './pages/ImageSearchPage';
import { RequestsPage } from './pages/RequestsPage';
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/images', element: <ImageSearchPage /> },
      { path: '/images/:name', element: <ImageDetailPage /> },
      { path: '/audit', element: <AuditPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/about', element: <AboutPage /> }
    ]
  }
]);
export function App() {
  return <RouterProvider router={router} />;
}
