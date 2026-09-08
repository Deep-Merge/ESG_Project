import {
  Briefcase,
  FileBarChart,
  Landmark,
  LayoutGrid,
  Leaf,
  Percent,
  ScrollText,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

export const TOPIC_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  governance: Landmark,
  policy: ScrollText,
  climate: Leaf,
  risk: Shield,
  "investment-process": Briefcase,
  social: Users,
  reporting: FileBarChart,
  metrics: Percent,
};

export function topicIcon(id: string): LucideIcon {
  return TOPIC_ICONS[id] || LayoutGrid;
}
