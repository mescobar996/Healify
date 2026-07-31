"""
Detector de sistema - RAM y modelos sugeridos
"""

import os
import platform
import subprocess
from dataclasses import dataclass
from typing import List


@dataclass
class ModelInfo:
    """Información de un modelo de Ollama"""
    name: str
    min_ram_gb: int
    size: str
    description: str


# Modelos disponibles ordenados por requisitos de RAM
MODELS: List[ModelInfo] = [
    ModelInfo("phi3:mini", 4, "~2GB", "Ultra ligero, bueno para texto simple"),
    ModelInfo("llama3.2:3b", 8, "~2GB", "Balanceado, recomendado para la mayoría"),
    ModelInfo("llama3.1:8b", 16, "~5GB", "Alta calidad, mejor para tareas complejas"),
    ModelInfo("llama3.1:13b", 24, "~8GB", "Máxima calidad local"),
]


class SystemDetector:
    """Detecta información del sistema"""

    def get_ram_gb(self) -> int:
        """Obtiene la RAM total del sistema en GB"""
        system = platform.system()
        
        try:
            if system == "Windows":
                # Windows
                output = subprocess.check_output(
                    'wmic memorychip get capacity',
                    shell=True,
                    text=True
                )
                lines = [l.strip() for l in output.split("\n") if l.strip().isdigit()]
                total_bytes = sum(int(l) for l in lines)
                return total_bytes // (1024 ** 3)
                
            elif system == "Darwin":
                # macOS
                output = subprocess.check_output(
                    "sysctl hw.memsize",
                    shell=True,
                    text=True
                )
                total_bytes = int(output.split(":")[1].strip())
                return total_bytes // (1024 ** 3)
                
            else:
                # Linux
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        if line.startswith("MemTotal"):
                            total_kb = int(line.split()[1])
                            return total_kb // (1024 ** 2)
        except Exception:
            pass
        
        return 8  # Default conservador

    def suggest_model(self, ram_gb: int) -> ModelInfo:
        """Sugiere el mejor modelo según la RAM disponible"""
        # Dejar 2GB para el sistema operativo
        available_gb = ram_gb - 2
        
        for model in reversed(MODELS):
            if available_gb >= model.min_ram_gb:
                return model
        
        return MODELS[0]  # Default al más ligero

    def get_platform(self) -> str:
        """Obtiene la plataforma actual"""
        return platform.system().lower()
