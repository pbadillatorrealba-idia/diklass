# Dataset propuesto

Estado: borrador editorial v1, 2026-10-27. No cargado ni validado por veterinario. Todos los nombres,
relatos y relaciones son inventados; cualquier coincidencia es fortuita. Las claves son técnicas y
no se muestran como nombres. Este documento concreta el contenido; el fixture ejecutable se
preparará después de aprobar especificación y diseño.

## Sources

Inspección mediante extracción de texto con `pdftotext -layout`; páginas contadas desde 1.
No se verificó visualmente la maquetación de los PDF. No contienen expedientes cumplimentados.

| ID | Ruta local | SHA-256 | Uso autorizado en esta propuesta |
|---|---|---|---|
| DOC-CAN | `data/docs/Hªclinica canina nueva.pdf` | `8920caf141b1d567230498e83c88442642617e619061ff4e71f36e44257c6df5` | Estructura y preguntas de ficha y consulta canina; no evidencia de diagnósticos ni tratamientos |
| DOC-FEL | `data/docs/Hªclinica felina nueva.pdf` | `4f36bf4a39435f266efbd82a99a4b91d2cae892300a4f2658b11aeafcd7981c0` | Ficha e identificación felina; referencia de futuras diferencias por especie |
| EDITORIAL-CL-01 | Este documento, versión editorial v1 | Revisión Git del commit que lo contiene | Nombres, hogares, pesos, fechas y relatos inventados para probar flujos |

El README de `DIKLASS_Base_Etologia_Canina_86487_registros.zip` describe CBARQ/ManyDogs y advierte
que son fuentes separadas con posible solapamiento y sin historias clínicas, tratamientos o
evoluciones validados. Se inspeccionaron inventarios de ambos ZIP y ese README, no sus filas ni
licencias originales. No se usan para derivar pacientes, frecuencias, diagnósticos o dosis.
`MIEDO .pdf` no se evaluó para esta propuesta; el corpus de conocimiento mantiene su circuito propio.

## Households

Se conservan los 15 nombres actuales del demo. Apellidos compuestos, tildes y nombres de dos
palabras ejercitan las vistas sin recurrir a etiquetas artificiales. Contactos y RUT se generan
con la política de FR-127; no copiar domicilios reales. La comuna es contexto editorial.

| Clave | Tutor | Comuna | Pacientes | Composición editorial del hogar |
|---|---|---|---|---|
| T01 | Camila Muñoz Rojas | Ñuñoa | P01, P02, P03 | Dos adultos; departamento; dos perros y una gata |
| T02 | Matías González Soto | Providencia | P04, P05 | Un adulto; departamento; perro y gata, sin cachorro adicional |
| T03 | Francisca Contreras Díaz | Las Condes | P06, P07 | Dos adultos y adolescente de 15 años; casa; dos perros |
| T04 | Sebastián Pérez Fuentes | La Florida | P08, P09 | Dos adultos; casa con patio; perro y gata |
| T05 | Valentina Silva Araya | Maipú | P10, P11 | Dos adultos y niño de 8 años; casa; dos perros |
| T06 | Felipe Rojas Morales | Puente Alto | P12, P13 | Dos adultos; casa; perro y gata |
| T07 | Catalina Soto Vargas | Viña del Mar | P14 | Una adulta; departamento; una perra |
| T08 | Ignacio Díaz Tapia | Valparaíso | P15, P16 | Dos adultos; casa; perro y gata |
| T09 | Javiera Reyes Campos | Concepción | P17 | Una adulta; departamento; un perro |
| T10 | Cristóbal Torres Núñez | Temuco | P18, P19 | Dos adultos; casa; perra y gato |
| T11 | Constanza Fuentes Sepúlveda | Valdivia | P20 | Dos adultos; casa; una perra |
| T12 | Nicolás Araya Herrera | Antofagasta | P21, P22 | Dos adultos; departamento; perro y gata |
| T13 | María José Vásquez Castillo | La Serena | P23 | Dos adultos; departamento; un perro |
| T14 | Joaquín Espinoza Cortés | Rancagua | P24 | Dos adultos; casa; un perro |
| T15 | Pilar Carrasco Guzmán | Las Condes | P25 | Una adulta; departamento; una gata |

