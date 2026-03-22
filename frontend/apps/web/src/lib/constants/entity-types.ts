import {
  FileText,
  Scale,
  ClipboardList,
  BookOpen,
  Link2,
  Library,
  MessageSquare,
  Tag,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

/**
 * The 10 core data entity types in the application.
 * Each type has a distinct visual identity (icon + color palette).
 */
export type EntityType =
  | 'regulatory_document'
  | 'statute'
  | 'compliance_issue'
  | 'definition'
  | 'cross_reference'
  | 'ibr_standard'
  | 'guidance_document'
  | 'note'
  | 'bookmark'
  | 'marker';

export interface EntityTypeConfig {
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * Canonical visual identity for each entity type.
 *
 * Uses Tailwind -50 backgrounds and -600 icon colors, distinct from
 * SectionTypeBadge (-100/-800) and semantic status colors (CSS variables).
 * Entity types communicate *what* something is; status badges communicate
 * *how* it's doing.
 */
export const ENTITY_TYPES: Record<EntityType, EntityTypeConfig> = {
  regulatory_document: {
    icon: FileText,
    label: 'Regulatory Document',
    shortLabel: 'Regulation',
    iconColor: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-700',
  },
  statute: {
    icon: Scale,
    label: 'Statute',
    shortLabel: 'Statute',
    iconColor: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    textColor: 'text-violet-700',
  },
  compliance_issue: {
    icon: ClipboardList,
    label: 'Compliance Issue',
    shortLabel: 'Issue',
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
  },
  definition: {
    icon: BookOpen,
    label: 'Definition',
    shortLabel: 'Definition',
    iconColor: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-300',
    textColor: 'text-sky-700',
  },
  cross_reference: {
    icon: Link2,
    label: 'Cross-Reference',
    shortLabel: 'Xref',
    iconColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-700',
  },
  ibr_standard: {
    icon: Library,
    label: 'IBR Standard',
    shortLabel: 'IBR',
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
  },
  guidance_document: {
    icon: ScrollText,
    label: 'Guidance Document',
    shortLabel: 'Guidance',
    iconColor: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-300',
    textColor: 'text-teal-700',
  },
  note: {
    icon: MessageSquare,
    label: 'Note',
    shortLabel: 'Note',
    iconColor: 'text-stone-600',
    bgColor: 'bg-stone-50',
    borderColor: 'border-stone-300',
    textColor: 'text-stone-700',
  },
  bookmark: {
    icon: Tag,
    label: 'Label',
    shortLabel: 'Label',
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-700',
  },
  marker: {
    icon: Tag,
    label: 'Label',
    shortLabel: 'Label',
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-700',
  },
} as const;

/** Get the full config for an entity type. */
export function getEntityConfig(type: EntityType): EntityTypeConfig {
  return ENTITY_TYPES[type];
}

/** Get just the icon component for an entity type. */
export function getEntityIcon(type: EntityType): LucideIcon {
  return ENTITY_TYPES[type].icon;
}
