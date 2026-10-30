# asr-real-captura-voz Specification

## Purpose
Captura de audio real del micrófono, transcripción con un proveedor externo y conservación del audio por tramo en el modo de escucha clínica, con aviso visible al profesional. Sustituye la entrada simulada sin cambiar la revisión y confirmación de antecedentes.

## Requirements

### Requirement: Captura real del micrófono (FR-014 · FR-015)

Con el modo real configurado, el sistema MUST capturar el audio del micrófono del dispositivo en ventanas de aproximadamente 30 segundos y entregar cada ventana a transcripción en orden, en web, iOS y Android.

#### Scenario: Una ventana de captura se transcribe
- **WHEN** el veterinario activa el modo de escucha en una consulta abierta y transcurre una ventana de captura
- **THEN** el sistema transcribe ese tramo y actualiza el borrador de anamnesis con lo que identifique

#### Scenario: Detener corta la captura en cualquier momento
- **WHEN** el veterinario detiene la escucha a mitad de una ventana
- **THEN** el micrófono se libera y el tramo parcial se resuelve con la decisión explícita ya definida (FR-055)

### Requirement: Micrófono no disponible (FR-054)

Si el permiso del micrófono se deniega o no hay dispositivo de captura, el sistema MUST indicarlo con claridad y MUST permitir continuar con el registro manual de la anamnesis.

#### Scenario: Permiso denegado
- **WHEN** el veterinario activa la escucha y el sistema operativo o el navegador deniega el micrófono
- **THEN** el estado visible es «captura no disponible», no se crea ningún tramo y la anamnesis manual sigue disponible

### Requirement: Transcripción con proveedor externo sin exponer credenciales

El sistema MUST transcribir cada ventana con el proveedor externo de reconocimiento de voz a través de un servicio del servidor, y la credencial del proveedor MUST NOT estar en el cliente, en el control de versiones ni en los registros.

#### Scenario: La credencial no llega al cliente
- **WHEN** se inspeccionan el paquete del cliente, el repositorio y los registros tras una escucha real
- **THEN** la credencial del proveedor no aparece en ninguno

#### Scenario: Petición sin sesión activa
- **WHEN** se solicita transcribir sin sesión autenticada, o sobre una sesión de escucha ajena a la clínica del solicitante, cerrada o de una consulta cerrada
- **THEN** el sistema rechaza la petición, no envía audio al proveedor y no persiste nada

### Requirement: Fallo del proveedor sin tramos a medio procesar (FR-055)

Si el proveedor falla, no responde a tiempo o devuelve una respuesta inválida, el sistema MUST informar el fallo con su motivo, MUST resolver el tramo como descartado y MUST NOT derivar antecedentes de él.

#### Scenario: El proveedor no responde
- **WHEN** la transcripción de un tramo excede el tiempo máximo o devuelve error
- **THEN** el profesional ve el motivo, el tramo queda descartado y la sesión termina de forma definida

### Requirement: Calidad insuficiente en transcripción real (FR-031)

El sistema MUST marcar como no confiable el tramo cuya transcripción real esté vacía o sea demasiado breve para ser clínicamente útil, y MUST NOT derivar antecedentes de él.

#### Scenario: Tramo en silencio
- **WHEN** una ventana contiene solo silencio o ruido y la transcripción resulta vacía
- **THEN** el tramo queda señalado como no confiable y no genera borradores

### Requirement: Conservación del audio por tramo

El sistema MUST conservar el audio de cada tramo transcrito, enlazado a su tramo de transcripción, accesible únicamente a usuarios de la misma clínica, y MUST NOT conservar el audio de un tramo cuya escritura fue rechazada.

#### Scenario: El audio queda enlazado al tramo
- **WHEN** se transcribe un tramo con éxito
- **THEN** el audio queda guardado y asociado a ese tramo y a su sesión de escucha

#### Scenario: Aislamiento por clínica
- **WHEN** un usuario de otra clínica intenta leer o escribir el audio de un tramo
- **THEN** el sistema lo rechaza

### Requirement: Aviso visible de grabación y conservación

Mientras la captura real esté activa, el sistema MUST mostrar un aviso persistente de que se graba audio y de que se conserva, y el aviso MUST NOT depender solo del color.

#### Scenario: Aviso durante la captura
- **WHEN** la escucha real está activa
- **THEN** la interfaz muestra, en texto, que se está grabando y conservando audio, y lo anuncia a tecnologías de asistencia

### Requirement: Modo simulado conservado

El sistema MUST permitir operar el modo de escucha con captura y transcripción simuladas cuando el modo real no esté configurado, de modo que las pruebas automatizadas no requieran micrófono, credencial ni red externa.

#### Scenario: Sin configuración real
- **WHEN** el modo real no está configurado
- **THEN** el modo de escucha usa el guion simulado y no envía audio a ningún tercero
