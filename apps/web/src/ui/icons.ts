/*
 * The app's one icon set: Lucide stroke icons (BLUEPRINT §7), drawn at 1.75px like the prototype.
 * Components import icons from here under the names of what they mean, never from lucide-react
 * directly, so the set stays consistent and can change in one place.
 */

export type { LucideIcon as IconComponent } from "lucide-react";
export { LucideProvider as IconProvider } from "lucide-react";

export {
  // Navigation
  LayoutDashboard as IconDashboard,
  ClipboardList as IconOrders,
  Inbox as IconIntake,
  Wallet as IconReceivables,
  Building2 as IconClients,
  MapPin as IconLocation,
  Package as IconPackage,
  Ellipsis as IconMore,
  House as IconHome,
  Shapes as IconGallery,

  // Order statuses
  PenLine as IconDraft,
  CircleCheck as IconConfirmed,
  Truck as IconDelivery,
  ReceiptText as IconBilled,
  Contrast as IconPartlyPaid,
  CheckCheck as IconPaid,
  Ban as IconCancelled,

  // Actions
  Search as IconSearch,
  Plus as IconPlus,
  Pencil as IconEdit,
  Trash2 as IconDelete,
  Copy as IconCopy,
  Upload as IconUpload,
  Download as IconDownload,
  Printer as IconPrint,
  Link as IconLink,
  RefreshCw as IconRetry,
  Undo2 as IconUndo,
  ExternalLink as IconExternal,
  Filter as IconFilter,
  SlidersHorizontal as IconAdjust,
  Lock as IconLock,
  LockOpen as IconUnlock,
  Phone as IconPhone,
  MessageSquareText as IconSms,
  Sparkles as IconAi,
  Camera as IconCamera,

  // Direction and disclosure
  ArrowLeft as IconBack,
  ArrowRight as IconForward,
  ArrowUp as IconSortAscending,
  ArrowDown as IconSortDescending,
  ArrowUpDown as IconSortable,
  ChevronDown as IconChevronDown,
  ChevronUp as IconChevronUp,
  ChevronRight as IconChevronRight,
  ChevronLeft as IconChevronLeft,
  ChevronsUpDown as IconSelect,
  TrendingUp as IconTrendUp,
  TrendingDown as IconTrendDown,
  Minus as IconTrendFlat,
  X as IconClose,
  CornerDownLeft as IconEnterKey,

  // Feedback
  Check as IconCheck,
  CircleCheck as IconSuccess,
  Info as IconInfo,
  TriangleAlert as IconWarning,
  CircleAlert as IconError,
  LoaderCircle as IconSpinner,
  WifiOff as IconOffline,
  CloudOff as IconServerOff,

  // Things in the business
  FileText as IconDocument,
  FileSpreadsheet as IconSpreadsheet,
  Image as IconImage,
  Table2 as IconSchedule,
  CalendarDays as IconCalendar,
  Clock as IconClock,
  History as IconHistory,
  Users as IconUsers,
  Banknote as IconCash,
  Route as IconRoute,
  Utensils as IconFood,

  // Preferences
  Sun as IconLight,
  Moon as IconDark,
  Monitor as IconDevice,
  Languages as IconLanguage,
  Keyboard as IconKeyboard,
} from "lucide-react";
