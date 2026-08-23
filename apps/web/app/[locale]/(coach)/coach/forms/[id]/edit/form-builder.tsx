'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Link2,
  Plus,
  PencilRuler,
  Eye,
  LayoutTemplate,
  FileText,
} from 'lucide-react';
import {
  addSection,
  addField,
  removeSection,
  removeField,
  updateSection,
  updateField,
  reorderSections,
  moveField,
  type FieldType,
  type FormSchema,
  type FormField,
} from '@ca-tempo/domain';
import { FIELD_ICON, FIELD_GROUP_ORDER, FIELDS_BY_GROUP } from '@/lib/forms/catalog';
import { TEMPLATE_IDS, TEMPLATES, type TemplateId } from '@/lib/forms/templates';
import { FormRenderer } from '@/components/forms/form-renderer';
import { saveDraft, publishForm, type FormDetail } from '../../actions';
import { FieldEditor } from './field-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Props = Readonly<{
  initial: FormDetail;
}>;

type DragItem =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'field'; id: string; sectionId: string; label: string };

/* ----------------------------- Sortable Section ---------------------------- */

type SortableSectionProps = Readonly<{
  sectionId: string;
  title: string;
  description: string;
  fieldCount: number;
  children: React.ReactNode;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onRemove: () => void;
}>;

