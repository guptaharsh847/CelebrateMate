import { Route, Routes } from 'react-router-dom';
import { AuthGate } from '@/components/auth/AuthGate';
import { AppShell } from '@/components/layout/AppShell';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { WishComposerProvider } from '@/components/wishes/WishComposerProvider';
import { CalendarPage } from '@/pages/CalendarPage';
import { ContactDetailPage } from '@/pages/ContactDetailPage';
import { ContactFormPage } from '@/pages/ContactFormPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TemplatesPage } from '@/pages/TemplatesPage';

export default function App() {
  return (
    <AuthGate>
      <WishComposerProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/new" element={<ContactFormPage />} />
            <Route path="contacts/:contactId" element={<ContactDetailPage />} />
            <Route path="contacts/:contactId/edit" element={<ContactFormPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </WishComposerProvider>
    </AuthGate>
  );
}
