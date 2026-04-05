'use client';

import { useState, useCallback, useEffect } from 'react';
import { GripVertical, Pencil, Trash2, Plus, X, Check, AlertTriangle } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter, ModalClose } from '@/components/ui/Modal';
import type { MarkerGroup } from '@deproceduralizer/database';
import { getMarkerGroupBookmarkCount } from '@/lib/actions/marker-groups';

interface DeleteConfirmState {
  groupId: number;
  groupName: string;
  bookmarkCount: number;
  loading: boolean;
}

interface MarkerGroupManagerProps {
  groups: MarkerGroup[];
  jurisdiction?: string;
  bookmarkCounts?: Map<number, number>;
  onCreateGroup: (name: string, color: string) => Promise<void>;
  onUpdateGroup: (id: number, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteGroup: (id: number) => Promise<void>;
  onDeleteGroupAndUnmarkAll: (id: number) => Promise<void>;
  onReorder: (ids: number[]) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
  '#22c55e', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f59e0b', '#6b7280',
];

export function MarkerGroupManager({
  groups,
  jurisdiction,
  bookmarkCounts,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onDeleteGroupAndUnmarkAll,
  onReorder,
  open,
  onOpenChange,
}: MarkerGroupManagerProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  // Reset delete confirmation when modal closes
  useEffect(() => {
    if (!open) setDeleteConfirm(null);
  }, [open]);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateGroup(trimmed, newColor);
      setNewName('');
      setNewColor('#6b7280');
    } finally {
      setIsSubmitting(false);
    }
  }, [newName, newColor, isSubmitting, onCreateGroup]);

  const handleStartEdit = useCallback((group: MarkerGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditColor(group.color);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUpdateGroup(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [editingId, editName, editColor, isSubmitting, onUpdateGroup]);

  const handleDeleteClick = useCallback(async (group: MarkerGroup) => {
    if (isSubmitting) return;
    // Fetch bookmark count for the confirmation dialog
    setDeleteConfirm({ groupId: group.id, groupName: group.name, bookmarkCount: 0, loading: true });
    const result = await getMarkerGroupBookmarkCount(group.id);
    setDeleteConfirm(prev =>
      prev?.groupId === group.id
        ? { ...prev, bookmarkCount: result.success ? result.data : 0, loading: false }
        : prev
    );
  }, [isSubmitting]);

  const handleConfirmRemoveCategoryOnly = useCallback(async () => {
    if (!deleteConfirm || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDeleteGroup(deleteConfirm.groupId);
      setDeleteConfirm(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteConfirm, isSubmitting, onDeleteGroup]);

  const handleConfirmUnmarkAll = useCallback(async () => {
    if (!deleteConfirm || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDeleteGroupAndUnmarkAll(deleteConfirm.groupId);
      setDeleteConfirm(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteConfirm, isSubmitting, onDeleteGroupAndUnmarkAll]);

  const handleDragStart = useCallback((id: number) => {
    setDraggedId(id);
    setPendingOrder(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;

    const currentOrder = (pendingOrder ?? groups.map(g => g.id));
    const fromIndex = currentOrder.indexOf(draggedId);
    const toIndex = currentOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedId);
    setPendingOrder(newOrder);
  }, [draggedId, groups, pendingOrder]);

  const handleDragEnd = useCallback(() => {
    if (pendingOrder) {
      onReorder(pendingOrder);
    }
    setDraggedId(null);
    setPendingOrder(null);
  }, [pendingOrder, onReorder]);

  // During drag, show groups in the pending order for immediate visual feedback
  const displayGroups = pendingOrder
    ? pendingOrder.map(id => groups.find(g => g.id === id)).filter((g): g is MarkerGroup => g !== undefined)
    : groups;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <div>
            <ModalTitle>Manage Labels</ModalTitle>
            <ModalDescription>
              Create, edit, and reorder labels. Drag to reorder.
            </ModalDescription>
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody>
        {/* Group list */}
        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
          {displayGroups.map((group) => {
            const count = bookmarkCounts?.get(group.id) ?? 0;
            const isEditing = editingId === group.id;

            return (
              <div
                key={group.id}
                draggable={!isEditing}
                onDragStart={() => handleDragStart(group.id)}
                onDragOver={(e) => handleDragOver(e, group.id)}
                onDragEnd={handleDragEnd}
                className={`
                  group flex items-center gap-2 px-2 py-1.5
                  rounded-[var(--radius-sm)]
                  ${draggedId === group.id ? 'opacity-50' : ''}
                  ${isEditing ? 'bg-[var(--color-primary-weaker)]' : 'hover:bg-[var(--color-neutral-50)]'}
                  transition-colors duration-[var(--duration-fast)]
                `}
              >
                <GripVertical className="w-4 h-4 text-[var(--color-text-muted)] cursor-grab shrink-0" />

                {isEditing ? (
                  <>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="
                        flex-1 px-2 py-0.5 text-sm
                        bg-[var(--color-surface)]
                        border border-[var(--color-primary-weak)]
                        rounded-[var(--radius-sm)]
                        text-[var(--color-text)]
                        outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)]
                      "
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={isSubmitting || !editName.trim()}
                      className="p-1 text-[var(--color-success)] hover:bg-[var(--color-success-bg)] rounded-[var(--radius-sm)] cursor-pointer disabled:opacity-40"
                      aria-label="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-100)] rounded-[var(--radius-sm)] cursor-pointer"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="flex-1 text-sm text-[var(--color-text)] truncate">
                      {group.name}
                    </span>
                    {count > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
                    )}
                    {group.category !== 'triage' && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(group)}
                        className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-neutral-100)] rounded-[var(--radius-sm)] cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Edit ${group.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {group.category !== 'triage' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(group)}
                        disabled={isSubmitting || deleteConfirm !== null}
                        className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-[var(--radius-sm)] cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
                        aria-label={`Delete ${group.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="mt-3 p-3 rounded-[var(--radius-md)] border border-[var(--color-danger-weak)] bg-[var(--color-danger-bg)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Delete &lsquo;{deleteConfirm.groupName}&rsquo;?
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {deleteConfirm.loading
                    ? 'Checking...'
                    : deleteConfirm.bookmarkCount === 0
                      ? 'No items are marked with this label.'
                      : `${deleteConfirm.bookmarkCount} item${deleteConfirm.bookmarkCount === 1 ? '' : 's'} marked with this label.`
                  }
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmRemoveCategoryOnly}
                    disabled={isSubmitting || deleteConfirm.loading}
                    className="
                      px-2.5 py-1 text-xs font-medium
                      text-[var(--color-text-secondary)]
                      bg-[var(--color-surface)]
                      border border-[var(--color-neutral-300)]
                      hover:bg-[var(--color-neutral-100)]
                      rounded-[var(--radius-sm)]
                      cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors duration-[var(--duration-fast)]
                    "
                  >
                    Remove label only
                  </button>
                  {!deleteConfirm.loading && deleteConfirm.bookmarkCount > 0 && (
                    <button
                      type="button"
                      onClick={handleConfirmUnmarkAll}
                      disabled={isSubmitting}
                      className="
                        px-2.5 py-1 text-xs font-medium
                        text-[var(--color-text-inverse)]
                        bg-[var(--color-danger)]
                        hover:bg-[var(--color-danger-strong)]
                        rounded-[var(--radius-sm)]
                        cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-[var(--duration-fast)]
                      "
                    >
                      Unmark all items
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    disabled={isSubmitting}
                    className="
                      px-2.5 py-1 text-xs font-medium
                      text-[var(--color-text-muted)]
                      hover:text-[var(--color-text)]
                      cursor-pointer
                      disabled:opacity-50
                      transition-colors duration-[var(--duration-fast)]
                    "
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add new group */}
        <div className="mt-4 border-t border-[var(--color-neutral-200)] pt-4">
          <div className="flex items-center gap-2">
            <ColorPicker value={newColor} onChange={setNewColor} />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="New label name..."
              className="
                flex-1 px-2 py-1.5 text-sm
                bg-[var(--color-neutral-50)]
                border border-[var(--color-neutral-200)]
                rounded-[var(--radius-sm)]
                text-[var(--color-text)]
                placeholder:text-[var(--color-text-muted)]
                outline-none focus:ring-1 focus:ring-[var(--color-focus-ring)] focus:border-[var(--color-primary)]
              "
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting || !newName.trim()}
              className="
                inline-flex items-center gap-1
                px-3 py-1.5
                text-sm font-medium
                text-[var(--color-text-inverse)]
                bg-[var(--color-primary)]
                hover:bg-[var(--color-primary-strong)]
                rounded-[var(--radius-sm)]
                cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-[var(--duration-fast)]
              "
              aria-label="Create label"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
        </ModalBody>

        <ModalFooter>
          <ModalClose asChild>
            <button
              type="button"
              className="
                px-4 py-2
                text-sm font-medium
                text-[var(--color-text-secondary)]
                bg-[var(--color-neutral-100)]
                hover:bg-[var(--color-neutral-200)]
                rounded-[var(--radius-md)]
                cursor-pointer
                transition-colors duration-[var(--duration-fast)]
              "
            >
              Done
            </button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * Small color picker button with popover presets.
 */
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-6 h-6 rounded-full shrink-0
          border-2 border-[var(--color-neutral-200)]
          cursor-pointer
          hover:border-[var(--color-neutral-400)]
          transition-colors duration-[var(--duration-fast)]
          focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1
          outline-none
        "
        style={{ backgroundColor: value }}
        aria-label="Pick color"
      />
      {isOpen && (
        <div
          className="
            absolute left-0 top-full mt-1 z-[var(--z-dropdown)]
            p-2 rounded-[var(--radius-md)]
            bg-[var(--color-surface)] border border-[var(--color-neutral-200)]
            shadow-lg
            grid grid-cols-5 gap-1
          "
        >
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setIsOpen(false);
              }}
              className={`
                w-6 h-6 rounded-full cursor-pointer
                border-2
                ${c === value ? 'border-[var(--color-primary)] scale-110' : 'border-transparent hover:border-[var(--color-neutral-300)]'}
                transition-all duration-[var(--duration-fast)]
              `}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
