import { CalendarDays, FileText, History, LayoutDashboard, Settings, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Shown in the mobile bottom bar (max 5). Templates is reachable from Settings on mobile. */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true, mobile: true },
  { to: '/contacts', label: 'Contacts', icon: Users, mobile: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, mobile: true },
  { to: '/history', label: 'Wishes', icon: History, mobile: true },
  { to: '/templates', label: 'Templates', icon: FileText, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: true },
];
