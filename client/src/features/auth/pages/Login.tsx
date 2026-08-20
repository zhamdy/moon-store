import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Checkbox } from '../../../shared/ui/checkbox';
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
  // The same axios instance the refresh interceptor is installed on, reached
  // through the seam so this page holds no HTTP knowledge of its own.
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
      // The transport unwraps the `{ data: ... }` envelope, so what comes back
      // here is what `response.data.data` used to be.
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
      // ApiError carries the server's own wording, and nothing when the failure
      // was the transport's own — so the page keeps its own fallback.
      toast.error((err instanceof Error && err.message) || t('login.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Hero panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-gradient-to-br from-gold-dark via-gold to-gold-light overflow-hidden">
        {/* Radial overlays for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.15)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_rgba(0,0,0,0.1)_0%,_transparent_50%)]" />

        <div className="relative z-10 flex flex-col items-center text-center px-12 animate-fade-in">
          <img src={moonLogo} alt="MOON" className="h-24 brightness-0 invert" />
          <div className="gold-divider mt-6 mb-6 !bg-white/40" />
          <h2 className="font-display text-3xl text-white tracking-wide">
            {t('login.heroTagline')}
          </h2>
          <p className="mt-3 text-white/70 text-sm tracking-widest uppercase font-data">
            {t('login.heroSubtext')}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8">
        {/* Mobile branding — visible below lg */}
        <div className="lg:hidden flex flex-col items-center mb-6">
          <img src={moonLogo} alt="MOON" className="h-16" />
          <div className="gold-divider mt-4" />
        </div>

        <Card className="w-full max-w-md animate-scale-in">
          <CardHeader className="text-center space-y-4">
            <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="stagger-children space-y-4">
              <div className="space-y-2 animate-slide-up">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2 animate-slide-up">
                <Label htmlFor="password">{t('login.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.passwordPlaceholder')}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2 animate-slide-up">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm text-muted cursor-pointer">
                  {t('login.rememberMe')}
                </Label>
              </div>

              <Button type="submit" className="w-full animate-slide-up" disabled={isLoading}>
                {isLoading ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
