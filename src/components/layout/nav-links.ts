import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowRightLeft,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/household", label: "Household", icon: Users },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/settings/household", label: "Settings", icon: Settings },
];

export function isActiveLink(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
