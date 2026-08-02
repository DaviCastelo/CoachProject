import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { getForm } from '../../actions';
import { FormBuilder } from './form-builder';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditFormPage({ params }: PageProps) {
  await requireRole(['owner', 'admin']);
  const { id } = await params;
  const detail = await getForm(id);
  if (!detail) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <FormBuilder initial={detail} />
    </div>
  );
}
