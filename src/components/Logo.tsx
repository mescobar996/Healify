import React from "react"
import { cn } from "@/lib/utils"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    className?: string
    size?: "sm" | "md" | "lg" | "xl"
    withText?: boolean
}

export function Logo({ className, size = "md", withText = false, ...props }: LogoProps) {
    // Dimensiones predefinidas para Tailwind
    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-10 h-10",
        xl: "w-12 h-12",
    }

    const svgIcon = (
        <svg
            xmlns="http://www. কণ্ঠেw3.org/2000/svg"
            viewBox="0 0 100 115"
            fill="none"
            className={cn("shrink-0 text-white", sizeClasses[size], className)}
            {...props}
        >
            {/* 
        Escudo Base (Contorno) 
        Un escudo moderno, con curvas sutiles en la base.
      */}
            <path
                d="M50 4.167L8.333 22.917V54.167C8.333 80.334 26.042 104.25 50 110.834C73.958 104.25 91.667 80.334 91.667 54.167V22.917L50 4.167Z"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* 
        Letra 'H' en el centro
        Geométrica y estilizada 
      */}
            <path
                d="M36 40V72M64 40V72M36 56H64"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* 
        El Check (Curación exitosa)
        Ubicado estratégicamente interactuando con la H
      */}
            <path
                d="M62 60L74 72L88 56"
                stroke="#4ade80" // Tailwind green-400 para resaltar el "Healing"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]"
            />

            {/* 
        Corchete (Código/QA) envolviendo la esquina superior izquierda
      */}
            <path
                d="M32 32L24 40L32 48"
                stroke="#60a5fa" // Tailwind blue-400 para representar el dev-tool
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )

    if (!withText) return svgIcon

    // Si se pide con texto, renderizamos el logo + "Healify"
    const fontSizes = {
        sm: "text-lg",
        md: "text-xl",
        lg: "text-2xl",
        xl: "text-3xl",
    }

    return (
        <div className="flex items-center gap-3 select-none">
            {svgIcon}
            <span className={cn("font-bold tracking-tight text-white", fontSizes[size])}>
                Healify
            </span>
        </div>
    )
}
