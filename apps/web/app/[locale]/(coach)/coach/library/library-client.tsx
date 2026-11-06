'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Film,
  Folder,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  Link2,
  Pencil,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { LIBRARY_ACCEPT, formatBytes, resolveLibraryType } from '@ca-tempo/domain';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AthleticCard } from '@/components/athletic-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResponsiveFormOverlay } from '@/components/ui/responsive-form-overlay';
import { prepareFile } from '@/lib/library/prepare';
import { uploadThumb, uploadToLibrary } from '@/lib/library/upload';
import { cn } from '@/lib/utils';
import {
  abortUpload,
  addLink,
  createFolder,
  deleteFile,
  deleteFolder,
  finishUpload,
  getFileUrl,
  moveFile,
  moveFolder,
  renameFile,
  renameFolder,
  startUpload,
  type LibraryErrorCode,
  type LibraryFile,
  type LibraryFolder,
  type LibraryView,
} from './actions';

type Target = { type: 'folder'; item: LibraryFolder } | { type: 'file'; item: LibraryFile };

type Overlay =
  | { mode: 'newFolder' }
  | { mode: 'addLink' }
  | { mode: 'rename'; target: Target }
  | { mode: 'move'; target: Target }
  | { mode: 'delete'; target: Target }
  | null;

type QueueItem = {
  id: string;
  name: string;
  progress: number;
  state: 'preparing' | 'uploading' | 'failed';
  error?: string;
  cancel?: () => void;
};

const ROOT = '';

function folderHref(id: string | null) {
  return id ? { pathname: '/coach/library', query: { folder: id } } : '/coach/library';
}

