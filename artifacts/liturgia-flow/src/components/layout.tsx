import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useRouter } from "wouter";
import { Calendar, Users, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";

function AdminPasswordModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError(false);
      setShaking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (login(password)) {
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPassword("");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      inputRef.current?.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className={cn(
          "relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8",
          "border border-primary/20",
          shaking && "animate-shake"
        )}
        style={
          shaking
            ? { animation: "shake 0.4s ease" }
            : {}
        }
      >
        {/* Cross icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "hsl(340 61% 30% / 0.08)" }}
          >
            <Lock className="w-7 h-7" style={{ color: "hsl(340 61% 30%)" }} />
          </div>
        </div>

        <h2
          className="text-center text-xl font-bold mb-1"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            color: "hsl(340 61% 30%)",
          }}
        >
          Acceso de Administrador
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Ingresa la contraseña para continuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Contraseña"
              className={cn(
                "w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all",
                error
                  ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300"
                  : "border-primary/30 bg-white focus:ring-2 focus:ring-primary/30"
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Contraseña incorrecta. Inténtalo de nuevo.</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "hsl(340 61% 30%)" }}
          >
            Ingresar al Panel
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Cancelar
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);

  function handleAdminClick(e: React.MouseEvent) {
    if (!isAdmin) {
      e.preventDefault();
      setShowModal(true);
    }
  }

  function handleMobileAdminClick(e: React.MouseEvent) {
    if (!isAdmin) {
      e.preventDefault();
      setShowModal(true);
    }
  }

  function handleModalSuccess() {
    setShowModal(false);
    router.navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <AdminPasswordModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleModalSuccess}
      />

      {/* Altar background image */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url('${import.meta.env.BASE_URL}images/altar-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          opacity: 0.07,
        }}
      />
      {/* Subtle cross/plus pattern overlay */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9922A' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* HEADER */}
      <header className="relative z-10 bg-white/92 backdrop-blur-md border-b border-primary/20 sticky top-0 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Parish identity — centered */}
          <div className="text-center py-2.5 border-b border-primary/10">
            <p
              className="text-primary font-bold text-base tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Pastoral de Liturgia
            </p>
            <p
              className="text-accent text-xs tracking-[0.15em] uppercase mt-0.5"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Parroquia Santo Cristo de Esquipulas
            </p>
          </div>
          {/* Navigation row */}
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-2">
              <img
                src={`${import.meta.env.BASE_URL}images/logo.png`}
                alt="Logo"
                className="w-8 h-8 object-contain opacity-80"
              />
              <span
                className="font-bold text-base text-primary tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                LiturgiaFlow{" "}
                <span style={{ color: "hsl(36 66% 48%)" }}>Pro</span>
              </span>
            </div>
            <nav className="hidden md:flex gap-1">
              <Link
                href="/"
                onClick={handleAdminClick}
                className={cn(
                  "text-sm font-medium transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1.5",
                  location === "/" && isAdmin
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-muted-foreground hover:text-primary hover:bg-secondary/60"
                )}
              >
                {!isAdmin && <Lock className="w-3 h-3 opacity-60" />}
                Panel de Admin
              </Link>
              <Link
                href="/lector"
                className={cn(
                  "text-sm font-medium transition-colors px-3 py-1.5 rounded-lg",
                  location === "/lector"
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-muted-foreground hover:text-primary hover:bg-secondary/60"
                )}
              >
                Portal del Lector
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-16">
        {children}
      </main>

      {/* FOOTER */}
      <footer
        className="relative z-10 md:static"
        style={{
          background: "#FDF2F8",
          borderTop: "1px solid #f0c8d8",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 text-center">
          <p
            className="text-xs italic tracking-wide"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "hsl(340 38% 40%)",
            }}
          >
            "Dios habla cada día; el reto es aprender a escucharlo." ❤️
          </p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-[38px] left-0 right-0 z-50 bg-white/95 border-t border-primary/20 backdrop-blur-sm">
        <div className="flex justify-around items-center h-14 px-4">
          <Link
            href="/"
            onClick={handleMobileAdminClick}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full",
              location === "/" && isAdmin ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
          <Link
            href="/lector"
            className={cn(
              "flex flex-col items-center justify-center w-full h-full",
              location === "/lector" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Lector</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
