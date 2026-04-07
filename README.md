# Sistema Revolución Atlética — Frontend

Sistema de gestión integral para gimnasios, desarrollado con **Angular 20** y empaquetado como aplicación de escritorio con **Electron**. Pensado para operar sin conocimientos técnicos desde recepción, gerencia o administración central.

---

## ¿Qué problema resuelve?

Los gimnasios pequeños y medianos suelen gestionar sus operaciones con hojas de cálculo, cuadernos o sistemas genéricos que no se adaptan a su flujo de trabajo real. Esto genera:

- Pérdida de control sobre el inventario de productos
- Dificultad para rastrear membresías activas y vencidas
- Falta de visibilidad sobre asesorías personalizadas por entrenador
- Cortes de caja inconsistentes o incompletos
- Ninguna forma de distinguir si una asesoría vino de un paquete o fue contratada individualmente

**Sistema RA** resuelve estos problemas con un único panel centralizado adaptado al rol de cada usuario.

---

## Qué hace el sistema

### Socios
Registro completo de miembros del gimnasio. Permite buscar, filtrar y consultar el historial de membresías, asesorías y pagos de cada socio desde una sola vista.

### Membresías e Inscripciones
Control de altas, renovaciones y vencimientos. El sistema identifica visualmente membresías próximas a vencer o ya vencidas para agilizar la renovación en recepción.

### Asesorías personalizadas
Registro y seguimiento de asesorías de entrenamiento por entrenador. Se distingue el tipo de asesoría (Individual o Paquete RA) para saber si fue contratada de forma directa o incluida en un paquete.

### Entrenadores
Catálogo de entrenadores por gimnasio con acceso directo a sus asesorías activas. El menú de acciones funciona correctamente en cualquier tamaño de pantalla.

### Paquetes RA
Gestión de paquetes de servicios que combinan membresía y asesoría. Al comprar un paquete, la asesoría se vincula automáticamente como tipo `PAQUETE_RA`.

### Inventario por turno
Control de productos por turno (Mañana / Tarde / Único). Incluye alertas automáticas con sonido para recordar el cierre de inventario a los 20, 10 y 5 minutos antes — y a la hora exacta — según el turno activo.

| Turno | Cierre |
|-------|--------|
| Mañana (Lun–Vie) | 14:00 |
| Tarde (Lun–Vie) | 22:00 |
| Único (Sábado) | 16:00 |
| Único (Domingo) | 14:00 |

### Corte de caja
Apertura y cierre de cortes con desglose por tipo de pago (Efectivo, Tarjeta, Transferencia) y por origen (Venta, Membresía, Asesoría). Impresión de ticket de corte y registro de salidas de efectivo.

### Punto de venta
Registro de ventas de productos con soporte para descuentos y múltiples formas de pago. Genera ticket imprimible.

### Administración (solo Admin)
- Estadísticas y métricas: ranking de entrenadores, productos y paquetes más vendidos, distribución de edades
- Gestión de usuarios del sistema
- Gestión de promociones y membresías
- Vista global de cortes y ventas por gimnasio
- Exportación a Excel de asesorías con columna de tipo (Individual / Paquete RA)

### Multi-gimnasio
El sistema soporta operar múltiples sedes desde el mismo panel. El administrador puede alternar entre gimnasios; cada rol ve únicamente su sede asignada.

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| **Recepcionista** | Socios, membresías, ventas, inventario, asesorías |
| **Gerente** | Todo lo anterior + descuentos, cortes de caja |
| **Administrador** | Acceso completo + estadísticas, usuarios, multi-gimnasio |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 20 (standalone components, signals) |
| Estilos | Tailwind CSS |
| Escritorio | Electron |
| Autenticación | JWT |
| Backend | API REST (Spring Boot, Heroku) |

---

## Levantar en desarrollo

```bash
npm install
ng serve
```

La app queda disponible en `http://localhost:4200`.

## Compilar para escritorio (Electron)

```bash
ng build
npm run electron:build
```

Genera el instalador en la carpeta `dist/`.

---

## Versión actual

`v0.1.7`
