import { useMemo, useState } from 'react';
import { Eye, FileText, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { dataService, errorMessage } from '@/services';
import type { Category, MessageTemplate, Occasion, TemplateInput } from '@/types';
import { CATEGORIES } from '@/types';
import { useTemplates } from '@/hooks/useData';
import { invalidateQueries } from '@/hooks/useQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { MessagePreview } from '@/components/templates/MessagePreview';
import { TemplateFormModal } from '@/components/templates/TemplateFormModal';
import { Badge, CategoryBadge, OccasionBadge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Chip, Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { CATEGORY_META } from '@/utils/constants';
import { cn } from '@/utils/cn';

type EditorState = { open: false } | { open: true; template?: MessageTemplate };

export function TemplatesPage() {
  const toast = useToast();
  const { data: templates, error, isLoading, isFetching, refetch } = useTemplates();
  const [occasion, setOccasion] = useState<Occasion>('BIRTHDAY');
  const [category, setCategory] = useState<Category | 'ALL'>('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [preview, setPreview] = useState<MessageTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => t.occasion === occasion && (category === 'ALL' || t.category === category) && (showInactive || t.isActive),
      ),
    [templates, occasion, category, showInactive],
  );

  const counts = useMemo(() => {
    const active = (templates ?? []).filter((t) => t.isActive);
    return {
      BIRTHDAY: active.filter((t) => t.occasion === 'BIRTHDAY').length,
      ANNIVERSARY: active.filter((t) => t.occasion === 'ANNIVERSARY').length,
    };
  }, [templates]);

  const handleSave = async (input: TemplateInput): Promise<boolean> => {
    try {
      if (editor.open && editor.template) {
        await dataService.updateTemplate(editor.template.templateId, input);
        toast.success('Template saved');
      } else {
        await dataService.createTemplate(input);
        toast.success('Template created');
      }
      invalidateQueries('templates:');
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  const toggleActive = async (template: MessageTemplate) => {
    setBusyId(template.templateId);
    try {
      await dataService.setTemplateActive(template.templateId, !template.isActive);
      invalidateQueries('templates:');
      toast.success(template.isActive ? 'Template deactivated' : 'Template activated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const groups = CATEGORIES.filter((c) => category === 'ALL' || c === category)
    .map((c) => ({ category: c, items: visible.filter((t) => t.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="WhatsApp messages for each category and occasion"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ open: true })} disabled={!templates}>
            <span className="hidden sm:inline">New template</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      <div className="space-y-3">
        <Segmented
          label="Occasion"
          className="w-full sm:w-auto"
          value={occasion}
          onChange={setOccasion}
          options={[
            { value: 'BIRTHDAY', label: 'Birthday', count: templates ? counts.BIRTHDAY : undefined },
            { value: 'ANNIVERSARY', label: 'Anniversary', count: templates ? counts.ANNIVERSARY : undefined },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
            <Chip active={category === 'ALL'} onClick={() => setCategory('ALL')}>
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)} dotClassName={CATEGORY_META[c].dot}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
          <div className="sm:w-48">
            <Toggle label="Show inactive" checked={showInactive} onChange={setShowInactive} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : error || !templates ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No templates here"
            description={showInactive ? 'Create a template for this occasion.' : 'No active templates match. Try showing inactive ones.'}
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ open: true })}>
                New template
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.category}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink">{CATEGORY_META[group.category].label}</h2>
                  <span className="text-sm text-ink-subtle">{group.items.length}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((t) => (
                    <Card key={t.templateId} className={cn('flex flex-col p-4', !t.isActive && 'opacity-60')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{t.name}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <CategoryBadge category={t.category} />
                            <OccasionBadge occasion={t.occasion} />
                            {t.isDefault && <Badge tone="brand">Default</Badge>}
                            {!t.isActive && <Badge>Inactive</Badge>}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{t.body}</p>
                      <div className="mt-4 flex items-center gap-1 border-t border-gray-100 pt-3">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(t)}>
                          Preview
                        </Button>
                        <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditor({ open: true, template: t })}>
                          Edit
                        </Button>
                        <IconButton
                          label={t.isActive ? 'Deactivate template' : 'Activate template'}
                          className="ml-auto"
                          disabled={busyId === t.templateId}
                          onClick={() => toggleActive(t)}
                        >
                          {t.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-emerald-600" />}
                        </IconButton>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <TemplateFormModal
        open={editor.open}
        template={editor.open ? editor.template : undefined}
        defaults={{ category: category === 'ALL' ? 'GENERAL' : category, occasion }}
        onClose={() => setEditor({ open: false })}
        onSubmit={handleSave}
      />

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? 'Preview'} description="How this message will read" size="md">
        {preview && <MessagePreview body={preview.body} occasion={preview.occasion} />}
      </Modal>
    </div>
  );
}