## Patients

Fecha de referencia: 2026-10-27. Fechas y pesos son valores editoriales, no mediciones reales.
M/H = macho/hembra; E/I = esterilizado/entero. En el fixture se usan los valores canónicos del
catálogo, nunca estas abreviaturas. DPC = doméstico de pelo corto; DPL = doméstico de pelo largo.
La mezcla de razas no pretende representar prevalencias chilenas.

| Clave | Nombre | Tutor | Especie / raza | Sexo / estado | Nacimiento o edad estimada | Peso kg | Antecedente o situación editorial |
|---|---|---|---|---|---|---|---|
| P01 | Cholito | T01 | Canino / mestizo | M/E | 2019-03-12 | 14,2 | Adoptado; vocalizaciones al quedar solo; C01/C02 |
| P02 | Canela | T01 | Canino / poodle | H/E | 2016-08-02 | 6,1 | Cardiopatía referida en informe previo; tratamiento consignado sin añadir pauta nueva |
| P03 | Gala | T01 | Felino / DPC | H/E | 2021-05-20 | 4,0 | Convive con ambos perros; ficha administrativa |
| P04 | Rucio | T02 | Canino / mestizo | M/I | Desconocido; 57 meses estimados | 24,5 | Reacción ante perros con correa; C03 |
| P05 | Luna | T02 | Felino / DPC | H/E | 2020-11-03 | 3,8 | Comparte hogar con Rucio; sin relato de llegada de cachorro |
| P06 | Simón | T03 | Canino / labrador retriever | M/E | 2017-06-30 | 31,0 | Reacción alimentaria referida; no presentarla como alergia confirmada sin respaldo |
| P07 | Frida | T03 | Canino / mestiza | H/E | 2023-02-14 | 12,8 | Miedo a ruidos intensos; C04/C05 |
| P08 | Canelo | T04 | Canino / golden retriever | M/I | 2021-09-09 | 32,4 | Sin consulta aún; antecedentes sin completar |
| P09 | Pelusa | T04 | Felino / DPL | H/E | 2018-04-22 | 4,5 | Enfermedad renal referida; ficha administrativa |
| P10 | Mora | T05 | Canino / mestiza | H/E | 2020-02-27 | 18,3 | Adopción adulta; edad de esterilización desconocida |
| P11 | Rulo | T05 | Canino / mestizo | M/I | 2024-03-18 | 20,1 | Muerde objetos al jugar; no etiquetar como trastorno por actividad o raza |
| P12 | Bruno | T06 | Canino / schnauzer miniatura | M/E | 2015-12-05 | 8,4 | Adulto mayor; sin consulta clínica cargada |
| P13 | Porota | T06 | Felino / DPC | H/E | 2022-07-11 | 3,6 | Adoptada; procedencia previa desconocida |
| P14 | Lola | T07 | Canino / cocker spaniel | H/E | 2014-10-19 | 12,9 | Otitis recurrente referida; sin diagnóstico conductual |
| P15 | Negro | T08 | Canino / mestizo | M/I | 2023-06-01 | 28,0 | Gruñe ante visitas; C06; convive con Mía |
| P16 | Mía | T08 | Felino / DPC | H/I | 2025-01-09 | 3,4 | Ficha administrativa; hogar compartido con Negro |
| P17 | Coco | T09 | Canino / chihuahua | M/E | 2018-08-24 | 2,7 | Ladra ante ruidos del pasillo según tutora; sin consulta cargada |
| P18 | Kira | T10 | Canino / mestiza | H/I | 2022-11-30 | 23,5 | Actividad y dificultad para descansar referidas; C07 |
| P19 | Copito | T10 | Felino / DPC | M/E | 2021-03-03 | 4,8 | Comparte hogar con Kira; ficha administrativa |
| P20 | Pepa | T11 | Canino / mestiza | H/E | 2019-05-16 | 7,2 | Ficha sin antecedentes conocidos, no «sin enfermedades» |
| P21 | Chascón | T12 | Canino / mestizo | M/E | 2016-01-21 | 13,6 | Prurito estacional referido; separar signo de alergia confirmada |
| P22 | Chascona | T12 | Felino / DPL | H/E | 2019-12-12 | 4,1 | Ficha administrativa |
| P23 | Dante | T13 | Canino / pug | M/I | 2024-08-08 | 8,0 | Ficha sin consulta; no inferir tolerancia al ejercicio por el peso |
| P24 | Tango | T14 | Canino / mestizo | M/E | 2012-04-04 | 22,0 | Dolor osteoarticular referido; historia médica como contexto, C08 |
| P25 | Cleo | T15 | Felino / DPC | H/E | 2017-09-27 | 3,9 | Solo correo del tutor; ficha administrativa |

