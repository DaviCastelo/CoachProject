import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      'next-env.d.ts',
      '.next/**',
      'public/sw.js',
      'public/sw.js.map',
      'public/swe-worker-*.js',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/supabase/admin*', '**/service-role*'],
              message: 'Service role client must only be used in app/api routes.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
