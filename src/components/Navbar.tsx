"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/Logo"
import { Github, Menu } from "lucide-react"

export function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const pathname = usePathname()

    // Efecto sutil de glassmorphism al hacer scroll
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    // Ocultar nav en el dashboard, donde asumo ya hay un Sidebar lateral
    if (pathname?.startsWith("/dashboard")) return null

    return (
        <nav
            className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${scrolled
                    ? "bg-black/60 backdrop-blur-md border-white/10"
                    : "bg-transparent border-transparent"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo alineado a la izquierda */}
                <Link
                    href="/"
                    className="hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg p-1"
                >
                    <Logo size="md" withText={true} />
                </Link>

                {/* Links de navegación (Desktop) */}
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
                    <Link href="/features" className="hover:text-white transition-colors">
                        Features
                    </Link>
                    <Link href="/pricing" className="hover:text-white transition-colors">
                        Pricing
                    </Link>
                    <Link href="/docs" className="hover:text-white transition-colors">
                        Documentation
                    </Link>
                </div>

                {/* Acciones (Login / GitHub) */}
                <div className="flex items-center gap-4">
                    <Link
                        href="https://github.com/mescobar996/Healify"
                        target="_blank"
                        className="hidden md:flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        <Github className="w-4 h-4" />
                        <span>Star on GitHub</span>
                    </Link>

                    <Link
                        href="/login"
                        className="text-sm font-medium text-black bg-white px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.15)] focus:outline-none focus:ring-2 focus:ring-white/50 ring-offset-2 ring-offset-black"
                    >
                        Get Started
                    </Link>

                    {/* Menú Mobile */}
                    <button className="md:hidden text-zinc-400 hover:text-white">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </nav>
    )
}
