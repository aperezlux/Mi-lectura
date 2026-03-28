import React from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Soft liturgical background overlay */}
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
                className={cn(
                  "text-sm font-medium transition-colors px-3 py-1.5 rounded-lg",
                  location === "/"
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-muted-foreground hover:text-primary hover:bg-secondary/60"
                )}
              >
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

      {/* FOOTER — fixed, light rose */}
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

      {/* Mobile bottom nav (above footer) */}
      <div className="md:hidden fixed bottom-[38px] left-0 right-0 z-50 bg-white/95 border-t border-primary/20 backdrop-blur-sm">
        <div className="flex justify-around items-center h-14 px-4">
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center w-full h-full",
              location === "/" ? "text-primary" : "text-muted-foreground"
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