Las ocho fichas felinas remiten a DOC-FEL p. 1 únicamente para estructura de identificación.
Areneros, refugios, alturas y rascadores de DOC-FEL pp. 4–5 quedan como oportunidad futura, sin
crear campos felinos ni introducirlos como preguntas caninas. Ninguna gata recibe un diagnóstico
conductual por no existir datos de una consulta.

## Consultations

Las claves de veterinarios V01–V03 se vincularán a las tres cuentas del fixture existente sin
copiar contraseñas a estos artefactos. Autoría y aprobación en la DB serán actos simulados de esas
cuentas. Los planes siguientes son guiones de prueba, no recomendaciones para animales reales.

| Clave | Paciente | Estado al terminar la carga | Guion y datos relevantes | Autoría simulada | Trazabilidad funcional |
|---|---|---|---|---|---|
| C01 | P01 | Cerrada; epicrisis aprobada y correctiva | Al quedarse solo vocaliza a veces y mueve la puerta; inicio tras cambio de horario. Información incompleta; plan editorial de completar registro de episodios y revisión clínica, sin fármacos nuevos | V01 abre, V02 añade una entrada, V01 aprueba/corrige | FR-004, FR-021, FR-024, FR-110–FR-112; US2-AC6, US3-AC1/2/4 |
| C02 | P01 | Abierta; sin epicrisis | Consulta posterior simulada; recupera C01 y F01/F02; mantiene pendientes y pregunta por duración de episodios | V03 | FR-013, FR-042, FR-045; US4-AC1/3/5, US10-AC6 |
| C03 | P04 | Abierta; sin epicrisis | Ladra y tira de la correa al acercarse perros. Contextos y distancia registrados; sin diagnóstico por raza. Sin derivación; familiares sin agresión reportada | V02 | FR-044, FR-111; US1-AC3, US2-AC4 |
| C04 | P07 | Cerrada; epicrisis aprobada | Se esconde y tiembla ante ruidos intensos; convive con Simón. Historia y contexto registrados; plan editorial y seguimiento sin introducir dosis | V02 | FR-004, FR-011, FR-012, FR-112; US3-AC1/2 |
| C05 | P07 | Abierta; epicrisis en borrador | Reconsulta simulada tras nuevos episodios; incorpora F03/F04. Borrador conserva falta de confirmación, no aparece como definitivo | V03 | FR-010, FR-045; US3-AC3, US4-AC5 |
| C06 | P15 | Abierta; sin epicrisis | Gruñe cuando entran visitas. Contexto de aproximación, postura e inicio; no ha mordido según tutor. No convertir «gruñido» en «mordida» | V01 | FR-004, FR-021, FR-111; US2-AC2/3 |
| C07 | P18 | Abierta; sin epicrisis | Tutor refiere que cuesta que descanse; registra paseos, descanso y juego. Inferencia editorial separada de lo reportado; no diagnóstico de «hiperactividad» | V02 | FR-021, FR-044; US2-AC3/4 |
| C08 | P24 | Cerrada; epicrisis aprobada | Menor disposición al juego, dolor referido y chequeo pendiente. Sin tratamiento conductual indicado; evita atribuir el cambio solo a edad | V03 | FR-018, FR-057, FR-112; US10-AC12 |

Los intervalos «primera consulta», «seguimiento» y «reconsulta» pertenecen al guion. Las fechas de
auditoría serán las reales de la carga y solo se comprueba su orden. No se simulan semanas
transcurridas cambiando fechas protegidas.

### Anamnesis detallada de C01

