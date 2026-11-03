import {
  Cpu,
  Briefcase,
  Sprout,
  Calculator,
  Megaphone,
  Wrench,
  GraduationCap,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cpu: Cpu,
  briefcase: Briefcase,
  sprout: Sprout,
  calculator: Calculator,
  megaphone: Megaphone,
  wrench: Wrench,
};

export function SchoolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? GraduationCap;
  return <Icon className={className} />;
}
