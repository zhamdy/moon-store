import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { useAuthStore } from '../store/authStore';
import type { User } from '../store/authStore';
import api from '../services/api';
import moonLogo from '../assets/moon-logo.svg';
import { useTranslation } from '../i18n';
import type { AxiosError } from 'axios';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginResponseData {
  data: {
    accessToken: string;
    user: User;
  };
}

interface ApiErrorResponse {
  error: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await api.post<LoginResponseData>('/api/auth/login', data);
      const { accessToken, user } = response.data.data;
      login(user, accessToken);
      toast.success(t('login.welcomeBack', { name: user.name }));

      // Route based on role
      if (user.role === 'Admin') {
        navigate('/');
      } else if (user.role === 'Cashier') {
        navigate('/pos');
      } else {
        navigate('/deliveries');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      toast.error(axiosError.response?.data?.error || t('login.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(201,169,110,0.03)_0%,_transparent_70%)]" />

      <Card className="w-full max-w-md relative animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={moonLogo} alt="MOON" className="h-14" />
          </div>
          <div className="gold-divider" />
          <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
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

            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-sm text-muted cursor-pointer">
                {t('login.rememberMe')}
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
