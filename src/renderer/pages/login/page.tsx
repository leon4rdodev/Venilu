import React, { useState, useEffect, useRef } from "react";
import { User } from "@shared/types/models";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import {
  LogIn,
  Eye,
  EyeOff,
  ShoppingCart,
  BarChart3,
  Users,
  Package,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ipc } from "@lib/ipc";
import { motion, AnimatePresence } from "framer-motion";

const features = [
  { icon: ShoppingCart, label: "Punto de venta ágil" },
  { icon: BarChart3, label: "Reportes en tiempo real" },
  { icon: Package, label: "Control de inventario" },
  { icon: Users, label: "Gestión de clientes" },
];

export default function LoginPage({ onLogin }: { onLogin: (data: User) => Promise<void> }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus username on mount for better DX, but safely via useEffect
    if (usernameRef.current) {
      usernameRef.current.focus();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = (await ipc.invoke("login-request", {
        username,
        password,
      })) as { success: boolean; message?: string; data?: User };
      if (result.success && result.data) {
        await onLogin(result.data);
        navigate("/dashboard");
      } else {
        setError(result.message || "Credenciales inválidas.");
      }
    } catch {
      setError("Ocurrió un error durante el inicio de sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* ── Left branded panel ── */}
      <motion.div
        className="hidden lg:flex lg:w-[42%] relative flex-col justify-between overflow-hidden"
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          background:
            "linear-gradient(145deg, oklch(0.10 0.04 260), oklch(0.16 0.07 265), oklch(0.12 0.05 255))",
        }}
      >
        {/* Decorative grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.9 0.1 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0.1 260) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow orbs */}
        <div
          className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "oklch(0.6 0.22 260)" }}
        />
        <div
          className="absolute bottom-1/4 right-0 w-56 h-56 rounded-full opacity-10 blur-3xl"
          style={{ background: "oklch(0.5 0.18 200)" }}
        />

        {/* Top: logo */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "oklch(0.6 0.22 260)" }}
            >
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ color: "oklch(0.97 0.01 240)" }}
            >
              Venilu
            </span>
          </div>
        </div>

        {/* Center: headline + features */}
        <div className="relative z-10 px-10 space-y-8">
          <div className="space-y-3">
            <h1
              className="text-4xl font-bold leading-tight"
              style={{ color: "oklch(0.97 0.01 240)" }}
            >
              Tu negocio,
              <br />
              bajo control.
            </h1>
            <p style={{ color: "oklch(0.65 0.04 250)" }} className="text-base leading-relaxed">
              Sistema POS diseñado para comercios que buscan eficiencia, claridad y velocidad.
            </p>
          </div>

          <div className="space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.6 0.22 260 / 0.15)", border: "1px solid oklch(0.6 0.22 260 / 0.25)" }}
                >
                  <f.icon className="w-4 h-4" style={{ color: "oklch(0.72 0.16 260)" }} />
                </div>
                <span className="text-sm" style={{ color: "oklch(0.75 0.03 250)" }}>
                  {f.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom: version */}
        <div className="relative z-10 p-10">
          <p className="text-xs" style={{ color: "oklch(0.4 0.03 260)" }}>
            Venilu v1.0 · © 2025
          </p>
        </div>
      </motion.div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-sm space-y-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        >
          {/* Mobile-only logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Venilu</span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Bienvenido de nuevo</h2>
            <p className="text-sm text-muted-foreground">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Usuario
              </Label>
              <Input
                id="username"
                ref={usernameRef}
                placeholder="Tu nombre de usuario"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
