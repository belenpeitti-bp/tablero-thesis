# Tablero de tesis

Página web para trabajar el índice de la tesis: un espacio por cada parte (introducción, capítulos 1 a 7 y conclusión) con preguntas de investigación, hipótesis y discusiones historiográficas; listas de bibliografía y de fuentes por capítulo; carga de los capítulos como archivos, de los que se extraen los principales actores y las partes de la tesis donde reaparecen.

Todo se edita directamente en la página publicada. No hace falta contraseña; si más adelante querés una, se agrega sin tocar el código (ver «Contraseñas opcionales»).

---

## Qué hay en el tablero

**Índice (portada).** Título de la tesis y un panel por cada parte. Cada panel tiene:

- número y título del capítulo;
- preguntas de investigación (numeradas);
- hipótesis (H1, H2…);
- discusiones historiográficas (cada una con un título y un texto);
- enlaces a su **bibliografía** y a sus **fuentes**, con la cantidad de entradas;
- el archivo del capítulo, si lo subiste;
- sus **actores principales**, con una tira de nueve casillas que muestra en qué otras partes de la tesis reaparece cada uno (cuanto más oscura la casilla, más menciones; la casilla con borde rojo es el capítulo que estás mirando).

En la columna izquierda, el índice muestra con las letras P H D B F A qué partes de cada capítulo ya están cargadas. Los paneles se pliegan y despliegan con el botón de la esquina.

**Bibliografía y fuentes por capítulo** (`/capitulo/capitulo-3/bibliografia`, `/capitulo/capitulo-3/fuentes`). Las referencias se ordenan alfabéticamente con sangría francesa. Las fuentes se agrupan por tipo o repositorio (por ejemplo, «Archivo General de la Nación», «Prensa periódica»). Para cargar, pegás una lista: cada línea es una entrada y las repetidas se descartan solas. El botón «Copiar lista» la deja lista para pegar en Word.

**Bibliografía y Fuentes generales** (menú superior). Reúnen las listas de todos los capítulos sin duplicados e indican en qué capítulos se usa cada entrada.

**Actores** (menú superior). Una tabla con todos los actores detectados y una columna por cada parte de la tesis. Podés filtrar, ver solo los que reaparecen u ordenar por un capítulo. Al hacer clic en un actor ves sus menciones por capítulo y las formas en que aparece escrito. En modo edición podés:

- **ocultar** lo que no es un actor (lugares, por ejemplo);
- **unificar** variantes («Paz» con «José María Paz») o cambiar el nombre que se muestra;
- **contar aparte** una variante que se unió por error;
- **buscar cualquier nombre** en los textos de todos los capítulos y agregarlo como actor.

## Cómo se detectan los actores

Al subir un capítulo (.docx, .pdf o .txt) el texto se lee en tu navegador y se buscan nombres propios: secuencias de palabras con mayúscula como «Juan Manuel de Rosas» o «Sociedad Popular Restauradora». El programa:

- descarta palabras que solo llevan mayúscula por iniciar una oración;
- quita tratamientos («Gral.», «Dr.», «don»);
- une el apellido suelto con el nombre completo cuando no hay ambigüedad («Urquiza» con «Justo José de Urquiza»);
- aparta a los autores que aparecen como citas, por ejemplo «Halperin Donghi (1972)», y los lista aparte;
- ignora la sección final de bibliografía o fuentes del archivo y los encabezados en mayúsculas.

Es un método automático: va a incluir algunos lugares o nombres que no te interesan, y para eso están las herramientas de ocultar y unificar. Tus decisiones se guardan y se aplican a todos los capítulos, también a los que subas después.

**Opcional, con IA.** Si agregás una clave de la API de Claude (ver más abajo), aparece en cada capítulo el botón «Detectar actores con IA». Lee el capítulo completo, distingue personas, instituciones y grupos, deja afuera a los historiadores citados y agrega una frase sobre el papel de cada actor en ese capítulo. Cuesta unos pocos centavos de dólar por capítulo (depende del largo) y se cobra en tu cuenta de la API.

---

## Publicarlo en Vercel (paso a paso)

