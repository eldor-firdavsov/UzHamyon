import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';
import { createClient } from '@/lib/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Noto‘g‘ri elektron pochta manzili'),
  password: z.string().min(6, 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setErrorMsg('Elektron pochta yoki parol noto‘g‘ri kiritildi.');
        setIsLoading(false);
        return;
      }

      navigate('/dashboard');
    } catch {
      setErrorMsg('Tizimga kirishda xatolik yuz berdi. Qayta urinib ko‘ring.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-4 py-12 text-[#18181B]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <UzHamyonLogo variant="icon" size="lg" />
          </div>
          <div className="text-xl font-bold tracking-tight text-[#18181B] mb-1">
            UzHamyon
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#18181B]">
            Kirish
          </h1>
          <p className="mt-1.5 text-sm text-[#52525B] leading-relaxed">
            UzHamyon hisobingizga kiring va shaxsiy moliyangizni boshqaring
          </p>
        </div>

        {errorMsg && (
          <div
            id="login-error-banner"
            className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-[#DC2626]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-1.5"
            >
              Elektron pochta
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-4 w-4 text-[#A1A1AA]" />
              </div>
              <input
                {...register('email')}
                type="email"
                id="email"
                autoComplete="email"
                placeholder="name@example.com"
                disabled={isLoading}
                className={`block w-full rounded-xl border ${
                  errors.email
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-[#E5E7EB] focus:border-[#059669] focus:ring-[#ECFDF5]'
                } bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#18181B] placeholder-[#A1A1AA] outline-none transition-all focus:ring-4 disabled:opacity-60`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-[#DC2626] font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#71717A]"
              >
                Parol
              </label>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-4 w-4 text-[#A1A1AA]" />
              </div>
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLoading}
                className={`block w-full rounded-xl border ${
                  errors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-[#E5E7EB] focus:border-[#059669] focus:ring-[#ECFDF5]'
                } bg-white py-2.5 pl-10 pr-10 text-sm text-[#18181B] placeholder-[#A1A1AA] outline-none transition-all focus:ring-4 disabled:opacity-60`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#A1A1AA] hover:text-[#71717A] focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-[#DC2626] font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#059669] hover:bg-[#047857] py-2.5 px-4 text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Tekshirilmoqda...</span>
              </>
            ) : (
              <>
                <span>Kirish</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm text-[#71717A]">
          Hisobingiz yo‘qmi?{' '}
          <Link
            to="/register"
            className="font-semibold text-[#059669] hover:text-[#047857] hover:underline"
          >
            Ro‘yxatdan o‘tish
          </Link>
        </div>
      </div>
    </div>
  );
}
