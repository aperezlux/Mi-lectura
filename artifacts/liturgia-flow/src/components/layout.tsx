import React from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Users, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo.png`} 
                alt="LiturgiaFlow Logo" 
                className="w-10 h-10 object-contain"
              />
              <span className="font-display font-bold text-xl text-primary tracking-tight">LiturgiaFlow <span className="text-accent">Pro</span></span>
            </div>
            
            <nav className="hidden md:flex gap-6">
              <Link 
                href="/" 
                className={cn(
                  "font-medium transition-colors hover:text-primary px-3 py-2 rounded-md",
                  location === "/" ? "text-primary bg-primary/5" : "text-muted-foreground"
                )}
              >
                Panel de Admin
              </Link>
              <Link 
                href="/lector" 
                className={cn(
                  "font-medium transition-colors hover:text-primary px-3 py-2 rounded-md",
                  location === "/lector" ? "text-primary bg-primary/5" : "text-muted-foreground"
                )}
              >
                Portal del Lector
              </Link>
            </nav>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 pb-safe">
        <div className="flex justify-around items-center h-16 px-4">
          <Link 
            href="/" 
            className={cn(
              "flex flex-col items-center justify-center w-full h-full",
              location === "/" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Calendar className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
          <Link 
            href="/lector" 
            className={cn(
              "flex flex-col items-center justify-center w-full h-full",
              location === "/lector" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Users className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Lector</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