Claves previstas `C01-A01`…`C01-A20`. Todo texto es EDITORIAL-CL-01. La columna «Fuente» solo
explica de dónde procede la pregunta; los relatos no fueron extraídos del formulario.

| Entrada | Campo actual | Valor editorial | Procedencia clínica | Fuente estructural |
|---|---|---|---|---|
| C01-A01 | `motivo_consulta` | «Los días que salgo a trabajar, Cholito a veces aúlla y mueve la puerta de entrada.» | reportada | DOC-CAN p. 2 |
| C01-A02 | `historia_problema` | «Camila lo nota desde el cambio de horario de hace cuatro meses; no tiene grabaciones de todos los episodios.» | reportada | DOC-CAN p. 3 |
| C01-A03 | `vivienda_tipo` | «Departamento en Ñuñoa; vive con dos adultos, Canela y Gala.» | reportada | DOC-CAN p. 2 |
| C01-A04 | `familia_otros_animales` | «Convive con la perra Canela y la gata Gala; la tutora no relata conflictos entre ellos.» | reportada | DOC-CAN p. 2 |
| C01-A05 | `rutina_paseos` | «Dos paseos diarios de unos 20 minutos; horarios variables durante la semana.» | reportada | DOC-CAN p. 2 |
| C01-A06 | `alimentacion_pauta` | «Alimento seco repartido en dos comidas; premios durante los paseos.» | reportada | DOC-CAN p. 5 |
| C01-A07 | `eliminacion_calle` | `si` | reportada | DOC-CAN p. 5 |
| C01-A08 | `soledad_tiempo` | «Hasta cuatro horas en días laborales; no queda solo todos los días.» | reportada | DOC-CAN p. 5 |
| C01-A09 | `soledad_vocaliza` | `a_veces` | reportada | DOC-CAN p. 5 |
| C01-A10 | `soledad_elimina` | `no` | reportada | DOC-CAN p. 5 |
| C01-A11 | `actividad_juega` | «Sigue buscando su pelota y pasea con disposición similar a antes.» | reportada | DOC-CAN p. 5 |
| C01-A12 | `familia_agresion` | `no` | reportada | DOC-CAN p. 6 |
| C01-A13 | `visitas_esconde` | `a_veces` | reportada | DOC-CAN p. 6 |
| C01-A14 | `perros_machos` | «La tutora refiere encuentros tranquilos con perros conocidos.» | reportada | DOC-CAN p. 7 |
| C01-A15 | `manejo_duerme` | «Duerme en su cama en el dormitorio; la tutora no refiere despertares habituales.» | reportada | DOC-CAN p. 7 |
| C01-A16 | `miedo` | `si` | reportada | DOC-CAN p. 7 |
| C01-A17 | `miedo_reaccion` | «Se aleja de la aspiradora y busca otra pieza.» | reportada | DOC-CAN p. 7 |
| C01-A18 | `tratamientos_anteriores` | «La tutora probó dejar una radio encendida; no lleva registro para valorar cambios.» | reportada | DOC-CAN p. 8 |
| C01-A19 | `medico_antecedentes` | «Camila no conoce enfermedades previas; falta revisar antecedentes del rescate.» | reportada | DOC-CAN p. 8 |
| C01-A20 | `texto_libre` | «Podría existir relación temporal con las ausencias; falta verificar duración y contexto.» | inferida | EDITORIAL-CL-01; FR-021 |

`soledad_destroza` queda deliberadamente sin responder: mover una puerta no prueba destrucción.
No guardar `no` por omisión. El relato de «sin enfermedades conocidas» tampoco se convierte en
negativo confirmado. Para ejercitar `negative: true`, C03 incluye el antecedente explícito
«El tutor niega mordidas previas», conservando su carácter reportado y el texto original.

En C01, la derivación es afirmativa, con profesional y centro inventados, opinión editorial y
contacto de prueba; C03 declara no referido; P20 deja el bloque sin dato. P01 incluye edades
conocidas de adopción y esterilización; P10 desconoce la segunda. P04 conserva nacimiento
desconocido y edad estimada. Estas diferencias no se rellenan para uniformar las fichas.

### Coverage

