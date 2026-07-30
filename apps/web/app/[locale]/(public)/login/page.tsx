import { Suspense } from 'react';
import LoginPage from './login-page';

export default function Login() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">...</div>}>
      <LoginPage />
    </Suspense>
  );
}