Necesitás una cuenta gratuita en [GitHub](https://github.com) y otra en [Vercel](https://vercel.com) (podés crear la de Vercel entrando con GitHub).

### 1. Subir el proyecto a GitHub

1. Descomprimí el archivo `tablero-tesis.zip`.
2. En GitHub, botón **New** (nuevo repositorio). Nombre: `tablero-tesis`. Elegí **Private**. Crealo.
3. En la página del repositorio vacío, hacé clic en **uploading an existing file**.
4. Arrastrá **el contenido** de la carpeta descomprimida (las carpetas `app`, `components`, `lib`, `public`, `scripts` y los archivos sueltos), no la carpeta entera. Abajo, **Commit changes**.

### 2. Crear el proyecto en Vercel

1. En Vercel: **Add New… → Project**.
2. Elegí el repositorio `tablero-thesis` y **Import**. Vercel reconoce que es Next.js; no cambies nada.
3. **Deploy**. Al terminar vas a tener una dirección del tipo `tablero-thesis-xxxx.vercel.app`. Todavía falta el almacenamiento.

### 3. Conectar el almacenamiento (donde se guarda todo)

1. Dentro del proyecto, entrá en **Storage**.
2. **Create Storage** (o **Create Database**) → **Blob** → **Continue**.
3. En el acceso elegí **Private**. Es importante: así tus capítulos y notas no quedan accesibles por enlace público.
4. Ponele un nombre (por ejemplo `tesis`) y crealo. Confirmá que quede conectado a este proyecto (entornos Production y Preview).

### 4. Volver a publicar

El almacenamiento se aplica en la próxima publicación: **Deployments** → en la última, menú **⋯** → **Redeploy**.

Listo. Entrá a tu dirección, tocá **Editar** y empezá a cargar.

### Contraseñas opcionales

Sin contraseñas, **cualquiera que tenga la dirección puede ver y editar** el tablero y descargar los capítulos. Si en algún momento querés restringirlo, agregá una o ambas variables en el menú lateral del proyecto, **Environment Variables** (en algunas cuentas está dentro de **Settings**), y después hacé **Redeploy**:

| Nombre | Qué hace |
|---|---|
| `ADMIN_PASSWORD` | Hace falta esta contraseña para editar. El resto puede ver, pero no editar ni descargar los capítulos. |
| `VIEWER_PASSWORD` | Toda la página queda privada: hace falta una contraseña para verla. Si también definiste `ADMIN_PASSWORD`, esta otra permite solo leer (útil para compartir con tu director/a). |
| `ANTHROPIC_API_KEY` | No es una contraseña: activa la detección de actores con IA ([platform.claude.com](https://platform.claude.com)). |

### Actualizaciones futuras

Si más adelante cambiás algún archivo del código en GitHub, Vercel vuelve a publicar solo. Tus contenidos no se pierden: están en el almacenamiento Blob, no en el código.

---

## Uso diario

- **Editar:** botón arriba a la derecha. La barra superior muestra una línea azul mientras editás, y el estado del guardado.
- **Guardado:** es automático (unos segundos después de que dejás de escribir, espaciado para no gastar de más). También hay un botón **Guardar ahora**. Si cerrás la pestaña con cambios pendientes, el navegador avisa, y al volver a entrar se ofrece recuperarlos.
- **Dos dispositivos a la vez:** si guardaste desde otro lado, el tablero avisa en lugar de pisar los cambios.
- **Copias de seguridad:** se guarda un respaldo automático cada 12 horas de uso (en la carpeta `respaldos/` del almacenamiento). En **Más → Descargar una copia de seguridad** bajás todo el contenido en un archivo; con **Restaurar desde una copia** lo recuperás.
- **Imprimir:** la portada se imprime como documento (sin botones ni menús), con todos los capítulos desplegados.

### Privacidad

- Los archivos se guardan en almacenamiento privado: no se pueden abrir con un enlace directo, solo desde la página.
- Sin contraseñas, la página está abierta a quien tenga la dirección (para ver, editar y descargar). Los respaldos automáticos permiten recuperar el contenido si alguien lo borra. Para cerrarla, ver «Contraseñas opcionales».
- La página pide a los buscadores que no la indexen.

### Límites del plan gratuito de Vercel

El plan gratuito de Vercel Blob incluye 1 GB de almacenamiento y 2.000 operaciones de escritura (subidas y guardados) por mes. Cada guardado cuenta una; subir un capítulo, unas tres. El tablero espacia los guardados automáticos y muestra el contador en **Más**; avisa si te acercás al límite. Si se superara, Vercel bloquea el almacenamiento durante 30 días (sin cobrarte nada), así que conviene no dejar la edición abierta guardando sin necesidad.

---

## Probarlo en tu computadora (opcional)

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
cp .env.example .env.local   # opcional: contraseñas y clave de IA
npm run dev
```

Abrí http://localhost:3000. En tu computadora los datos se guardan en la carpeta `.datos-locales`.

## Estructura del código

```
app/                 páginas y rutas de la API (Next.js)
  page.js            índice
  actores/           índice de actores
  capitulo/[id]/…    bibliografía y fuentes de cada capítulo
  bibliografia/      bibliografía general
  fuentes/           fuentes generales
  api/               guardar datos, subir y descargar archivos, sesión, IA
components/          interfaz
lib/actors.js        detección de actores
lib/actorIndex.js    cruce de actores entre capítulos
lib/defaultData.js   estructura de los datos (capítulos, campos)
lib/server/          contraseñas y almacenamiento
app/globals.css      diseño
```

Para cambiar los nombres de las partes o agregar un capítulo, editá `CHAPTER_DEFS` en `lib/defaultData.js`.
