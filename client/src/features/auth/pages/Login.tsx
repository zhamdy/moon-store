import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardBody, CardHeader, Button, Input, Checkbox } from '@heroui/react';
import { useAuthStore } from '../store/authStore';
import { useTransport } from '../../../shared/lib/transport/index';
import moonLogo from '../../../shared/assets/moon-logo.svg';
import { useTranslation, t as tStandalone } from '../../../shared/i18n/index';
import type { AuthResponseData } from '../../../shared/types/index';

const getLoginSchema = () =>
  z.object({
    email: z.string().email(tStandalone('validation.emailInvalid')),
    password: z.string().min(1, tStandalone('validation.passwordRequired')),
  });

type LoginFormData = z.infer<ReturnType<typeof getLoginSchema>>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const transport = useTransport();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(getLoginSchema()),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await transport.request<AuthResponseData['data']>({
        method: 'POST',
        path: 'auth/login',
        body: data,
      });
      const { accessToken, user } = response.data;
      login(user, accessToken);
      toast.success(t('login.welcomeBack', { name: user.name }));

      // Route based on role
      if (user.role === 'Admin') {
        navigate({ to: '/' });
      } else if (user.role === 'Cashier') {
        navigate({ to: '/pos' });
      } else {
        navigate({ to: '/deliveries' });
      }
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t('login.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Hero panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-slate-950 dark:bg-black border-e border-border overflow-hidden select-none">
        {/* Ambient celestial glow orbs */}
        <div className="absolute -top-24 -start-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -end-24 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-400/10 blur-[100px] pointer-events-none" />

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />

        {/* Decorative concentric lunar orbit rings */}
        <div className="absolute w-[500px] h-[500px] rounded-full border border-white/[0.04] pointer-events-none" />
        <div className="absolute w-[700px] h-[700px] rounded-full border border-white/[0.03] pointer-events-none" />

        {/* Glassmorphism content container */}
        <div className="relative z-10 flex flex-col items-center text-center px-10 py-12 max-w-lg mx-auto animate-fade-in">
          {/* Logo glow halo */}
          <div className="relative flex items-center justify-center p-6 rounded-3xl bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-md">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-amber-500/10 to-transparent blur-sm" />
            <img src={moonLogo} alt="MOON" className="h-20 relative z-10 drop-shadow-md" />
          </div>

          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent my-6" />

          <h2 className="font-display text-3xl font-bold text-white tracking-tight">
            {t('login.heroTagline')}
          </h2>
          <p className="mt-3 text-slate-400 text-xs tracking-widest uppercase font-semibold">
            {t('login.heroSubtext')}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8">
        {/* Mobile branding — visible below lg */}
        <div className="lg:hidden flex flex-col items-center mb-6">
          <img src={moonLogo} alt="MOON" className="h-14" />
          <div className="w-12 h-px bg-border mt-4" />
        </div>

        <Card className="w-full max-w-md border border-border bg-card shadow-lg">
          <CardHeader className="text-center flex flex-col gap-1.5 p-6 pb-2">
            <h1 className="text-2xl font-bold text-foreground">{t('login.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
          </CardHeader>
          <CardBody className="p-6 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                type="email"
                label={t('login.email')}
                placeholder={t('login.emailPlaceholder')}
                size="md"
                variant="bordered"
                {...register('email')}
                isInvalid={!!errors.email}
                errorMessage={errors.email?.message}
              />

              <Input
                type={showPassword ? 'text' : 'password'}
                label={t('login.password')}
                placeholder={t('login.passwordPlaceholder')}
                size="md"
                variant="bordered"
                {...register('password')}
                isInvalid={!!errors.password}
                errorMessage={errors.password?.message}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <div className="flex items-center">
                <Checkbox size="sm" classNames={{ label: 'text-sm text-muted-foreground' }}>
                  {t('login.rememberMe')}
                </Checkbox>
              </div>

              <Button
                type="submit"
                color="primary"
                size="lg"
                className="w-full font-medium"
                isLoading={isLoading}
              >
                {isLoading ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