| Sección del catálogo actual | Ejemplo mínimo | Fuente |
|---|---|---|
| `motivo` | C01-A01/A02 | DOC-CAN pp. 2–3 |
| `entorno` | C01-A03/A04 | DOC-CAN p. 2 |
| `rutina` | C01-A05 | DOC-CAN p. 2 |
| `alimentacion` | C01-A06 | DOC-CAN p. 5 |
| `eliminacion` | C01-A07 | DOC-CAN p. 5 |
| `soledad` | C01-A08/A09/A10; pregunta omitida | DOC-CAN p. 5 |
| `actividad` | C01-A11; C08 cambio de juego | DOC-CAN p. 5 |
| `social_familia` | C01-A12 | DOC-CAN p. 6 |
| `social_desconocidos` | C01-A13; C06 contexto de visitas | DOC-CAN p. 6 |
| `otros_perros` | C01-A14; C03 distancia/contexto | DOC-CAN p. 7 |
| `manejo` | C01-A15 | DOC-CAN p. 7 |
| `otras_conductas` | C01-A16/A17; C04 miedo | DOC-CAN pp. 7–8 |
| `tratamientos_previos` | C01-A18 | DOC-CAN p. 8 |
| `historial_medico` | C01-A19; C08 chequeo pendiente | DOC-CAN p. 8 |

El catálogo tiene 14 secciones: motivo e historia del problema están en una misma sección.
La implementación cubrirá las 14 vigentes y comprobará su inventario.
El plan queda fuera de ese catálogo: DOC-CAN pp. 8–10 → `consultationPlanSchema`
→ C01/C04/C08 → FR-112. Seguimiento: DOC-CAN p. 11 → retroalimentación → F01–F06 → FR-018.
El manifiesto ejecutable desglosará todos los campos como cubiertos/excluidos con motivo.

### Feedback

Seis registros en total; F06 es una corrección de F05, no un séptimo registro. El motivo de esa
corrección será precisar un reporte antes incompleto. C01 tiene además una epicrisis correctiva
que aclara el tiempo máximo de ausencia; no toca la original. El guion de C01 ya refleja la
lectura corregida de cuatro horas; el registro original consignará tres horas.

| Clave | Consulta | Adherencia | Evolución | Contenido editorial | Autoría |
|---|---|---|---|---|---|
| F01 | C01 | parcial | mejoriaParcial | La tutora refiere menos episodios en días registrados; faltan días de observación | V02 |
| F02 | C01 | completa | mejoria | Nuevo reporte con mejoría referida; no se declara causalidad del plan | V01 |
| F03 | C04 | ninguna | sinCambios | El tutor no aplicó las medidas acordadas y refiere episodios similares | V03 |
| F04 | C04 | parcial | empeoramiento | Nuevo ruido intenso y mayor reacción referida; roce cutáneo con arnés, evento leve reportado, causalidad no establecida | V02 |
| F05 | C08 | desconocida | desconocida | No se precisa evolución; `treatmentApplied` vacío, sin tratamiento conductual indicado | V01 |
| F06 | C08 | desconocida | mejoriaParcial | Correctiva de F05 al completar el reporte, sin borrar el desconocimiento inicial | V03 |

Las seis entradas conservan categóricos válidos. `adverseEvents: []` se usa conforme al contrato
actual para las entradas sin eventos registrados; no añadir eventos para completar casilleros.
No se inventa una reacción a un fármaco que no se haya consignado en el guion.

## Traceability example

Recorrido previsto: `DOC-CAN / SHA-256 / p. 5 / soledad` → campo `soledad_vocaliza` →
`EDITORIAL-CL-01 / C01-A09 / a_veces / reportada` → FR-111 y FR-021 → US20-AC3/AC6 y SC-024 →
`tests/unit/scripts/datos-demo.test.ts` → manifiesto de carga con ID del registro y evento del
autor autenticado. Los dos últimos eslabones se completan al implementar y cargar; hoy no existen.

Se registra la revisión Git y la versión del dataset, sin declarar «aceptado» por pasar una prueba
de forma. Se distinguen siempre: propuesta editorial, implementación, comprobación técnica y
aceptación clínica. La revisión veterinaria del contenido es pendiente.
