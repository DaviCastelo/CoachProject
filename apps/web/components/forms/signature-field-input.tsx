'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isDrawnSignatureValue } from '@ca-tempo/domain';
import { Input } from '@/components/ui/input';
import { SignaturePad } from '@/components/forms/signature-pad';

type SignatureMode = 'drawn' | 'typed';

function initialMode(value: unknown): SignatureMode {
  if (typeof value === 'string' && value && !isDrawnSignatureValue(value)) return 'typed';
  return 'drawn';
}

type Props = Readonly<{
  fieldId: string;
  value: unknown;
  onChange: (next: string) => void;
}>;

/** Campo de assinatura do schema: desenhar (PNG data URL) ou digitar nome. */
export function SignatureFieldInput({ fieldId, value, onChange }: Props) {
  const t = useTranslations('register');
  const strValue = typeof value === 'string' ? value : '';
  const [mode, setMode] = useState<SignatureMode>(() => initialMode(value));

  function switchMode(next: SignatureMode) {
    setMode(next);
    onChange('');
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${fieldId}-sig-mode`}
            checked={mode === 'drawn'}
            onChange={() => switchMode('drawn')}
          />
          {t('drawSignature')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`${fieldId}-sig-mode`}
            checked={mode === 'typed'}
            onChange={() => switchMode('typed')}
          />
          {t('typeName')}
        </label>
      </div>

      {mode === 'drawn' ? (
        <SignaturePad onChange={(dataUrl) => onChange(dataUrl ?? '')} />
      ) : (
        <Input
          id={fieldId}
          placeholder={t('typeNamePlaceholder')}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
