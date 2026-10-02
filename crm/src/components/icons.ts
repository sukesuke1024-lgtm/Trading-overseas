import { Calendar, Handshake, Mail, MessageSquareText, Phone, Presentation, FileText, Receipt, Video, type LucideIcon } from "lucide-react";
import type { ActivityType } from "@/lib/types";

export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  call: Phone, email: Mail, visit: Handshake, online: Video, expo: Presentation, referral: MessageSquareText, material: FileText, quote: Receipt, other: Calendar,
};
