import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Button } from "@components/ui/button"
import { Smartphone, LogIn } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { ipc } from '@lib/ipc';
import { AnimatedPage } from "@renderer/features/layout";

export default function LoginPage({ onLogin }: { onLogin: (data: User) => void }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission

    setError(""); // Clear previous errors

    try {
      const result = await ipc.invoke('login-request', { username, password }) as { success: boolean, message?: string } & User;

      if (result.success) {
        onLogin(result); // Pass the full user object to onLogin
        navigate("/dashboard");
      } else {
        setError(result.message || "Credenciales inválidas.");
      }
    } catch (err) {
      console.error("Login IPC error:", err);
      setError("Ocurrió un error durante el inicio de sesión.");
    }
  };

  return (
    <AnimatedPage>
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-secondary to-muted p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold">Venilu</CardTitle>
            <CardDescription className="text-base">
              Bienvenido de nuevo. Ingresa tus credenciales para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin}> {/* Wrap with form and use onSubmit */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nombre de Usuario</Label>
                  <Input
                    id="username"
                    placeholder="Ingresa tu usuario"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-destructive text-sm mt-2">{error}</p>} {/* Display error message */}
              <Button type="submit" className="w-full h-12 text-base font-semibold mt-6"> {/* Use type="submit" */}
                <LogIn className="h-5 w-5 mr-2" />
                Iniciar Sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}
