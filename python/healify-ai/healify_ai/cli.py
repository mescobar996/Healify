#!/usr/bin/env python3
"""
Healify AI CLI - Comandos principales
"""

import argparse
import json
import os
import sys
from typing import Optional

from . import HealifyAI
from .detector import SystemDetector, MODELS


def cmd_setup(args):
    """Configura IA local"""
    print("\n🔧 Healify AI Setup\n")
    
    detector = SystemDetector()
    ai = HealifyAI()
    
    # Verificar Ollama
    result = ai.init()
    if not result["success"]:
        print(f"❌ {result['message']}")
        sys.exit(1)
    print("✅ Ollama detectado en http://localhost:11434")
    
    # Detectar RAM
    ram = detector.get_ram_gb()
    suggested = detector.suggest_model(ram)
    print(f"\n💾 RAM del sistema: {ram}GB")
    print(f"\n🤖 Modelo sugerido: {suggested.name}")
    print(f"   Tamaño: {suggested.size}")
    print(f"   Descripción: {suggested.description}")
    
    # Verificar modelos instalados
    installed = ai.ollama.list_models()
    installed_names = [m["name"] for m in installed]
    
    if installed:
        print("\n📦 Modelos instalados:")
        for m in installed:
            print(f"   - {m['name']}")
    else:
        print("\n⚠️  No hay modelos instalados")
    
    # Verificar si el sugerido está instalado
    model_base = suggested.name.split(":")[0]
    has_suggested = any(model_base in name for name in installed_names)
    
    if not has_suggested:
        print(f"\n📥 Para descargar {suggested.name}:")
        print(f"   docker exec -it healify-ollama ollama pull {suggested.name}")
    
    # Guardar configuración
    config_path = os.path.join(os.getcwd(), "healify.config.json")
    config = {}
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = json.load(f)
    
    config["ai"] = {
        "enabled": True,
        "model": suggested.name,
        "language": config.get("ai", {}).get("language", "es"),
        "autoFix": False,
        "explainSeverity": "all",
        "ollamaUrl": "http://localhost:11434",
    }
    
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print("\n✅ Configuración guardada en healify.config.json")


def cmd_status(args):
    """Muestra estado de Ollama"""
    print("\n📊 Estado de Healify AI\n")
    
    ai = HealifyAI()
    result = ai.init()
    
    if result["success"]:
        print("Ollama: ✅ Corriendo")
        
        detector = SystemDetector()
        ram = detector.get_ram_gb()
        suggested = detector.suggest_model(ram)
        print(f"RAM: {ram}GB")
        print(f"Modelo sugerido: {suggested.name}")
        
        installed = ai.ollama.list_models()
        if installed:
            print("\nModelos instalados:")
            for m in installed:
                print(f"  - {m['name']}")
    else:
        print("Ollama: ❌ No disponible")
    
    # Mostrar configuración
    config_path = os.path.join(os.getcwd(), "healify.config.json")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = json.load(f)
        
        if "ai" in config:
            print("\nConfiguración:")
            print(f"  Modelo: {config['ai'].get('model')}")
            print(f"  Idioma: {config['ai'].get('language')}")
            print(f"  Auto-fix: {'Sí' if config['ai'].get('autoFix') else 'No'}")


def cmd_explain(args):
    """Explica un selector"""
    ai = HealifyAI()
    result = ai.init()
    
    if not result["success"]:
        print(f"❌ {result['message']}")
        sys.exit(1)
    
    print(f"\n🔍 Analizando: {args.selector}\n")
    explanation = ai.explain_selector(args.selector)
    print(explanation)


def cmd_fix(args):
    """Sugiere fix para selector roto"""
    ai = HealifyAI()
    result = ai.init()
    
    if not result["success"]:
        print(f"❌ {result['message']}")
        sys.exit(1)
    
    print(f"\n🔧 Buscando fix para: {args.selector}\n")
    suggestion = ai.suggest_fix(args.selector, args.dom)
    
    print(f"Original: {suggestion['original']}")
    print(f"Propuesto: {suggestion['proposed']}")
    print(f"Confianza: {suggestion['confidence']}%")
    print(f"Explicación: {suggestion['explanation']}")


def cmd_chat(args):
    """Chat interactivo"""
    ai = HealifyAI()
    result = ai.init()
    
    if not result["success"]:
        print(f"❌ {result['message']}")
        sys.exit(1)
    
    print("\n💬 Chat con Healify AI (escribe 'salir' para terminar)\n")
    
    history = []
    
    while True:
        try:
            user_input = input("Tú: ").strip()
            
            if user_input.lower() in ["salir", "exit", "quit"]:
                print("\n👋 ¡Hasta luego!")
                break
            
            if not user_input:
                continue
            
            response = ai.chat(user_input, history)
            print(f"\nIA: {response}\n")
            
            history.append({"role": "user", "content": user_input})
            history.append({"role": "assistant", "content": response})
            
        except KeyboardInterrupt:
            print("\n\n👋 ¡Hasta luego!")
            break
        except EOFError:
            break


def cmd_models(args):
    """Lista modelos disponibles"""
    print("\n📦 Modelos de Ollama\n")
    
    detector = SystemDetector()
    ram = detector.get_ram_gb()
    
    print(f"RAM del sistema: {ram}GB\n")
    
    # Verificar modelos instalados
    ai = HealifyAI()
    if ai.ollama.is_running():
        installed = ai.ollama.list_models()
        if installed:
            print("Instalados:")
            for m in installed:
                print(f"  ✅ {m['name']}")
    
    # Mostrar modelos recomendados
    print("\nModelos recomendados:")
    for model in MODELS:
        icon = "✅" if ram >= model.min_ram_gb + 2 else "❌"
        print(f"  {icon} {model.name} ({model.size}) - {model.description}")


def main():
    parser = argparse.ArgumentParser(
        description="Healify AI - IA Local para Testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  healify-ai setup          Configura IA local
  healify-ai status         Muestra estado de Ollama
  healify-ai explain "[data-testid='btn']"
  healify-ai chat           Chat interactivo
  healify-ai models         Lista modelos disponibles
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")
    
    # setup
    subparsers.add_parser("setup", help="Configura IA local")
    
    # status
    subparsers.add_parser("status", help="Muestra estado de Ollama")
    
    # explain
    explain_parser = subparsers.add_parser("explain", help="Explica un selector")
    explain_parser.add_argument("selector", help="Selector a analizar")
    
    # fix
    fix_parser = subparsers.add_parser("fix", help="Sugiere fix para selector roto")
    fix_parser.add_argument("selector", help="Selector roto")
    fix_parser.add_argument("dom", help="Fragmento del DOM actual")
    
    # chat
    subparsers.add_parser("chat", help="Chat interactivo")
    
    # models
    subparsers.add_parser("models", help="Lista modelos disponibles")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    commands = {
        "setup": cmd_setup,
        "status": cmd_status,
        "explain": cmd_explain,
        "fix": cmd_fix,
        "chat": cmd_chat,
        "models": cmd_models,
    }
    
    commands[args.command](args)


if __name__ == "__main__":
    main()
