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
import { GripVertical, Trash2 } from 'lucide-react';
import {
  FIELD_TYPES,
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
import { FormRenderer } from '@/components/forms/form-renderer';
import { saveDraft, publishForm, type FormDetail } from '../../actions';
import { FieldEditor } from './field-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = Readonly<{
  initial: FormDetail;
}>;

type DragItem =
  | { kind: 'section'; id: string }
  | { kind: 'field'; id: string; sectionId: string };

type SortableSectionProps = Readonly<{
  sectionId: string;
  title: string;
  children: React.ReactNode;
  onRemove: () => void;
}>;

function SortableSection({
  sectionId,
  title,
  children,
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
    <div ref={setNodeRef} style={style} className="rounded-md border border-input bg-card">
      <div className="flex items-center gap-2 border-b border-input px-3 py-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex-1 text-sm font-medium truncate">{title || sectionId}</span>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t('removeSection')}>
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

type SortableFieldProps = Readonly<{
  field: FormField;
  sectionId: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}>;

function SortableField({
  field,
  sectionId,
  selected,
  onSelect,
  onRemove,
}: SortableFieldProps) {
  const t = useTranslations('forms');
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
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
        selected ? 'border-primary bg-accent/20' : 'border-input'
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="flex-1 text-left truncate" onClick={onSelect}>
        <span className="font-medium">{field.label ?? field.id}</span>
        <span className="ml-2 text-xs text-muted-foreground">{field.type}</span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label={t('removeField')}>
        <Trash2 className="h-3.5 w-3.5 text-danger" />
      </Button>
    </div>
  );
}

function DragOverlayContent({ activeDrag }: Readonly<{ activeDrag: DragItem | null }>) {
  if (!activeDrag) return null;
  if (activeDrag.kind === 'section') {
    return (
      <div className="rounded-md border border-primary bg-card px-3 py-2 text-sm shadow-lg">
        Section
      </div>
    );
  }
  return (
    <div className="rounded-md border border-primary bg-card px-3 py-2 text-sm shadow-lg">
      {activeDrag.id}
    </div>
  );
}

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
  const [fieldPickerKeys, setFieldPickerKeys] = useState<Record<string, number>>({});
  const [activeDrag, setActiveDrag] = useState<DragItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(schema) !== JSON.stringify(savedSchema),
    [schema, savedSchema],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const sortableSectionIds = schema.sections.map((s) => `section:${s.id}`);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith('section:')) {
      setActiveDrag({ kind: 'section', id: id.slice(8) });
    } else if (id.startsWith('field:')) {
      const [, sectionId, fieldId] = id.split(':');
      setActiveDrag({ kind: 'field', id: fieldId, sectionId });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId.startsWith('section:') && overId.startsWith('section:')) {
        const fromId = activeId.slice(8);
        const toId = overId.slice(8);
        setSchema((s) => reorderSections(s, fromId, toId));
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
            const insertAt = target?.fields.length ?? 0;
            return moveField(s, fieldId, fromSectionId, toSectionId, insertAt);
          });
        }
      }
    },
    [],
  );

  function handleAddSection() {
    setSchema((s) => addSection(s, { title: `Section ${s.sections.length + 1}` }));
  }

  function handleAddField(sectionId: string, type: FieldType) {
    let newFieldId: string | undefined;
    setSchema((s) => {
      const updated = addField(s, sectionId, { type, label: type });
      newFieldId = updated.sections.find((sec) => sec.id === sectionId)?.fields.at(-1)?.id;
      return updated;
    });
    if (newFieldId) setSelected({ sectionId, fieldId: newFieldId });
    setFieldPickerKeys((keys) => ({ ...keys, [sectionId]: (keys[sectionId] ?? 0) + 1 }));
  }

  const handleRemoveSection = useCallback((sectionId: string) => {
    setSchema((s) => removeSection(s, sectionId));
    setSelected((sel) => (sel?.sectionId === sectionId ? null : sel));
  }, []);

  const handleRemoveField = useCallback((sectionId: string, fieldId: string) => {
    setSchema((s) => removeField(s, sectionId, fieldId));
    setSelected((sel) => (sel?.fieldId === fieldId ? null : sel));
  }, []);

  const handleSelectField = useCallback((sectionId: string, fieldId: string) => {
    setSelected({ sectionId, fieldId });
  }, []);

  const handleSectionTitleChange = useCallback((sectionId: string, title: string) => {
    setSchema((s) => updateSection(s, sectionId, { title }));
  }, []);

  const handleSectionDescriptionChange = useCallback((sectionId: string, description: string) => {
    setSchema((s) => updateSection(s, sectionId, { description }));
  }, []);

  const handleFieldChange = useCallback(
    (sectionId: string, fieldId: string, patch: Partial<FormField>) => {
      setSchema((s) => updateField(s, sectionId, fieldId, patch));
    },
    [],
  );

  function handleSaveDraft() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveDraft(formMeta.id, schema, {
        name: formMeta.name,
        description: formMeta.description,
        success_message: formMeta.success_message,
        requires_waiver: formMeta.requires_waiver,
      });
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
        const saveRes = await saveDraft(formMeta.id, schema, {
          name: formMeta.name,
          description: formMeta.description,
          success_message: formMeta.success_message,
          requires_waiver: formMeta.requires_waiver,
        });
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

  return (
    <div className="space-y-4">
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
        <div className="flex gap-2">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-ink-700 p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableSectionIds} strategy={verticalListSortingStrategy}>
              {schema.sections.map((section) => (
                <SortableSection
                  key={section.id}
                  sectionId={section.id}
                  title={section.title ?? section.id}
                  onRemove={() => handleRemoveSection(section.id)}
                >
                  <div className="mb-3 space-y-2">
                    <Input
                      placeholder={t('sectionTitle')}
                      value={section.title ?? ''}
                      onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                    />
                    <Input
                      placeholder={t('sectionDescription')}
                      value={section.description ?? ''}
                      onChange={(e) => handleSectionDescriptionChange(section.id, e.target.value)}
                    />
                  </div>

                  <SortableContext
                    items={section.fields.map((f) => `field:${section.id}:${f.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {section.fields.map((field) => (
                        <SortableField
                          key={field.id}
                          field={field}
                          sectionId={section.id}
                          selected={
                            selected?.sectionId === section.id && selected?.fieldId === field.id
                          }
                          onSelect={() => handleSelectField(section.id, field.id)}
                          onRemove={() => handleRemoveField(section.id, field.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <div className="mt-3 flex items-center gap-2">
                    <Select
                      key={fieldPickerKeys[section.id] ?? 0}
                      onValueChange={(v) => handleAddField(section.id, v as FieldType)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t('addField')} />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft} value={ft}>
                            {ft}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </SortableSection>
              ))}
            </SortableContext>

            <DragOverlay>
              <DragOverlayContent activeDrag={activeDrag} />
            </DragOverlay>
          </DndContext>

          <Button type="button" variant="outline" onClick={handleAddSection}>
            {t('addSection')}
          </Button>

          {selectedField && selected ? (
            <FieldEditor
              field={selectedField}
              sectionId={selected.sectionId}
              schema={schema}
              onChange={handleFieldChange}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('selectField')}</p>
          )}
        </div>

        <div className="rounded-lg border border-ink-700 p-4 accent-border-top">
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide">{t('preview')}</h2>
          <Card className="p-4">
            <FormRenderer schema={schema} preview />
          </Card>
        </div>
      </div>
    </div>
  );
}
