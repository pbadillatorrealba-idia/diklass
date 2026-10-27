# Proposal

## Why

El demo existente tiene nombres naturales, pero sus ocho consultas solo contienen entre dos y cuatro
entradas de anamnesis y no ejercitan planes, epicrisis, correcciones ni evolución. Se necesita un
dataset sintético plausible y mantenible, con trazabilidad desde los formularios locales y los
requisitos hasta cada dato cargado y su prueba.

## What Changes

- Conservar el contrato de FR-127: 15 tutores, 25 pacientes y 8 consultas; distribuir las consultas
  entre seis perros, con dos historias longitudinales. Mantener tres cuentas del fixture existente.
- Proponer nombres habituales en Chile, mestizos y gatos domésticos, hogares consistentes,
  antecedentes positivos, negativos y desconocidos. El carácter sintético se declara en metadatos
  y documentación, sin nombres como «Caso sintético». Ver [elenco y casos](dataset.md).
- Cubrir las 14 secciones de anamnesis canina, derivación, plan, tres consultas cerradas, un
  borrador de epicrisis, seis entradas de retroalimentación y correcciones recuperables.
- Identificar tutores, pacientes, consultas y entradas mediante claves estables independientes de
  nombres y posiciones; vincular versión, fuentes con SHA-256 y páginas, FR/US/SC, pruebas y
  registros/eventos creados. Separar inspiración estructural de respaldo clínico documental.
- Detectar cambios en esquemas, catálogos, servicios, migraciones y especificaciones mediante una
  comprobación ligera de vigencia. Todo cambio relevante exige adaptar el dataset o justificar
  documentalmente por qué sigue cubriendo el comportamiento. No generar datos clínicos automáticamente.
- No verificar los PDF, ni localmente ni en CI. Sus rutas, páginas y hashes documentan únicamente
  la inspección inicial; el control de vigencia solo usa contratos y metadatos versionados.
- Validar el conjunto completo antes de escribir; distinguir carga completa, parcial y versión
  desactualizada. Una carga parcial nunca se informa como éxito.

## Capabilities

### New Capabilities

- `dataset-clinico-trazable`: coherencia, procedencia, cobertura, carga verificable y mantenimiento
  de los datos de demostración; complementa FR-127 sin sustituirlo.

### Modified Capabilities

Ninguna publicada. Se conservan FR-124–FR-127 de `catalogos-y-datos-demo`, que continúa activo:
no se cambia su contrato ni se declara aceptado. El nuevo dataset reemplazará el contenido del
fixture al implementar, manteniendo sus cantidades y comandos.

## Impact

- Implementación prevista: `scripts/demo/datos-demo.ts`, `scripts/provision-demo-data.ts`,
  metadatos de cobertura en `scripts/demo/`, pruebas focalizadas en `tests/unit/scripts/` e
  integración viva; `package.json`, `SETUP.md` y `.github/workflows/ci.yml`.
- Consumidores: servicios de registro y retroalimentación, listas, ficha, historial y resumen
  longitudinal. Los fixtures mínimos de e2e y pgTap siguen aislados; no se reemplazan por el demo.
- Documentos consultados: formularios canino y felino en `data/docs/`; inventario y README del
  ZIP canino como contexto, sin importar registros externos ni declarar sus licencias verificadas.
- Dependencias de construcción: identidad y acceso, servicios implementados de registro,
  ficha etológica y retroalimentación; catálogos/RUT del cambio activo `catalogos-y-datos-demo`.
- Aceptación conjunta: la atribución se verifica con identidad y acceso; el resumen longitudinal,
  con registro y retroalimentación. No depende de implementar asistencia proactiva ni farmacología.
- Sin dependencias de ejecución nuevas, cambios de UI, migraciones, campos clínicos nuevos ni
  ampliación de la anamnesis a gatos. Estos se incluyen solo como fichas administrativas.

Estado: propuesta documental; especificación y diseño pendientes de aprobación, implementación y
aceptación pendientes. Los nombres, edades y relatos no acreditan revisión veterinaria.