/** Rótulos "Jogos / U10" para escolher destino, tirando a pasta e suas filhas. */
function destinationOptions(folders: LibraryFolder[], excluded: string | null) {
  const byId = new Map(folders.map((f) => [f.id, f]));

  const isInside = (folder: LibraryFolder): boolean => {
    let current: LibraryFolder | undefined = folder;
    while (current) {
      if (current.id === excluded) return true;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };

  const label = (folder: LibraryFolder): string => {
    const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    return parent ? `${label(parent)} / ${folder.name}` : folder.name;
  };

  return folders
    .filter((f) => !isInside(f))
    .map((f) => ({ id: f.id, label: label(f) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function LibraryClient({ view }: Readonly<{ view: LibraryView }>) {
  const t = useTranslations('library');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [preview, setPreview] = useState<{ file: LibraryFile; url: string } | null>(null);

  const [nameValue, setNameValue] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [destination, setDestination] = useState(ROOT);

  const usedPercent =
    view.quotaBytes > 0 ? Math.min(100, (view.usedBytes / view.quotaBytes) * 100) : 0;

  const destinations = useMemo(() => {
    if (overlay?.mode !== 'move') return [];
    const excluded = overlay.target.type === 'folder' ? overlay.target.item.id : null;
    return destinationOptions(view.allFolders, excluded);
  }, [overlay, view.allFolders]);

  function errorText(code: LibraryErrorCode): string {
    return t(`error_${code}`);
  }

  function open(next: NonNullable<Overlay>) {
    setNameValue(next.mode === 'rename' ? next.target.item.name : '');
    setUrlValue('');
    if (next.mode === 'move') {
      const current =
        next.target.type === 'folder' ? next.target.item.parentId : view.folderId;
      setDestination(current ?? ROOT);
    }
    setOverlay(next);
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: LibraryErrorCode }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setOverlay(null);
        router.refresh();
      } else {
        toast.error(errorText(result.error));
      }
    });
  }

  function submitOverlay() {
    if (!overlay) return;
    const target = overlay.mode === 'newFolder' || overlay.mode === 'addLink' ? null : overlay.target;
    const parent = destination === ROOT ? null : destination;

    if (overlay.mode === 'newFolder') run(() => createFolder(view.folderId, nameValue));
    else if (overlay.mode === 'addLink') run(() => addLink(view.folderId, nameValue, urlValue));
    else if (overlay.mode === 'rename' && target?.type === 'folder')
      run(() => renameFolder(target.item.id, nameValue));
    else if (overlay.mode === 'rename' && target?.type === 'file')
      run(() => renameFile(target.item.id, nameValue));
    else if (overlay.mode === 'move' && target?.type === 'folder')
      run(() => moveFolder(target.item.id, parent));
    else if (overlay.mode === 'move' && target?.type === 'file')
      run(() => moveFile(target.item.id, parent));
    else if (overlay.mode === 'delete' && target?.type === 'folder')
      run(() => deleteFolder(target.item.id));
    else if (overlay.mode === 'delete' && target?.type === 'file')
      run(() => deleteFile(target.item.id));
  }

  function patchQueue(id: string, patch: Partial<QueueItem>) {
    setQueue((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function uploadOne(file: File) {
    const id = crypto.randomUUID();
    const fail = (error: string) => patchQueue(id, { state: 'failed', error });

    setQueue((items) => [...items, { id, name: file.name, progress: 0, state: 'preparing' }]);

    const resolved = resolveLibraryType(file);
    if (!resolved) return fail(errorText('invalid_type'));

    const prepared = await prepareFile(file, resolved.kind, resolved.mime);

    // Recusa aqui, antes de gastar a internet de quem está no campo.
    if (prepared.blob.size > view.maxFileBytes) {
      return fail(
        resolved.kind === 'video'
          ? t('error_video_too_large', { size: formatBytes(view.maxFileBytes, locale) })
          : errorText('file_too_large'),
      );
    }

    const started = await startUpload({
      folderId: view.folderId,
      name: prepared.name,
      type: prepared.type,
      size: prepared.blob.size,
      width: prepared.width,
      height: prepared.height,
      duration: prepared.duration,
      hasThumb: prepared.thumb !== null,
    });
    if (!started.ok) return fail(errorText(started.error));

    const ticket = started.data;
    const transfer = uploadToLibrary({
      blob: prepared.blob,
      path: ticket.storageKey,
      token: ticket.token,
      type: ticket.mime,
      onProgress: (progress) => patchQueue(id, { progress }),
    });

    let cancelled = false;
    patchQueue(id, {
      state: 'uploading',
      cancel: () => {
        cancelled = true;
        transfer.cancel();
        void abortUpload(ticket.fileId);
        setQueue((items) => items.filter((i) => i.id !== id));
      },
    });

    try {
      await transfer.promise;
      if (prepared.thumb && ticket.thumb) {
        await uploadThumb(ticket.thumb.path, ticket.thumb.token, prepared.thumb).catch(() => null);
      }
    } catch {
      if (cancelled) return;
      await abortUpload(ticket.fileId);
      return fail(errorText('upload_failed'));
    }

    const finished = await finishUpload(ticket.fileId);
    if (!finished.ok) return fail(errorText(finished.error));

    setQueue((items) => items.filter((i) => i.id !== id));
    router.refresh();
  }

  async function addFiles(files: FileList | File[]) {
    // Um por vez: dois vídeos juntos dividem a mesma internet e os dois sofrem.
    for (const file of Array.from(files)) {
      await uploadOne(file);
    }
  }

  async function openFile(file: LibraryFile) {
    if (file.externalUrl) {
      window.open(file.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // A aba abre agora, dentro do clique; depois do await o navegador bloquearia.
    const tab = file.kind === 'image' || file.kind === 'video' ? null : window.open('', '_blank');

    const result = await getFileUrl(file.id, 'view');
    if (!result.ok) {
      tab?.close();
      toast.error(errorText(result.error));
      return;
    }

    if (tab) tab.location.href = result.data.url;
    else setPreview({ file, url: result.data.url });
  }

  async function download(file: LibraryFile) {
    const result = await getFileUrl(file.id, 'download');
    if (result.ok) window.location.assign(result.data.url);
    else toast.error(errorText(result.error));
  }

  const isEmpty = view.folders.length === 0 && view.files.length === 0;

  return (
    <div
      className={cn('rounded-card', dragging && 'ring-2 ring-accent-500 ring-offset-4 ring-offset-background')}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      <AthleticCard className="mb-4 p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">{t('storageTitle')}</span>
          <span className="tabular-nums text-muted-foreground">
            {t('storageUsed', {
              used: formatBytes(view.usedBytes, locale),
              total: formatBytes(view.quotaBytes, locale),
            })}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(usedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('storageTitle')}
        >
          <div
            className={cn('h-full rounded-full', usedPercent >= 90 ? 'bg-danger' : 'bg-accent-500')}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('storageHint', { size: formatBytes(view.maxFileBytes, locale) })}
        </p>
      </AthleticCard>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => inputRef.current?.click()}>
          <UploadIcon className="h-4 w-4" />
          {t('upload')}
        </Button>
        <Button variant="outline" onClick={() => open({ mode: 'newFolder' })}>
          <FolderPlus className="h-4 w-4" />
          {t('newFolder')}
        </Button>
        <Button variant="outline" onClick={() => open({ mode: 'addLink' })}>
          <Link2 className="h-4 w-4" />
          {t('addLink')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={LIBRARY_ACCEPT}
          className="sr-only"
          aria-label={t('upload')}
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <nav aria-label={t('breadcrumb')} className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        <Link href="/coach/library" className="text-muted-foreground hover:text-foreground">
          {t('root')}
        </Link>
        {view.path.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Link href={folderHref(crumb.id)} className="text-muted-foreground hover:text-foreground">
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      {queue.length > 0 ? (
        <ul className="mb-4 space-y-2" aria-label={t('queueTitle')}>
          {queue.map((item) => (
            <li key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{item.name}</span>
                {item.state === 'failed' ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('dismiss')}
                    onClick={() => setQueue((items) => items.filter((i) => i.id !== item.id))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : item.cancel ? (
                  <Button variant="ghost" size="icon" aria-label={t('cancel')} onClick={item.cancel}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {item.state === 'failed' ? (
                <p className="mt-1 text-danger">{item.error}</p>
              ) : (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-accent-500 transition-[width]"
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {isEmpty && queue.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-10 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
        </div>
      ) : null}

      {view.folders.length > 0 ? (
        <ul className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {view.folders.map((folder) => {
            const target: Target = { type: 'folder', item: folder };
            return (
              <li
                key={folder.id}
                className="flex items-center gap-1 rounded-md border border-border bg-card pr-1"
              >
                <Link
                  href={folderHref(folder.id)}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3"
                >
                  <Folder className="h-5 w-5 shrink-0 text-accent-500" aria-hidden="true" />
                  <span className="truncate text-sm font-medium">{folder.name}</span>
                </Link>
                <ItemAction
                  label={t('rename')}
                  icon={Pencil}
                  onClick={() => open({ mode: 'rename', target })}
                />
                <ItemAction
                  label={t('move')}
                  icon={FolderInput}
                  onClick={() => open({ mode: 'move', target })}
                />
                {view.canManage ? (
                  <ItemAction
                    label={t('delete')}
                    icon={Trash2}
                    onClick={() => open({ mode: 'delete', target })}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {view.files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {view.files.map((file) => {
            const target: Target = { type: 'file', item: file };
            return (
              <li key={file.id} className="overflow-hidden rounded-md border border-border bg-card">
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => void openFile(file)}
                >
                  <span className="relative block aspect-video bg-muted">
                    {file.thumbUrl ? (
                      // Miniatura assinada de poucos KB: passar pelo otimizador
                      // do Next só gastaria a cota dele.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.thumbUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-muted-foreground">
                        <KindIcon kind={file.kind} className="h-8 w-8" />
                      </span>
                    )}
                  </span>
                  <span className="block p-2">
                    <span className="block truncate text-sm font-medium">{file.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {file.kind === 'link' ? t('kind_link') : formatBytes(file.sizeBytes, locale)}
                    </span>
                  </span>
                </button>
                <div className="flex justify-end border-t border-border">
                  {file.kind === 'link' ? null : (
                    <ItemAction
                      label={t('download')}
                      icon={Download}
                      onClick={() => void download(file)}
                    />
                  )}
                  <ItemAction
                    label={t('rename')}
                    icon={Pencil}
                    onClick={() => open({ mode: 'rename', target })}
                  />
                  <ItemAction
                    label={t('move')}
                    icon={FolderInput}
                    onClick={() => open({ mode: 'move', target })}
                  />
                  {file.canDelete ? (
                    <ItemAction
                      label={t('delete')}
                      icon={Trash2}
                      onClick={() => open({ mode: 'delete', target })}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {view.truncated ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('truncated')}</p>
      ) : null}

      <ResponsiveFormOverlay
        open={overlay !== null}
        onOpenChange={(value) => !value && !pending && setOverlay(null)}
        title={overlay ? t(`overlay_${overlay.mode}`) : ''}
        description={
          overlay?.mode === 'delete'
            ? overlay.target.type === 'folder'
              ? t('deleteFolderBody', { name: overlay.target.item.name })
              : t('deleteFileBody', { name: overlay.target.item.name })
            : overlay?.mode === 'addLink'
              ? t('addLinkBody')
              : undefined
        }
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOverlay(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant={overlay?.mode === 'delete' ? 'destructive' : 'default'}
              disabled={pending}
              onClick={submitOverlay}
            >
              {overlay?.mode === 'delete' ? t('delete') : t('save')}
            </Button>
          </>
        }
      >
        {overlay?.mode === 'newFolder' ||
        overlay?.mode === 'addLink' ||
        overlay?.mode === 'rename' ? (
          <div className="space-y-1.5">
            <Label htmlFor="library-name">{t('nameLabel')}</Label>
            <Input
              id="library-name"
              value={nameValue}
              maxLength={200}
              onChange={(e) => setNameValue(e.target.value)}
            />
          </div>
        ) : null}

        {overlay?.mode === 'addLink' ? (
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="library-url">{t('urlLabel')}</Label>
            <Input
              id="library-url"
              type="url"
              inputMode="url"
              placeholder="https://youtu.be/..."
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
            />
          </div>
        ) : null}

        {overlay?.mode === 'move' ? (
          <div className="space-y-1.5">
            <Label htmlFor="library-destination">{t('destinationLabel')}</Label>
            <select
              id="library-destination"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value={ROOT}>{t('root')}</option>
              {destinations.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </ResponsiveFormOverlay>

      <Dialog open={preview !== null} onOpenChange={(value) => !value && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.file.name}</DialogTitle>
          </DialogHeader>
          {preview?.file.kind === 'video' ? (
            <>
              {/* `metadata`: só o que precisa para começar. O vídeo inteiro só
                  desce se alguém der play. */}
              <video
                src={preview.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[70vh] w-full rounded-md bg-black"
              />
              <p className="text-xs text-muted-foreground">{t('videoHint')}</p>
            </>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.file.name}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KindIcon({ kind, className }: Readonly<{ kind: LibraryFile['kind']; className?: string }>) {
  if (kind === 'image') return <ImageIcon className={className} aria-hidden="true" />;
  if (kind === 'video') return <Film className={className} aria-hidden="true" />;
  if (kind === 'link') return <ExternalLink className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
}

function ItemAction({
  label,
  icon: Icon,
  onClick,
}: Readonly<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}>) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