function SortableSection({
  sectionId,
  title,
  description,
  fieldCount,
  children,
  onTitleChange,
  onDescriptionChange,
  onRemove,
}: SortableSectionProps) {
  const t = useTranslations('forms');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section:${sectionId}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-input bg-card">
      <div className="flex items-start gap-2 border-b border-input px-3 py-2">
        <button
          type="button"
          className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={t('dragSection')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={title}
            placeholder={t('sectionTitle')}
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-8 border-transparent bg-transparent px-1 text-base font-semibold shadow-none focus-visible:border-input"
          />
          <Input
            value={description}
            placeholder={t('sectionDescription')}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="h-7 border-transparent bg-transparent px-1 text-xs text-muted-foreground shadow-none focus-visible:border-input"
          />
        </div>
        <Badge variant="secondary" className="mt-1 shrink-0">
          {fieldCount}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 shrink-0"
          onClick={onRemove}
          aria-label={t('removeSection')}
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ------------------------------ Sortable Field ----------------------------- */

type SortableFieldProps = Readonly<{
  field: FormField;
  sectionId: string;
  selected: boolean;
  onSelect: () => void;
  onLabelChange: (v: string) => void;
  onRemove: () => void;
}>;

function SortableField({
  field,
  sectionId,
  selected,
  onSelect,
  onLabelChange,
  onRemove,
}: SortableFieldProps) {
  const t = useTranslations('forms');
  const Icon = FIELD_ICON[field.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `field:${sectionId}:${field.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
        selected ? 'border-accent-500 bg-accent-500/10' : 'border-input hover:border-muted-foreground/40'
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label={t('dragField')}
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

      <Input
        value={field.label ?? ''}
        placeholder={t('fieldLabelPlaceholder')}
        onFocus={onSelect}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-7 flex-1 border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:border-input"
      />

      {field.required ? <span className="text-danger" title={t('fieldRequired')}>*</span> : null}
      {field.mapsTo ? (
        <Link2 className="h-3.5 w-3.5 shrink-0 text-success" aria-label={t('mapsToBadge')} />
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={t('removeField')}
      >
        <Trash2 className="h-3.5 w-3.5 text-danger" />
      </Button>
    </div>
  );
}

/* -------------------------------- Palette ---------------------------------- */

function Palette({ onAdd }: Readonly<{ onAdd: (type: FieldType) => void }>) {
  const t = useTranslations('forms');
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Plus className="h-3.5 w-3.5" />
        {t('paletteTitle')}
      </p>
      {FIELD_GROUP_ORDER.map((group) => (
        <div key={group} className="space-y-1.5">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {t(`fieldGroups.${group}`)}
          </p>
          <div className="grid gap-1">
            {FIELDS_BY_GROUP[group].map((type) => {
              const Icon = FIELD_ICON[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  title={t(`fieldTypes.${type}.description`)}
                  className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5 text-left text-sm transition-colors hover:border-accent-500 hover:bg-accent-500/10"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t(`fieldTypes.${type}.label`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Empty state -------------------------------- */

function TemplatePicker({
  onPick,
  onBlank,
}: Readonly<{ onPick: (id: TemplateId) => void; onBlank: () => void }>) {
  const t = useTranslations('forms');
  return (
    <div className="rounded-lg border border-dashed border-input p-6 text-center">
      <LayoutTemplate className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <h3 className="font-display text-lg uppercase tracking-wide">{t('startTitle')}</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">{t('startSubtitle')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="rounded-lg border border-input p-4 text-left transition-colors hover:border-accent-500 hover:bg-accent-500/10"
          >
            <FileText className="mb-2 h-5 w-5 text-accent-500" />
            <p className="font-medium">{t(`templates.${id}.name`)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t(`templates.${id}.description`)}</p>
          </button>
        ))}
      </div>
      <Button type="button" variant="outline" className="mt-4" onClick={onBlank}>
        {t('startBlank')}
      </Button>
    </div>
  );
}

/* ------------------------------- Form builder ------------------------------ */

export function FormBuilder({ initial }: Props) {
  const t = useTranslations('forms');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [formMeta, setFormMeta] = useState(initial.form);
  const [schema, setSchema] = useState<FormSchema>(initial.editableVersion.schema);
  const [savedSchema, setSavedSchema] = useState<FormSchema>(initial.editableVersion.schema);
  const [hasDraft, setHasDraft] = useState(initial.hasDraft);
  const [publishedVersion, setPublishedVersion] = useState(initial.publishedVersion?.version ?? null);
  const [selected, setSelected] = useState<{ sectionId: string; fieldId: string } | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragItem | null>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(schema) !== JSON.stringify(savedSchema),
    [schema, savedSchema],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const sortableSectionIds = schema.sections.map((s) => `section:${s.id}`);

  /* ------------------------------- Drag & drop ----------------------------- */

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      if (id.startsWith('section:')) {
        const secId = id.slice(8);
        const sec = schema.sections.find((s) => s.id === secId);
        setActiveDrag({ kind: 'section', id: secId, label: sec?.title || t('untitledSection') });
      } else if (id.startsWith('field:')) {
        const [, sectionId, fieldId] = id.split(':');
        const f = schema.sections.find((s) => s.id === sectionId)?.fields.find((x) => x.id === fieldId);
        setActiveDrag({ kind: 'field', id: fieldId, sectionId, label: f?.label || t('untitledField') });
      }
    },
    [schema, t],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('section:') && overId.startsWith('section:')) {
      setSchema((s) => reorderSections(s, activeId.slice(8), overId.slice(8)));
      return;
    }

    if (activeId.startsWith('field:')) {
      const [, fromSectionId, fieldId] = activeId.split(':');
      if (overId.startsWith('field:')) {
        const [, toSectionId, overFieldId] = overId.split(':');
        setSchema((s) => moveField(s, fieldId, fromSectionId, toSectionId, overFieldId));
      } else if (overId.startsWith('section:')) {
        const toSectionId = overId.slice(8);
        setSchema((s) => {
          const target = s.sections.find((sec) => sec.id === toSectionId);
          return moveField(s, fieldId, fromSectionId, toSectionId, target?.fields.length ?? 0);
        });
      }
    }
  }, []);

  /* ------------------------------- Mutations ------------------------------- */

  function handleAddSection() {
    setSchema((s) => addSection(s, { title: t('sectionN', { n: s.sections.length + 1 }) }));
  }

  /** Adiciona um campo na seção "ativa" (a do campo selecionado, ou a última; cria uma se não houver). */
  function handleAddFieldFromPalette(type: FieldType) {
    let newSel: { sectionId: string; fieldId: string } | null = null;
    setSchema((s) => {
      let next = s;
      let secId = selected?.sectionId ?? s.sections.at(-1)?.id ?? null;
      if (!secId || !next.sections.some((x) => x.id === secId)) {
        next = addSection(next, { title: t('sectionN', { n: next.sections.length + 1 }) });
        secId = next.sections.at(-1)!.id;
      }
      next = addField(next, secId, { type, label: t(`fieldTypes.${type}.label`) });
      const fid = next.sections.find((x) => x.id === secId)?.fields.at(-1)?.id;
      if (fid) newSel = { sectionId: secId, fieldId: fid };
      return next;
    });
    if (newSel) setSelected(newSel);
  }

  function applyTemplate(id: TemplateId) {
    setSchema(TEMPLATES[id]());
    setSelected(null);
    setMessage(t('templateApplied'));
  }

  const handleRemoveSection = useCallback((sectionId: string) => {
    setSchema((s) => removeSection(s, sectionId));
    setSelected((sel) => (sel?.sectionId === sectionId ? null : sel));
  }, []);

  const handleRemoveField = useCallback((sectionId: string, fieldId: string) => {
    setSchema((s) => removeField(s, sectionId, fieldId));
    setSelected((sel) => (sel?.fieldId === fieldId ? null : sel));
  }, []);

  const handleFieldChange = useCallback(
    (sectionId: string, fieldId: string, patch: Partial<FormField>) => {
      setSchema((s) => updateField(s, sectionId, fieldId, patch));
    },
    [],
  );

  /* -------------------------------- Persist -------------------------------- */

  function persistDraft() {
    return saveDraft(formMeta.id, schema, {
      name: formMeta.name,
      description: formMeta.description,
      success_message: formMeta.success_message,
      requires_waiver: formMeta.requires_waiver,
    });
  }

  function handleSaveDraft() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await persistDraft();
      if (res.ok) {
        setSavedSchema(schema);
        setHasDraft(true);
        setMessage(t('saved'));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handlePublish() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (isDirty) {
        const saveRes = await persistDraft();
        if (!saveRes.ok) {
          setError(saveRes.error);
          return;
        }
        setSavedSchema(schema);
      }
      const res = await publishForm(formMeta.id);
      if (res.ok) {
        setPublishedVersion(res.version);
        setHasDraft(false);
        setFormMeta((m) => ({ ...m, status: 'published' }));
        setMessage(t('published', { version: res.version }));
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const selectedField = selected
    ? schema.sections
        .find((s) => s.id === selected.sectionId)
        ?.fields.find((f) => f.id === selected.fieldId)
    : null;

  const isEmpty = schema.sections.length === 0;

  /* --------------------------------- Render -------------------------------- */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide">{formMeta.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={formMeta.status === 'published' ? 'success' : 'secondary'}>
              {formMeta.status === 'published' ? t('statusPublished') : t('statusDraft')}
            </Badge>
            {publishedVersion !== null ? (
              <Badge variant="outline">{t('version', { version: publishedVersion })}</Badge>
            ) : null}
            {(hasDraft || isDirty) && formMeta.status === 'published' ? (
              <Badge variant="warning">{t('unpublishedChanges')}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs Editor / Pré-visualizar */}
          <div className="flex rounded-md border border-input p-0.5">
            <button
              type="button"
              onClick={() => setView('edit')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                view === 'edit' ? 'bg-accent-500/15 text-foreground' : 'text-muted-foreground'
              }`}
            >
              <PencilRuler className="h-4 w-4" />
              {t('tabEdit')}
            </button>
            <button
              type="button"
              onClick={() => setView('preview')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                view === 'preview' ? 'bg-accent-500/15 text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Eye className="h-4 w-4" />
              {t('tabPreview')}
            </button>
          </div>
          <Button variant="outline" onClick={handleSaveDraft} disabled={pending}>
            {pending ? t('saving') : t('saveDraft')}
          </Button>
          <Button onClick={handlePublish} disabled={pending}>
            {pending ? t('publishing') : t('publish')}
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {view === 'preview' ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-ink-700 p-4 accent-border-top">
          <Card className="p-4">
            <FormRenderer schema={schema} preview />
          </Card>
        </div>
      ) : isEmpty ? (
        <TemplatePicker onPick={applyTemplate} onBlank={handleAddSection} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)_320px]">
          {/* Paleta */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-3">
              <Palette onAdd={handleAddFieldFromPalette} />
            </Card>
          </aside>

          {/* Canvas */}
          <div className="space-y-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableSectionIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {schema.sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      sectionId={section.id}
                      title={section.title ?? ''}
                      description={section.description ?? ''}
                      fieldCount={section.fields.length}
                      onTitleChange={(v) => setSchema((s) => updateSection(s, section.id, { title: v }))}
                      onDescriptionChange={(v) =>
                        setSchema((s) => updateSection(s, section.id, { description: v }))
                      }
                      onRemove={() => handleRemoveSection(section.id)}
                    >
                      <SortableContext
                        items={section.fields.map((f) => `field:${section.id}:${f.id}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1.5">
                          {section.fields.length === 0 ? (
                            <p className="rounded-md border border-dashed border-input px-2 py-3 text-center text-xs text-muted-foreground">
                              {t('emptySection')}
                            </p>
                          ) : (
                            section.fields.map((field) => (
                              <SortableField
                                key={field.id}
                                field={field}
                                sectionId={section.id}
                                selected={
                                  selected?.sectionId === section.id && selected?.fieldId === field.id
                                }
                                onSelect={() => setSelected({ sectionId: section.id, fieldId: field.id })}
                                onLabelChange={(v) =>
                                  setSchema((s) =>
                                    updateField(s, section.id, field.id, { label: v || undefined }),
                                  )
                                }
                                onRemove={() => handleRemoveField(section.id, field.id)}
                              />
                            ))
                          )}
                        </div>
                      </SortableContext>
                    </SortableSection>
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeDrag ? (
                  <div className="rounded-md border border-accent-500 bg-card px-3 py-2 text-sm shadow-lg">
                    {activeDrag.label}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <Button type="button" variant="outline" onClick={handleAddSection}>
              <Plus className="h-4 w-4" />
              {t('addSection')}
            </Button>
          </div>

          {/* Propriedades */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-4 accent-border-top">
              {selectedField && selected ? (
                <FieldEditor
                  field={selectedField}
                  sectionId={selected.sectionId}
                  schema={schema}
                  onChange={handleFieldChange}
                />
              ) : (
                <div className="py-8 text-center">
                  <PencilRuler className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('selectField')}</p>
                </div>
              )}
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
