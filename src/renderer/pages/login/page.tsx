import React, { useState, useEffect, useRef, useMemo } from "react";
import { User, Setting } from "@shared/types/models";
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
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ipc } from "@lib/ipc";

const features = [
  { icon: ShoppingCart, label: "Ventas" },
  { icon: Package, label: "Inventario" },
  { icon: Users, label: "Clientes" },
  { icon: BarChart3, label: "Reportes" },
];

interface LoginProfile {
  id: string;
  name: string;
  username: string;
  roleLabel: string;
}

const LAST_USER_KEY = "venilu_last_username";

export default function LoginPage({ onLogin }: { onLogin: (data: User) => Promise<void> }) {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<LoginProfile[] | null>(null);
  const [profilesFailed, setProfilesFailed] = useState(false);
  const [selected, setSelected] = useState<LoginProfile | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const lastUsername = useMemo(() => {
    try {
      return window.localStorage.getItem(LAST_USER_KEY);
    } catch {
      return null;
    }
  }, []);

  // User picker: minimal public profiles (shared-terminal pattern)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await ipc.invoke("login:list-users")) as {
          success: boolean;
          data?: LoginProfile[];
        };
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          // Last-used account first — it's almost always the one coming back
          const sorted = [...res.data].sort((a, b) => {
            if (a.username === lastUsername) return -1;
            if (b.username === lastUsername) return 1;
            return a.name.localeCompare(b.name, "es");
          });
          setProfiles(sorted);
          // Single-account installs skip the picker entirely
          if (sorted.length === 1) setSelected(sorted[0]);
        } else {
          setProfilesFailed(true);
        }
      } catch {
        if (!cancelled) setProfilesFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastUsername]);

  // Business logo (settings:get is public precisely for this screen)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await ipc.invoke("settings:get")) as { success: boolean; data?: Setting };
        if (cancelled || !res?.success || !res.data) return;
        if (res.data.logo_filename) {
          const logo = (await ipc.invoke("get-logo", { fileName: res.data.logo_filename })) as {
            success: boolean;
            fileData?: string;
          };
          if (!cancelled && logo?.success && logo.fileData) setLogoSrc(logo.fileData);
        }
      } catch {
        /* branding is best-effort — fall back to the Venilu mark */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus follows the step: password after picking a user, username in manual mode
  useEffect(() => {
    const id = setTimeout(() => {
      if (selected) passwordRef.current?.focus();
      else if (profilesFailed) usernameRef.current?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [selected, profilesFailed]);

  const handleSelect = (profile: LoginProfile) => {
    setSelected(profile);
    setPassword("");
    setError("");
  };

  const handleBack = () => {
    setSelected(null);
    setPassword("");
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginUsername = selected ? selected.username : username;
    setError("");
    setIsLoading(true);
    try {
      const result = (await ipc.invoke("login-request", {
        username: loginUsername,
        password,
      })) as { success: boolean; message?: string; data?: { user: User; token: string } };
      if (result.success && result.data) {
        // Persist the session token so the session survives app restarts
        window.localStorage.setItem("session_token", result.data.token);
        try {
          window.localStorage.setItem(LAST_USER_KEY, result.data.user.username);
        } catch {
          /* preference only */
        }
        await onLogin(result.data.user);
        navigate("/dashboard");
      } else {
        setError(result.message || "Credenciales inválidas.");
        setPassword("");
        passwordRef.current?.focus();
      }
    } catch {
      setError("Ocurrió un error durante el inicio de sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  const initialOf = (p: LoginProfile) => (p.name?.[0] ?? p.username?.[0] ?? "?").toUpperCase();
  const showPicker = !profilesFailed && !selected;
  const canSubmit = selected ? password.length > 0 : username.length > 0 && password.length > 0;

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden p-6"
      style={{
        background: "linear-gradient(160deg, oklch(0.07 0 0), oklch(0.13 0 0))",
      }}
    >
      {/* Decorative grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.98 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.98 0 0) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)",
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
        style={{ background: "oklch(0.6 0 0)" }}
      />
      <div
        className="absolute bottom-0 -right-32 w-80 h-80 rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: "oklch(0.45 0 0)" }}
      />

      {/* Top-left brand */}
      <div className="absolute top-0 left-0 p-8 z-10 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "oklch(1 0 0)" }}
        >
          <ShoppingCart className="w-4 h-4" strokeWidth={2} style={{ color: "oklch(0.145 0 0)" }} />
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: "oklch(0.985 0 0)" }}>
          Venilu
        </span>
      </div>

      {/* Centered card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Business identity */}
          <div className="flex flex-col items-center text-center space-y-3">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Logo del negocio"
                className="w-14 h-14 rounded-xl object-cover border border-border"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" strokeWidth={1.75} />
              </div>
            )}
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Bienvenido de nuevo</h2>
              <p className="text-sm text-muted-foreground">
                {showPicker
                  ? "Selecciona tu usuario para continuar"
                  : "Ingresa tu contraseña para continuar"}
              </p>
            </div>
          </div>

          {/* ── Step 1: user picker ── */}
          {showPicker && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-2 px-2">
              {profiles === null
                ? // Skeleton réplica of the user tiles while profiles load
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-28 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ))
                : profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60 hover:border-muted-foreground/30 group"
                    >
                      <div className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {initialOf(p)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          {p.username === lastUsername && (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Último acceso
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p.roleLabel}</p>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground transition-colors"
                        strokeWidth={1.75}
                      />
                    </button>
                  ))}
            </div>
          )}

          {/* ── Step 2: password for the selected user ── */}
          {selected && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <div className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {initialOf(selected)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selected.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.roleLabel}</p>
                </div>
                {(profiles?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={isLoading}
                    className="shrink-0 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Cambiar
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    ref={passwordRef}
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

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={isLoading || !canSubmit}
              >
                {isLoading ? (
                  "Ingresando..."
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Iniciar Sesión
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ── Fallback: manual credentials (profiles unavailable) ── */}
          {profilesFailed && !selected && (
            <form onSubmit={handleLogin} className="space-y-4">
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
                    ref={passwordRef}
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

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={isLoading || !canSubmit}
              >
                {isLoading ? (
                  "Ingresando..."
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Iniciar Sesión
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Feature strip */}
        <div className="mt-6 flex items-center justify-center gap-6">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-1.5">
              <f.icon className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: "oklch(0.6 0 0)" }} />
              <span className="text-xs" style={{ color: "oklch(0.6 0 0)" }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 p-6 text-center z-10">
        <p className="text-xs" style={{ color: "oklch(0.45 0 0)" }}>
          Venilu · Sistema POS · © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
