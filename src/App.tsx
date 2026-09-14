import { AdminApp } from './admin/AdminApp';
import { FestivalApp } from './festival/FestivalApp';
import { useRoute } from './hooks/useRoute';

export function App() {
  const { path, navigate } = useRoute();
  const isAdmin = path.startsWith('/admin');

  return isAdmin ? <AdminApp navigate={navigate} /> : <FestivalApp navigate={navigate} />;
}
