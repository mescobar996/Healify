## Qué cambia

<!-- Resumen de una línea: qué hace este PR y por qué. -->

## Checklist

- [ ] Corrí `npm run verify` (build + tests de los 10 paquetes)
- [ ] Corrí `npm run lint` (sin warnings)
- [ ] Corrí `npm run coverage` si el cambio toca lógica (no baja umbrales)
- [ ] Actualicé docs si corresponde (README, CHANGELOG, docs/)

## Notas

<!-- Cualquier detalle que el reviewer deba saber: decisión de diseño, trade-offs, deuda consciente. -->

## Contexto de identidad

Healify es heurística determinista + verificación contra el DOM real, **no IA**, y corre 100%
local. Si el cambio propone red, IA o comportamiento no determinista, este es el lugar para
argumentar por qué vale la pena.
